"use client";

import { motion } from "framer-motion";

interface HypothesisTestPanelProps {
  data: any;
  groupA: string;
  groupB: string;
  metric: string;
  onGroupAChange: (value: string) => void;
  onGroupBChange: (value: string) => void;
  onMetricChange: (value: string) => void;
  onRunTest: () => void;
}

const groupOptions = [
  "reposo",
  "hover",
  "maniobra",
  "with_kalman",
  "without_kalman",
];
const metricOptions = [
  { value: "rmse_roll", label: "RMSE Roll" },
  { value: "rmse_pitch", label: "RMSE Pitch" },
  { value: "improvement", label: "Mejora Kalman" },
  { value: "variance_roll", label: "Varianza Roll" },
  { value: "variance_pitch", label: "Varianza Pitch" },
];

export default function HypothesisTestPanel({
  data,
  groupA,
  groupB,
  metric,
  onGroupAChange,
  onGroupBChange,
  onMetricChange,
  onRunTest,
}: HypothesisTestPanelProps) {
  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">
          ⚙️ Configuración del Test
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Grupo A</label>
            <select
              value={groupA}
              onChange={(e) => onGroupAChange(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
            >
              {groupOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Grupo B</label>
            <select
              value={groupB}
              onChange={(e) => onGroupBChange(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
            >
              {groupOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Métrica</label>
            <select
              value={metric}
              onChange={(e) => onMetricChange(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
            >
              {metricOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={onRunTest}
          className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
        >
          🧪 Ejecutar Test de Hipótesis
        </button>
      </div>

      {/* Resultados */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Interpretación */}
          <div
            className={`rounded-xl p-4 border ${
              data.significant
                ? data.difference < 0
                  ? "bg-green-900/30 border-green-500"
                  : "bg-red-900/30 border-red-500"
                : "bg-gray-900 border-gray-700"
            }`}
          >
            <p className="text-lg font-medium text-white">
              {data.interpretation}
            </p>
            {data.recommendation && (
              <p className="text-sm text-gray-300 mt-2">
                💡 {data.recommendation}
              </p>
            )}
          </div>

          {/* Métricas del test */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400">Grupo A</div>
              <div className="text-xl font-bold text-white">
                {data.group_a_mean.toFixed(3)}
              </div>
              <div className="text-xs text-gray-500">
                ±{data.group_a_std.toFixed(3)}
              </div>
              <div className="text-xs text-gray-500">n={data.group_a_size}</div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400">Grupo B</div>
              <div className="text-xl font-bold text-white">
                {data.group_b_mean.toFixed(3)}
              </div>
              <div className="text-xs text-gray-500">
                ±{data.group_b_std.toFixed(3)}
              </div>
              <div className="text-xs text-gray-500">n={data.group_b_size}</div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400">t-statistic</div>
              <div className="text-xl font-bold text-purple-400">
                {data.t_statistic.toFixed(3)}
              </div>
              <div className="text-xs text-gray-500">
                df={data.degrees_of_freedom}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400">p-valor</div>
              <div
                className={`text-xl font-bold ${data.p_value < 0.05 ? "text-green-400" : "text-yellow-400"}`}
              >
                {data.p_value.toExponential(2)}
              </div>
              <div className="text-xs text-gray-500">
                {data.significant ? "✅ Significativo" : "❌ No significativo"}
              </div>
            </div>
          </div>

          {/* Tamaño del efecto */}
          <div className="bg-gray-900/50 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">
                Tamaño del efecto (Cohen's d)
              </span>
              <span className="font-mono text-white">
                {data.effect_size.toFixed(3)}
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(data.effect_size / 1.5, 100)}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  data.effect_size >= 0.8
                    ? "bg-green-500"
                    : data.effect_size >= 0.5
                      ? "bg-blue-500"
                      : data.effect_size >= 0.2
                        ? "bg-yellow-500"
                        : "bg-gray-500"
                }`}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Despreciable (&lt;0.2)</span>
              <span>Pequeño (0.2-0.5)</span>
              <span>Mediano (0.5-0.8)</span>
              <span>Grande (&gt;0.8)</span>
            </div>
          </div>

          {/* Mejora porcentual */}
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Mejora</span>
              <span
                className={`text-xl font-bold ${
                  data.difference < 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {Math.abs(data.improvement_percent).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {data.difference < 0
                ? `${data.group_b_name} es mejor por ${Math.abs(data.improvement_percent).toFixed(1)}%`
                : `${data.group_a_name} es mejor por ${data.improvement_percent.toFixed(1)}%`}
            </p>
          </div>
        </motion.div>
      )}

      {!data && (
        <div className="text-center py-12 text-gray-400">
          <p>🧪 Haz clic en "Ejecutar Test" para comparar grupos</p>
          <p className="text-sm mt-2">
            Se necesitan al menos 3 vuelos por grupo para resultados confiables
          </p>
        </div>
      )}
    </div>
  );
}
