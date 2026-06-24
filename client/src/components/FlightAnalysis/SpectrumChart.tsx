"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

interface SpectrumData {
  flight_id: string;
  sample_rate_hz: number;
  sample_count: number;
  duration_sec: number;
  roll_error: {
    frequencies_hz: number[];
    magnitudes: number[];
    dominant_peaks: any[];
  };
  pitch_error: {
    frequencies_hz: number[];
    magnitudes: number[];
    dominant_peaks: any[];
  };
  combined_error: {
    frequencies_hz: number[];
    magnitudes: number[];
    dominant_peaks: any[];
  };
  motors: {
    frequencies_hz: number[];
    magnitudes: number[];
    dominant_peaks: any[];
  };
  accelerometer_x: { frequencies_hz: number[]; magnitudes: number[] };
  accelerometer_y: { frequencies_hz: number[]; magnitudes: number[] };
  accelerometer_z: { frequencies_hz: number[]; magnitudes: number[] };
  accelerometer_magnitude: { frequencies_hz: number[]; magnitudes: number[] };
  correlations: any[];
  recommendations: string[];
}

export default function SpectrumChart({ data }: { data: SpectrumData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<
    "combined" | "roll" | "pitch" | "motors" | "acc"
  >("combined");

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    let freqs: number[] = [];
    let mags: number[] = [];
    let label = "";
    let color = "";

    switch (selectedMetric) {
      case "combined":
        freqs = data.combined_error?.frequencies_hz || [];
        mags = data.combined_error?.magnitudes || [];
        label = "Error Combinado (Roll+Pitch)";
        color = "rgb(168, 85, 247)";
        break;
      case "roll":
        freqs = data.roll_error?.frequencies_hz || [];
        mags = data.roll_error?.magnitudes || [];
        label = "Error Roll";
        color = "rgb(34, 197, 94)";
        break;
      case "pitch":
        freqs = data.pitch_error?.frequencies_hz || [];
        mags = data.pitch_error?.magnitudes || [];
        label = "Error Pitch";
        color = "rgb(59, 130, 246)";
        break;
      case "motors":
        freqs = data.motors?.frequencies_hz || [];
        mags = data.motors?.magnitudes || [];
        label = "Motores (Promedio)";
        color = "rgb(234, 179, 8)";
        break;
      case "acc":
        freqs = data.accelerometer_magnitude?.frequencies_hz || [];
        mags = data.accelerometer_magnitude?.magnitudes || [];
        label = "Acelerómetro (Magnitud)";
        color = "rgb(236, 72, 153)";
        break;
    }

    // Limitar a frecuencias relevantes (0-25 Hz)
    const maxFreq = 25;
    const indices = freqs
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f <= maxFreq);
    const filteredFreqs = indices.map(({ f }) => f);
    const filteredMags = indices.map(({ i }) => mags[i]);

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: filteredFreqs.map((f) => f.toFixed(1)),
        datasets: [
          {
            label,
            data: filteredMags,
            borderColor: color,
            backgroundColor: `${color}20`,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: "#9ca3af" } },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (ctx) => `Magnitud: ${ctx.parsed.y.toFixed(4)}`,
              afterBody: (ctx) => {
                const freq = parseFloat(ctx[0].label);
                const peaks = [
                  ...(data.roll_error?.dominant_peaks || []),
                  ...(data.pitch_error?.dominant_peaks || []),
                ];
                const nearbyPeak = peaks.find(
                  (p) => Math.abs(p.frequency_hz - freq) < 0.5,
                );
                return nearbyPeak
                  ? `⚠️ Frecuencia dominante: ${nearbyPeak.frequency_hz.toFixed(1)} Hz`
                  : "";
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Frecuencia (Hz)", color: "#9ca3af" },
            ticks: { color: "#9ca3af" },
            grid: { color: "#374151" },
          },
          y: {
            title: { display: true, text: "Magnitud", color: "#9ca3af" },
            ticks: { color: "#9ca3af" },
            grid: { color: "#374151" },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [data, selectedMetric]);

  if (!data?.roll_error?.frequencies_hz?.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg">📊 No hay datos de espectro disponibles</p>
        <p className="text-sm mt-2">
          Se requieren al menos 10 muestras para el análisis FFT
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white">
            📈 Análisis Espectral
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {data.sample_count} muestras • {data.sample_rate_hz.toFixed(1)} Hz •{" "}
            {data.duration_sec.toFixed(1)} seg
          </p>
        </div>
      </div>

      {/* Selector de métrica */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "combined", label: "📊 Combinado", color: "purple" },
          { id: "roll", label: "🟢 Roll", color: "green" },
          { id: "pitch", label: "🔵 Pitch", color: "blue" },
          { id: "motors", label: "🟡 Motores", color: "yellow" },
          { id: "acc", label: "🩷 Acelerómetro", color: "pink" },
        ].map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetric(metric.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedMetric === metric.id
                ? `bg-${metric.color}-600 text-white shadow-lg`
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {/* Gráfico principal */}
      <div className="bg-gray-900 rounded-xl p-4">
        <canvas
          ref={canvasRef}
          height={300}
          style={{ maxHeight: "300px", width: "100%" }}
        />
      </div>

      {/* Picos dominantes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.roll_error?.dominant_peaks?.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-3">
              🟢 Roll - Frecuencias dominantes
            </h4>
            <div className="space-y-2">
              {data.roll_error.dominant_peaks.slice(0, 3).map((peak, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center border-b border-gray-800 pb-2"
                >
                  <div>
                    <span className="text-white font-bold">
                      {peak.frequency_hz.toFixed(2)} Hz
                    </span>
                    {peak.label && (
                      <span className="text-xs text-gray-500 ml-2">
                        {peak.label}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400">
                    Mag: {peak.magnitude.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.pitch_error?.dominant_peaks?.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-3">
              🔵 Pitch - Frecuencias dominantes
            </h4>
            <div className="space-y-2">
              {data.pitch_error.dominant_peaks.slice(0, 3).map((peak, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center border-b border-gray-800 pb-2"
                >
                  <div>
                    <span className="text-white font-bold">
                      {peak.frequency_hz.toFixed(2)} Hz
                    </span>
                    {peak.label && (
                      <span className="text-xs text-gray-500 ml-2">
                        {peak.label}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400">
                    Mag: {peak.magnitude.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Correlaciones */}
      {data.correlations?.length > 0 && (
        <div className="bg-purple-900/30 border border-purple-500/50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-purple-300 mb-3">
            🔗 Correlaciones detectadas
          </h4>
          <div className="space-y-2">
            {data.correlations.map((corr, i) => (
              <div key={i} className="flex justify-between items-center">
                <div>
                  <span className="text-white">{corr.description}</span>
                  <div className="text-xs text-gray-400 mt-1">
                    Fuentes: {corr.sources.join(" + ")} • Confianza:{" "}
                    {(corr.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                {corr.recommendation && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                    💡 {corr.recommendation}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendaciones */}
      {data.recommendations?.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-blue-300 mb-3">
            💡 Recomendaciones
          </h4>
          <ul className="space-y-1">
            {data.recommendations.map((rec, i) => (
              <li
                key={i}
                className="text-sm text-gray-300 flex items-start gap-2"
              >
                <span className="text-blue-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resumen ejecutivo */}
      <div className="bg-gray-800/50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">
          📋 Resumen Ejecutivo
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Frecuencia dominante Roll</div>
            <div className="text-green-400 font-bold">
              {data.roll_error?.dominant_peaks[0]?.frequency_hz?.toFixed(1) ||
                "N/A"}{" "}
              Hz
            </div>
          </div>
          <div>
            <div className="text-gray-500">Frecuencia dominante Pitch</div>
            <div className="text-blue-400 font-bold">
              {data.pitch_error?.dominant_peaks[0]?.frequency_hz?.toFixed(1) ||
                "N/A"}{" "}
              Hz
            </div>
          </div>
          <div>
            <div className="text-gray-500">Calidad estimada</div>
            <div className="text-yellow-400 font-bold">
              {data.roll_error?.dominant_peaks[0]?.magnitude < 0.1
                ? "✅ Buena"
                : "⚠️ Revisar"}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Correlaciones</div>
            <div className="text-purple-400 font-bold">
              {data.correlations?.length || 0} detectadas
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
