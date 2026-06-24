import { motion } from "framer-motion";
import { Activity, Plane, RotateCcw, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { AnglesData } from "../types/angles";
import { useFlightTime } from "../hooks/useFlightTime";

type FlightRecord = {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  meanAbsRoll: number;
  meanAbsPitch: number;
};

// Grafica SVG simple y dinámica para y(t) = k1 * e^{-g1 t} * sin(k2 t)
// t ∈ [0, T], N puntos.
function buildPath(
  k1 = 1,
  k2 = 4,
  g1 = 0.7,
  g2 = 0, // lo usamos como offset (bias)
  T = 3,
  N = 180,
  w = 260,
  h = 80
) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * T;
    const y = k1 * Math.exp(-g1 * t) * Math.sin(k2 * t) + g2;
    // normalizamos y a [0,1] suponiendo rango aprox [-|k1|, |k1|]
    const ymax = Math.max(1, Math.abs(k1) + Math.abs(g2));
    const yn = 0.5 - y / (2 * ymax); // 0 arriba, 1 abajo, centrado
    const x = (i / N) * w;
    const ypx = yn * h;
    pts.push([x, ypx]);
  }
  let d = "";
  pts.forEach(([x, y], idx) => {
    d += idx === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
  });
  return d;
}

type Props = {
  /** Última muestra de telemetría que recibes por WS/UDP */
  sample?: AnglesData & { timestamp?: number };
};

// Format time as MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function FlightAnalyticsPanel({ sample }: Props) {
  const {
    isFlying,
    currentFlightSec,
    lastFlightSec,
    totalFlightSec,
    meanAbsRoll,
    meanAbsPitch,
    lastMeanAbsRoll,
    lastMeanAbsPitch,
    history,
    resetTotals,
  } = useFlightTime(sample);

  // Dynamic function path for k1,k2,g1,g2 parameters
  const path = useMemo(() => {
    const k1 = sample?.k1 ?? 1;
    const k2 = sample?.k2 ?? 4;
    const g1 = sample?.g1 ?? 0.7;
    const g2 = sample?.g2 ?? 0;
    return buildPath(k1, k2, g1, g2);
  }, [sample?.k1, sample?.k2, sample?.g1, sample?.g2]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* === TIEMPOS Y DESVIACIONES === */}
      <div className="bg-gray-800/40 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-white font-semibold flex items-center gap-2">
            <Plane size={18} /> Analítica de Vuelo
          </div>
          <button
            onClick={resetTotals}
            className="text-xs text-white/70 hover:text-white flex items-center gap-1"
            title="Resetear acumulados"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          {/* Vuelo actual */}
          <div className="bg-gray-700/40 rounded-md p-3 border border-white/10">
            <p className="text-[12px] text-gray-300/80">Vuelo actual</p>
            <div className="flex items-center gap-2">
              <motion.span
                className={`w-2.5 h-2.5 rounded-full ${
                  isFlying ? "bg-emerald-400" : "bg-gray-500"
                }`}
                animate={
                  isFlying
                    ? { scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }
                    : { scale: 1, opacity: 0.8 }
                }
                transition={{ duration: 1.2, repeat: isFlying ? Infinity : 0 }}
              />
              <div className="text-xl font-semibold text-white">
                {formatTime(currentFlightSec)}
              </div>
            </div>
            <div className="text-[11px] text-gray-300/70 mt-1">
              |Roll| medio: {meanAbsRoll.toFixed(2)}° · |Pitch| medio:{" "}
              {meanAbsPitch.toFixed(2)}°
            </div>
          </div>

          {/* Último vuelo */}
          <div className="bg-gray-700/40 rounded-md p-3 border border-white/10">
            <p className="text-[12px] text-gray-300/80">Último vuelo</p>
            <div className="text-xl font-semibold text-white">
              {formatTime(lastFlightSec)}
            </div>
            <div className="text-[11px] text-gray-300/70 mt-1">
              |Roll|: {lastMeanAbsRoll.toFixed(2)}° · |Pitch|:{" "}
              {lastMeanAbsPitch.toFixed(2)}°
            </div>
          </div>

          {/* Total acumulado */}
          <div className="bg-gray-700/40 rounded-md p-3 border border-white/10">
            <p className="text-[12px] text-gray-300/80">Total</p>
            <div className="text-xl font-semibold text-white">
              {formatTime(totalFlightSec)}
            </div>
            <div className="text-[11px] text-gray-300/70 mt-1">
              Vuelos: {history.length}
            </div>
          </div>
        </div>
        {/* THROTTLE ACTUAL */}
        <div className="bg-gray-700/40 rounded-md p-3 border border-white/10 mb-3">
          <p className="text-[12px] text-gray-300/80">Throttle</p>
          <div className="text-sm text-white">
            <b>{sample?.InputThrottle ?? 0}</b> μs
          </div>
        </div>
        {/* Historial compacto */}
        <div className="mt-3">
          <p className="text-xs text-gray-300/80 mb-2 flex items-center gap-2">
            <TrendingUp size={14} /> Historial de vuelos (últimos)
          </p>
          <div className="flex flex-wrap gap-2">
            {history.slice(-8).map((h: FlightRecord, i: number) => (
              <span
                key={`${h.startedAt}-${i}`}
                className="text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/80"
                title={`|Roll|=${h.meanAbsRoll.toFixed(
                  2
                )}° |Pitch|=${h.meanAbsPitch.toFixed(2)}°`}
              >
                {formatTime(h.durationSec)}
              </span>
            ))}
            {history.length === 0 && (
              <span className="text-[11px] text-white/60">Sin vuelos aún</span>
            )}
          </div>
        </div>
      </div>

      {/* === FUNCIÓN k1,k2,g1,g2 === */}
      <div className="bg-gray-800/40 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-white font-semibold flex items-center gap-2">
            <Activity size={18} /> Respuesta Dinámica (k1,k2,g1,g2)
          </div>
          <div className="text-[11px] text-white/70">
            y = k1·e<sup>-g1·t</sup>·sin(k2·t) + g2
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
          <svg
            width="100%"
            height="120"
            viewBox="0 0 280 100"
            preserveAspectRatio="none"
          >
            {/* eje base */}
            <line
              x1="0"
              y1="50"
              x2="280"
              y2="50"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
            />
            {/* path animado */}
            <motion.path
              d={path.replace(/\s*,\s*/g, " ")} // asegurar compat
              fill="none"
              stroke="rgba(59,130,246,0.9)"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </svg>

          <div className="text-[11px] text-white/70 mt-2">
            k1={sample?.k1 ?? 1} · k2={sample?.k2 ?? 4} · g1={sample?.g1 ?? 0.7}{" "}
            · g2={sample?.g2 ?? 0}
          </div>
          <div className="text-[11px] text-white/50">
            (Se actualiza con tus parámetros en tiempo real si vienen en
            telemetría)
          </div>
        </div>
      </div>
    </div>
  );
}
