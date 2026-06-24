import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnglesData } from "../types/angles";

export type FlightSample = AnglesData & { timestamp?: number };

export type FlightRecord = {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  startThrottle: number;
  endThrottle: number;
  meanAbsRoll: number;
  meanAbsPitch: number;
};

const LS_TOTAL = "armeris:thr:totalSec";
const LS_LAST = "armeris:thr:lastSec";
const LS_HISTORY = "armeris:thr:history";

/**
 * Cuenta tiempo desde que InputThrottle >= 1100 hasta que InputThrottle >= 2000.
 * Persiste totales e historial en localStorage.
 */
export function useThrottleAnalytics(sample?: FlightSample) {
  // Umbrales
  const THR_START = 1100;  // inicio de conteo
  const THR_END   = 2000;  // fin de conteo
  const MIN_SESSION_MS = 300; // descarta sesiones demasiado cortas (rebotes)

  // Estado público
  const [isCounting, setIsCounting] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState<number>(() => {
    const s = localStorage.getItem(LS_TOTAL);
    return s ? Number(s) || 0 : 0;
  });
  const [lastSec, setLastSec] = useState<number>(() => {
    const s = localStorage.getItem(LS_LAST);
    return s ? Number(s) || 0 : 0;
  });

  const [meanAbsRoll, setMeanAbsRoll] = useState(0);
  const [meanAbsPitch, setMeanAbsPitch] = useState(0);
  const [lastMeanAbsRoll, setLastMeanAbsRoll] = useState(0);
  const [lastMeanAbsPitch, setLastMeanAbsPitch] = useState(0);

  const [history, setHistory] = useState<FlightRecord[]>(() => {
    const s = localStorage.getItem(LS_HISTORY);
    if (!s) return [];
    try { return JSON.parse(s) as FlightRecord[]; } catch { return []; }
  });

  // Internos/refs para sesión actual
  const startTimeRef = useRef<number | null>(null);
  const prevTsRef = useRef<number | null>(null);
  const startThrRef = useRef<number>(0);
  const endThrRef = useRef<number>(0);
  const sumAbsRollRef = useRef(0);
  const sumAbsPitchRef = useRef(0);
  const countRef = useRef(0);

  // Etiqueta legible para el throttle
  const throttleValue = sample?.InputThrottle ?? 0;
  const throttleLabel = useMemo(() => {
    const thr = throttleValue;
    if (thr >= THR_END) return "Máximo (FULL)";
    if (thr >= 1700) return "Alto";
    if (thr >= 1300) return "Medio";
    if (thr >= THR_START) return "Arranque/Despegue";
    if (thr > 0) return "Bajo/Idle";
    return "—";
  }, [throttleValue]);

  // Persistencia de totales/historial
  useEffect(() => {
    localStorage.setItem(LS_TOTAL, String(totalSec));
  }, [totalSec]);

  useEffect(() => {
    localStorage.setItem(LS_LAST, String(lastSec));
  }, [lastSec]);

  useEffect(() => {
    localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(-100)));
  }, [history]);

  // Lógica principal
  useEffect(() => {
    const ts = sample?.timestamp ?? Date.now();
    const thr = throttleValue;

    // Inicio de sesión
    if (!isCounting && thr >= THR_START) {
      setIsCounting(true);
      startTimeRef.current = ts;
      prevTsRef.current = ts;
      startThrRef.current = thr;
      sumAbsRollRef.current = 0;
      sumAbsPitchRef.current = 0;
      countRef.current = 0;
      setCurrentSec(0);
      setMeanAbsRoll(0);
      setMeanAbsPitch(0);
      return;
    }

    // Sesión en curso
    if (isCounting) {
      const prev = prevTsRef.current ?? ts;
      const dtSec = Math.max(0, (ts - prev) / 1000);
      prevTsRef.current = ts;

      // acumula tiempo actual
      setCurrentSec((s) => s + dtSec);

      // acumula medias si hay ángulos disponibles
      const r = Math.abs(sample?.KalmanAngleRoll ?? 0);
      const p = Math.abs(sample?.KalmanAnglePitch ?? 0);
      sumAbsRollRef.current += r;
      sumAbsPitchRef.current += p;
      countRef.current += 1;

      const n = countRef.current || 1;
      setMeanAbsRoll(sumAbsRollRef.current / n);
      setMeanAbsPitch(sumAbsPitchRef.current / n);

      // ¿Finaliza?
      if (thr >= THR_END) {
        const start = startTimeRef.current ?? ts;
        const durationMs = ts - start;

        if (durationMs >= MIN_SESSION_MS) {
          const durSec = durationMs / 1000;
          const nFinal = countRef.current || 1;
          const mRoll = sumAbsRollRef.current / nFinal;
          const mPitch = sumAbsPitchRef.current / nFinal; // <- corregido (antes usabas sumAbsRollRef)

          endThrRef.current = thr;

          // publicar estadísticas
          setLastSec(durSec);
          setTotalSec((t) => t + durSec);
          setLastMeanAbsRoll(mRoll);
          setLastMeanAbsPitch(mPitch);

          setHistory((h) =>
            [
              ...h,
              {
                startedAt: start,
                endedAt: ts,
                durationSec: durSec,
                startThrottle: startThrRef.current,
                endThrottle: endThrRef.current,
                meanAbsRoll: mRoll,
                meanAbsPitch: mPitch,
              },
            ].slice(-100)
          );
        }

        // reset sesión
        setIsCounting(false);
        startTimeRef.current = null;
        prevTsRef.current = null;
        sumAbsRollRef.current = 0;
        sumAbsPitchRef.current = 0;
        countRef.current = 0;
        setCurrentSec(0);
        setMeanAbsRoll(0);
        setMeanAbsPitch(0);
      }

      return;
    }

    // No contando: sólo mantén el timestamp previo
    if (!isCounting) {
      prevTsRef.current = ts;
    }
  }, [sample, isCounting, throttleValue]);

  const resetTotals = useCallback(() => {
    setTotalSec(0);
    setLastSec(0);
    setLastMeanAbsRoll(0);
    setLastMeanAbsPitch(0);
    setHistory([]);
    localStorage.setItem(LS_TOTAL, "0");
    localStorage.setItem(LS_LAST, "0");
    localStorage.setItem(LS_HISTORY, "[]");
  }, []);

  return {
    // Estado de sesión
    isCounting,
    currentSec,
    lastSec,
    totalSec,

    // Desviaciones
    meanAbsRoll,
    meanAbsPitch,
    lastMeanAbsRoll,
    lastMeanAbsPitch,

    // Throttle actual
    throttle: {
      value: throttleValue,
      label: throttleLabel,
      startThreshold: THR_START,
      endThreshold: THR_END,
    },

    // Historial
    history,

    // Utils
    resetTotals,
  };
}
