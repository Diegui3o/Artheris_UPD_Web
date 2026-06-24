"use client";

import { motion } from "framer-motion";

interface CorrelationHeatmapProps {
  data: any;
}

export default function CorrelationHeatmap({ data }: CorrelationHeatmapProps) {
  if (
    !data?.report?.strong_correlations?.length &&
    !data?.report?.correlation_matrix
  ) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>🔗 No hay correlaciones significativas detectadas</p>
        <p className="text-sm mt-2">
          Las señales no muestran relaciones fuertes
        </p>
      </div>
    );
  }

  const { strong_correlations, correlation_matrix } = data.report;

  const getCorrelationColor = (value: number) => {
    if (value > 0.7) return "bg-red-500";
    if (value > 0.5) return "bg-orange-500";
    if (value > 0.3) return "bg-yellow-500";
    if (value > 0.1) return "bg-green-500";
    if (value > -0.1) return "bg-gray-500";
    if (value > -0.3) return "bg-blue-500";
    return "bg-purple-500";
  };

  return (
    <div className="space-y-6">
      {/* Correlaciones fuertes */}
      {strong_correlations && strong_correlations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            🔗 Correlaciones Fuertes
          </h3>
          <div className="space-y-3">
            {strong_correlations.map((corr: any, idx: number) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-900 rounded-xl p-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-mono text-sm">
                      {corr.signal_a} ↔ {corr.signal_b}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {corr.interpretation}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        corr.value > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {corr.value > 0 ? "+" : ""}
                      {corr.value.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-500">{corr.strength}</div>
                  </div>
                </div>
                <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.abs(corr.value) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${
                      corr.value > 0 ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Matriz de correlación */}
      {correlation_matrix && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            📊 Matriz de Correlación
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {Object.keys(correlation_matrix).map((key) => (
                    <th
                      key={key}
                      className="p-2 text-gray-400 font-mono text-xs"
                    >
                      {key.slice(0, 8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(correlation_matrix).map(
                  ([rowKey, row]: [string, any]) => (
                    <tr key={rowKey}>
                      <td className="p-2 text-gray-400 font-mono text-xs">
                        {rowKey.slice(0, 8)}
                      </td>
                      {Object.values(row).map((val: any, idx: number) => (
                        <td key={idx} className="p-1">
                          <div
                            className={`w-8 h-8 rounded ${getCorrelationColor(val)} flex items-center justify-center text-xs text-white`}
                            title={`${val.toFixed(2)}`}
                          >
                            {Math.abs(val) > 0.5 ? (val > 0 ? "+" : "-") : ""}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
