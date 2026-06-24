"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface AnomalyPanelProps {
  data: any;
}

interface GroupedAnomaly {
  type: string;
  count: number;
  severity: "critical" | "warning" | "info";
  maxValue: number;
  axes: string[];
  timeRange: { start: number; end: number };
}

export default function AnomalyPanel({ data }: AnomalyPanelProps) {
  if (!data?.report?.anomalies?.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-6xl mb-4">✅</div>
        <p className="text-lg">No se detectaron anomalías</p>
        <p className="text-sm mt-2">El vuelo fue completamente normal</p>
      </div>
    );
  }

  const { anomalies, summary } = data.report;
  const totalEvents = anomalies.length;

  // Agrupar por tipo de anomalía (solo información esencial)
  const groupedAnomalies = useMemo(() => {
    const groups: Map<string, GroupedAnomaly> = new Map();

    for (const anomaly of anomalies) {
      const description = anomaly.description || "";
      let type = "";
      let severity: "critical" | "warning" | "info" = "info";
      const value = Math.abs(anomaly.value || 0);
      const axis = anomaly.affected_axis || "desconocido";

      if (description.includes("Ruido excesivo")) {
        type = "Ruido excesivo";
        if (value > 5.0) severity = "critical";
        else if (value > 1.0) severity = "warning";
        else severity = "info";
      } else if (description.includes("Señal constante")) {
        type = "Señal constante";
        severity = "warning";
      } else if (
        description.includes("Error") ||
        description.includes("error")
      ) {
        type = "Error de seguimiento";
        severity = value > 10 ? "critical" : "warning";
      } else {
        type = "Otra anomalía";
      }

      if (groups.has(type)) {
        const existing = groups.get(type)!;
        existing.count++;
        existing.maxValue = Math.max(existing.maxValue, value);
        existing.timeRange.end = Math.max(
          existing.timeRange.end,
          anomaly.timestamp,
        );
        if (!existing.axes.includes(axis)) {
          existing.axes.push(axis);
        }
      } else {
        groups.set(type, {
          type,
          count: 1,
          severity,
          maxValue: value,
          axes: [axis],
          timeRange: { start: anomaly.timestamp, end: anomaly.timestamp },
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [anomalies]);

  const criticalCount = groupedAnomalies
    .filter((a) => a.severity === "critical")
    .reduce((sum, a) => sum + a.count, 0);
  const warningCount = groupedAnomalies
    .filter((a) => a.severity === "warning")
    .reduce((sum, a) => sum + a.count, 0);
  const infoCount = groupedAnomalies
    .filter((a) => a.severity === "info")
    .reduce((sum, a) => sum + a.count, 0);

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 border-red-500/30";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/30";
      default:
        return "bg-blue-500/10 border-blue-500/30";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "warning":
        return "🟡";
      default:
        return "🔵";
    }
  };

  const getAxisIcon = (axis: string) => {
    if (axis.includes("roll")) return "🔄";
    if (axis.includes("pitch")) return "📐";
    if (axis.includes("error")) return "⚠️";
    return "📊";
  };

  const getRecommendation = (type: string, maxValue: number) => {
    if (type === "Ruido excesivo") {
      if (maxValue > 10) {
        return "⚠️ Vibración extrema. Revisar montaje del sensor y balance de hélices.";
      } else if (maxValue > 3) {
        return "⚠️ Vibración significativa. Verificar estado de motores y hélices.";
      }
      return "🔧 Ruido moderado. Monitorear en próximos vuelos.";
    }
    if (type === "Señal constante") {
      return "📊 Señal constante. Posible pérdida de datos o sensor saturado.";
    }
    if (type === "Error de seguimiento") {
      if (maxValue > 10) {
        return "⚠️ Error de seguimiento crítico. Revisar controlador PID.";
      }
      return "📊 Error de seguimiento moderado. Ajustar ganancias de control.";
    }
    return "🔍 Revisar condiciones del vuelo.";
  };

  // Calcular rango de tiempo total
  const timeRange = useMemo(() => {
    const timestamps = anomalies.map((a: any) => a.timestamp);
    return {
      min: Math.min(...timestamps),
      max: Math.max(...timestamps),
    };
  }, [anomalies]);

  return (
    <div className="space-y-6">
      {/* Tarjeta de resumen principal */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          📊 Resumen de Anomalías
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">
              {criticalCount}
            </div>
            <div className="text-xs text-gray-400">Críticas</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {warningCount}
            </div>
            <div className="text-xs text-gray-400">Advertencias</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">{infoCount}</div>
            <div className="text-xs text-gray-400">Informativas</div>
          </div>
        </div>

        {/* Barra de severidad */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div className="flex h-full">
            {criticalCount > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(criticalCount / totalEvents) * 100}%` }}
                className="bg-red-500 h-full"
              />
            )}
            {warningCount > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(warningCount / totalEvents) * 100}%` }}
                className="bg-yellow-500 h-full"
              />
            )}
            {infoCount > 0 && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(infoCount / totalEvents) * 100}%` }}
                className="bg-blue-500 h-full"
              />
            )}
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Críticas</span>
          <span>Advertencias</span>
          <span>Informativas</span>
        </div>
        <div className="mt-4 text-center text-sm text-gray-400">
          Total: {totalEvents.toLocaleString()} eventos
        </div>
        <div className="text-center text-xs text-gray-500 mt-1">
          Período: {timeRange.min.toFixed(1)}s - {timeRange.max.toFixed(1)}s
        </div>
      </div>

      {/* Lista de tipos de anomalía */}
      <div className="space-y-4">
        {groupedAnomalies.map((group, idx) => {
          const duration = group.timeRange.end - group.timeRange.start;

          return (
            <motion.div
              key={group.type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-xl border ${getSeverityBg(
                group.severity,
              )} p-4`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {getSeverityIcon(group.severity)}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{group.type}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {group.count.toLocaleString()} eventos •{" "}
                      {duration.toFixed(1)}s
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold ${
                      group.maxValue > 5
                        ? "text-red-400"
                        : group.maxValue > 1
                          ? "text-yellow-400"
                          : "text-gray-300"
                    }`}
                  >
                    Máx: {group.maxValue.toFixed(1)}°
                  </div>
                </div>
              </div>

              {/* Ejes afectados */}
              {group.axes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.axes.map((axis) => (
                    <div
                      key={axis}
                      className="inline-flex items-center gap-1 bg-gray-800 rounded-full px-3 py-1"
                    >
                      <span className="text-sm">{getAxisIcon(axis)}</span>
                      <span className="text-xs text-gray-300">
                        {axis.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recomendación */}
              <div className="mt-3 bg-gray-900/50 rounded-lg p-3">
                <div className="text-xs text-purple-400 mb-1">
                  💡 RECOMENDACIÓN
                </div>
                <div className="text-sm text-gray-300">
                  {getRecommendation(group.type, group.maxValue)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Resumen ejecutivo */}
      <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📋</div>
          <div>
            <div className="font-semibold text-white mb-1">
              Resumen ejecutivo
            </div>
            <p className="text-sm text-purple-300">
              {criticalCount > 0
                ? `⚠️ ALERTA: ${criticalCount} anomalías críticas detectadas. Máxima severidad: ${summary?.max_severity?.toFixed(0) || "N/A"}. Se recomienda revisión inmediata.`
                : warningCount > 0
                  ? `⚠️ ${warningCount} anomalías de advertencia. El problema principal es ${
                      groupedAnomalies[0]?.type?.toLowerCase() || "ruido"
                    } con magnitud máxima de ${groupedAnomalies[0]?.maxValue?.toFixed(1)}°.`
                  : `✅ No se detectaron anomalías críticas. El vuelo fue estable.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
