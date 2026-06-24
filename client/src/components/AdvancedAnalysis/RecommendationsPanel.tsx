"use client";

import { motion } from "framer-motion";

interface RecommendationsPanelProps {
  data: any;
}

export default function RecommendationsPanel({
  data,
}: RecommendationsPanelProps) {
  if (!data?.report?.recommendations?.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>💡 No hay recomendaciones disponibles</p>
        <p className="text-sm mt-2">El vuelo parece estar en buen estado</p>
      </div>
    );
  }

  const { recommendations, summary } = data.report;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 border-red-500 text-red-300";
      case "medium":
        return "bg-yellow-500/20 border-yellow-500 text-yellow-300";
      default:
        return "bg-blue-500/20 border-blue-500 text-blue-300";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return "🔴";
      case "medium":
        return "🟡";
      default:
        return "🔵";
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      {summary && (
        <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4">
          <p className="text-purple-300">{summary}</p>
        </div>
      )}

      {/* Lista de recomendaciones */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">💡 Recomendaciones</h3>
        {recommendations.map((rec: any, idx: number) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`rounded-xl p-4 border ${getPriorityColor(rec.priority)}`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{getPriorityIcon(rec.priority)}</div>
              <div className="flex-1">
                <div className="font-semibold">{rec.title}</div>
                <div className="text-sm mt-1">{rec.description}</div>
                {rec.action && (
                  <div className="text-sm text-gray-300 mt-2">
                    🔧 Acción sugerida: {rec.action}
                  </div>
                )}
                {rec.area && (
                  <div className="text-xs text-gray-400 mt-1">
                    Área: {rec.area}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
