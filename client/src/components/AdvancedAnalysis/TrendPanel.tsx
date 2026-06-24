"use client";

interface TrendPanelProps {
  data: any;
}

export default function TrendPanel({ data }: TrendPanelProps) {
  if (!data?.report) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>📈 No hay datos de tendencia disponibles</p>
        <p className="text-sm mt-2">
          Se necesitan al menos 3 vuelos del mismo tipo
        </p>
      </div>
    );
  }

  const {
    slope = 0,
    r_squared = 0,
    p_value = 1,
    significant_trend = false,
    interpretation = "Sin datos de tendencia",
    forecast_next = null,
  } = data.report || {};

  return (
    <div className="space-y-6">
      {/* Interpretación */}
      <div
        className={`rounded-xl p-4 border ${
          significant_trend
            ? slope < 0
              ? "bg-green-900/30 border-green-500"
              : "bg-red-900/30 border-red-500"
            : "bg-gray-900 border-gray-700"
        }`}
      >
        <p className="text-lg font-medium text-white">{interpretation}</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">Pendiente</div>
          <div
            className={`text-xl font-bold ${slope < 0 ? "text-green-400" : "text-red-400"}`}
          >
            {slope > 0 ? "+" : ""}
            {slope.toFixed(4)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">R²</div>
          <div className="text-xl font-bold text-white">
            {r_squared.toFixed(3)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">p-valor</div>
          <div
            className={`text-xl font-bold ${p_value < 0.05 ? "text-green-400" : "text-yellow-400"}`}
          >
            {p_value.toExponential(2)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400">Predicción</div>
          <div className="text-xl font-bold text-purple-400">
            {forecast_next ? forecast_next.toFixed(3) : "N/A"}
          </div>
        </div>
      </div>

      {/* Explicación de métricas */}
      <div className="bg-gray-900/50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">
          📖 Interpretación
        </h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>
            • <strong>Pendiente negativa</strong> = mejora con el tiempo
          </li>
          <li>
            • <strong>R² {">"} 0.7</strong> = tendencia fuerte
          </li>
          <li>
            • <strong>p-valor &lt; 0.05</strong> = tendencia significativa
          </li>
        </ul>
      </div>
    </div>
  );
}
