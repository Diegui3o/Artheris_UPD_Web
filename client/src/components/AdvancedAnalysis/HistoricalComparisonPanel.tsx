"use client";

import { motion } from "framer-motion";

interface HistoricalComparisonPanelProps {
  data: any;
}

export default function HistoricalComparisonPanel({
  data,
}: HistoricalComparisonPanelProps) {
  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>📚 No hay datos históricos disponibles</p>
        <p className="text-sm mt-2">
          Analiza más vuelos para construir el histórico
        </p>
      </div>
    );
  }

  const { flight_type, historical, comparison, rank, quality_score } = data;
  const { sample_count, percentiles } = historical;

  if (sample_count === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>📚 No hay vuelos históricos de tipo "{flight_type}"</p>
        <p className="text-sm mt-2">
          Analiza al menos 3 vuelos de este tipo para ver comparaciones
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score y ranking */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">Calidad</div>
          <div className="text-3xl font-bold text-purple-400">
            {quality_score}
          </div>
          <div className="text-xs text-gray-500">/100</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">Ranking</div>
          <div className="text-3xl font-bold text-green-400">
            #{rank.position}
          </div>
          <div className="text-xs text-gray-500">de {rank.total} vuelos</div>
        </div>
      </div>

      {/* Comparación por métrica */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">
          📊 Comparación vs Histórico
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">RMSE Roll</span>
              <span className="text-gray-400">
                {comparison.rmse_roll.value.toFixed(3)}° vs{" "}
                {comparison.rmse_roll.mean.toFixed(3)}°
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(comparison.rmse_roll.value / (comparison.rmse_roll.mean * 2)) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  comparison.rmse_roll.better_than_average
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Percentil: {comparison.rmse_roll.percentile.toFixed(0)}% -{" "}
              {comparison.rmse_roll.interpretation}
            </p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">Mejora Kalman</span>
              <span className="text-gray-400">
                {comparison.improvement_percent.value.toFixed(1)}% vs{" "}
                {comparison.improvement_percent.mean.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(comparison.improvement_percent.value / 100) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  comparison.improvement_percent.better_than_average
                    ? "bg-green-500"
                    : "bg-yellow-500"
                }`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {comparison.improvement_percent.interpretation}
            </p>
          </div>
        </div>
      </div>

      {/* Percentiles */}
      <div className="bg-gray-900/50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">
          📐 Percentiles Históricos (RMSE)
        </h4>
        <div className="grid grid-cols-5 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-500">p5</div>
            <div className="text-sm font-mono text-green-400">
              {percentiles.p5.toFixed(3)}°
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">p25</div>
            <div className="text-sm font-mono text-green-400">
              {percentiles.p25.toFixed(3)}°
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">p50</div>
            <div className="text-sm font-mono text-yellow-400">
              {percentiles.p50.toFixed(3)}°
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">p75</div>
            <div className="text-sm font-mono text-orange-400">
              {percentiles.p75.toFixed(3)}°
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">p95</div>
            <div className="text-sm font-mono text-red-400">
              {percentiles.p95.toFixed(3)}°
            </div>
          </div>
        </div>
      </div>

      {/* Badge de ranking */}
      <div
        className={`rounded-xl p-4 border ${
          rank.label === "Excelente"
            ? "bg-green-900/30 border-green-500"
            : rank.label === "Muy bueno"
              ? "bg-blue-900/30 border-blue-500"
              : rank.label === "Bueno"
                ? "bg-purple-900/30 border-purple-500"
                : "bg-gray-900 border-gray-700"
        }`}
      >
        <p className="text-center">
          <span className="font-semibold">{rank.label}</span>
          <span className="text-gray-400 text-sm ml-2">
            ({rank.percentile.toFixed(0)}% de vuelos mejores)
          </span>
        </p>
      </div>
    </div>
  );
}
