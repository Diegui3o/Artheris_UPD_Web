"use client";

import { motion } from "framer-motion";

interface QualityScoreCardProps {
  data: any;
  flightId: string;
}

export default function QualityScoreCard({
  data,
  flightId,
}: QualityScoreCardProps) {
  if (!data?.score) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>📊 No hay datos de calidad disponibles</p>
        <p className="text-sm mt-2">
          Analiza el vuelo primero con /metrics-full
        </p>
      </div>
    );
  }

  const { total_score, category, breakdown } = data.score;

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Excelente":
        return "text-green-400";
      case "Bueno":
        return "text-blue-400";
      case "Regular":
        return "text-yellow-400";
      case "Malo":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Score principal */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gray-900 border-4 border-purple-500">
          <span className="text-4xl font-bold text-white">{total_score}</span>
          <span className="text-xl text-gray-400">/100</span>
        </div>
        <div
          className={`mt-4 text-2xl font-bold ${getCategoryColor(category)}`}
        >
          {category}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Puntuación de calidad del vuelo
        </p>
      </div>

      {/* Desglose */}
      {breakdown && (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">📊 Desglose</h3>
          <div className="space-y-3">
            {Object.entries(breakdown).map(([key, value]: [string, any]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">
                    {key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                  <span className="text-gray-400">
                    {value.value} / {value.max}
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(value.value / value.max) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${
                      value.value / value.max > 0.7
                        ? "bg-green-500"
                        : value.value / value.max > 0.4
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badge de vuelo */}
      <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4">
        <p className="text-sm text-gray-300">
          <span className="font-semibold text-purple-400">📌 Flight ID:</span>{" "}
          <code className="font-mono text-xs">{flightId}</code>
        </p>
      </div>
    </div>
  );
}
