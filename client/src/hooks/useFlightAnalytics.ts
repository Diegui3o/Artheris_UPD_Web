import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnglesData } from "../types/angles";

/**
 * Tracks flight time and statistics based on throttle input.
 * - Considers "in flight" when InputThrottle is between 1300 and 2000
 * - Uses sample.timestamp if available, otherwise falls back to Date.now()
 * - Tracks roll and pitch deviations during flight
 */
export type FlightSample = AnglesData & { timestamp?: number };

export type FlightRecord = {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  meanAbsRoll: number;
  meanAbsPitch: number;
};

export function useFlightAnalytics(sample?: FlightSample) {
  // Flight detection thresholds (microseconds)
  const THR_MIN = 1300;
  const THR_MAX = 2000;
  
  // Minimum flight duration to be considered valid (milliseconds)
  const MIN_FLIGHT_DURATION_MS = 1000; // 1 second

  const [isFlying, setIsFlying] = useState(false);
  const [currentFlightSec, setCurrentFlightSec] = useState(0);
  const [totalFlightSec, setTotalFlightSec] = useState(0);
  const [lastFlightSec, setLastFlightSec] = useState(0);

  const [meanAbsRoll, setMeanAbsRoll] = useState(0);
  const [meanAbsPitch, setMeanAbsPitch] = useState(0);
  const [lastMeanAbsRoll, setLastMeanAbsRoll] = useState(0);
  const [lastMeanAbsPitch, setLastMeanAbsPitch] = useState(0);

  const [history, setHistory] = useState<FlightRecord[]>([]);

  // Acumuladores del vuelo actual
  const startTimeRef = useRef<number | null>(null);
  const prevTsRef = useRef<number | null>(null);
  const sumAbsRollRef = useRef(0);
  const sumAbsPitchRef = useRef(0);
  const countRef = useRef(0);

  // Detecta si la muestra indica vuelo
  const flyingNow = useMemo(() => {
    const thr = sample?.InputThrottle ?? 0;
    return thr >= THR_MIN && thr <= THR_MAX;
  }, [sample]);

  useEffect(() => {
    const ts = sample?.timestamp ?? Date.now();

    // Arranque de vuelo
    if (!isFlying && flyingNow) {
      setIsFlying(true);
      startTimeRef.current = ts;
      prevTsRef.current = ts;
      sumAbsRollRef.current = 0;
      sumAbsPitchRef.current = 0;
      countRef.current = 0;
      setCurrentFlightSec(0);
      setMeanAbsRoll(0);
      setMeanAbsPitch(0);
      return;
    }

    // Vuelo en curso
    if (isFlying && flyingNow) {
      const prev = prevTsRef.current ?? ts;
      const dtSec = Math.max(0, (ts - prev) / 1000);
      prevTsRef.current = ts;

      // Avanza tiempo de vuelo actual
      setCurrentFlightSec((s) => s + dtSec);

      // Acumula desviaciones absolutas (si hay datos)
      const r = Math.abs(sample?.KalmanAngleRoll ?? 0);
      const p = Math.abs(sample?.KalmanAnglePitch ?? 0);
      sumAbsRollRef.current += r;
      sumAbsPitchRef.current += p;
      countRef.current += 1;

      // Actualiza medias del vuelo actual
      const n = countRef.current || 1;
      setMeanAbsRoll(sumAbsRollRef.current / n);
      setMeanAbsPitch(sumAbsPitchRef.current / n);
      return;
    }

    // Flight end detection
    if (isFlying && !flyingNow) {
      const start = startTimeRef.current ?? ts;
      const durationMs = ts - start;
      
      // Only record flights that lasted longer than minimum duration
      if (durationMs >= MIN_FLIGHT_DURATION_MS) {
        const durSec = durationMs / 1000;
        
        // Calculate final means
        const n = countRef.current || 1;
        const mRoll = sumAbsRollRef.current / n;
        const mPitch = sumAbsRollRef.current / n;

        // Update flight statistics
        setLastFlightSec(durSec);
        setTotalFlightSec((t) => t + durSec);
        setLastMeanAbsRoll(mRoll);
        setLastMeanAbsPitch(mPitch);

        // Add to flight history
        setHistory((h) => [
          ...h,
          {
            startedAt: start,
            endedAt: ts,
            durationSec: durSec,
            meanAbsRoll: mRoll,
            meanAbsPitch: mPitch,
          },
        ].slice(-100)); // Keep only last 100 flights
      }

      // Reset flight state
      setIsFlying(false);
      startTimeRef.current = null;
      prevTsRef.current = null;
      sumAbsRollRef.current = 0;
      sumAbsPitchRef.current = 0;
      countRef.current = 0;
      setCurrentFlightSec(0);
      setMeanAbsRoll(0);
      setMeanAbsPitch(0);
      return;
    }

    // No vuelo y sigue sin vuelo → solo actualiza ts
    if (!isFlying && !flyingNow) {
      prevTsRef.current = ts;
    }
  }, [sample, flyingNow, isFlying]);

  const resetTotals = useCallback(
    () => {
      setTotalFlightSec(0);
      setLastFlightSec(0);
      setHistory([]);
    },
    []
  );

  return {
    // Estado
    isFlying,
    currentFlightSec,
    lastFlightSec,
    totalFlightSec,

    // Desviaciones (|media|)
    meanAbsRoll,
    meanAbsPitch,
    lastMeanAbsRoll,
    lastMeanAbsPitch,

    // Historial de vuelos
    history,

    // Utils
    resetTotals,
  };
}
