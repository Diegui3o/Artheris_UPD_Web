// client/src/components/simulation/SimulationPlots.tsx

import React from "react";
import { Card, CardContent, Typography } from "@mui/material";
import Plot from "react-plotly.js";

interface Props {
  csvData: string;
}

export const SimulationPlots: React.FC<Props> = ({ csvData }) => {
  const parseData = () => {
    const lines = csvData.trim().split("\n");
    const time: number[] = [];
    const truth: number[] = [];
    const estimate: number[] = [];
    const error: number[] = [];
    const uncertainty: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(parseFloat);
      if (values.length >= 5) {
        time.push(values[0]);
        truth.push(values[1]);
        estimate.push(values[2]);
        error.push(values[3]);
        uncertainty.push(values[4]);
      }
    }

    // Downsample para rendimiento (máx 500 puntos)
    const maxPoints = 500;
    if (time.length > maxPoints) {
      const step = Math.floor(time.length / maxPoints);
      return {
        time: time.filter((_, i) => i % step === 0),
        truth: truth.filter((_, i) => i % step === 0),
        estimate: estimate.filter((_, i) => i % step === 0),
        error: error.filter((_, i) => i % step === 0),
        uncertainty: uncertainty.filter((_, i) => i % step === 0),
      };
    }

    return { time, truth, estimate, error, uncertainty };
  };

  const data = parseData();

  // Calcular bandas de incertidumbre
  const upperBound2 = data.estimate.map(
    (est, i) => est + 2 * data.uncertainty[i],
  );
  const lowerBound2 = data.estimate.map(
    (est, i) => est - 2 * data.uncertainty[i],
  );

  const upperBound1 = data.estimate.map((est, i) => est + data.uncertainty[i]);
  const lowerBound1 = data.estimate.map((est, i) => est - data.uncertainty[i]);

  const upperErrorBound = data.error.map((_, i) => 2 * data.uncertainty[i]);
  const lowerErrorBound = data.error.map((_, i) => -2 * data.uncertainty[i]);

  const plotTheme = {
    paper_bgcolor: "#1e293b",
    plot_bgcolor: "#1e293b",
    font: { color: "#fff" },
    xaxis: {
      gridcolor: "#374151",
      title: { text: "Tiempo (s)", font: { color: "#9ca3af" } },
    },
    yaxis: {
      gridcolor: "#374151",
      title: { font: { color: "#9ca3af" } },
    },
    margin: { t: 40, r: 20, b: 40, l: 50 },
    legend: {
      orientation: "h" as const,
      y: -0.2,
      font: { color: "#fff" },
    },
  };

  return (
    <>
      {/* GRÁFICA 1: Ángulo Real vs Estimado + Banda de Incertidumbre */}
      <Card sx={{ backgroundColor: "#1e293b", mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: "#fff", mb: 2 }}>
            📈 Ángulo Roll: Real vs Estimado (con banda de incertidumbre ±2σ)
          </Typography>
          <Plot
            data={[
              // Banda de incertidumbre 2σ (gris)
              {
                x: [...data.time, ...data.time.slice().reverse()],
                y: [...upperBound2, ...lowerBound2.slice().reverse()],
                type: "scatter",
                mode: "lines",
                fill: "toself",
                fillcolor: "rgba(128, 128, 128, 0.3)",
                line: { color: "transparent" },
                name: "±2σ uncertainty",
                showlegend: true,
              },
              // Ground Truth (negro/blanco)
              {
                x: data.time,
                y: data.truth,
                type: "scatter",
                mode: "lines",
                name: "Ground Truth",
                line: { color: "#ffffff", width: 2 },
              },
              // Kalman Estimate (azul)
              {
                x: data.time,
                y: data.estimate,
                type: "scatter",
                mode: "lines",
                name: "Kalman Estimate",
                line: { color: "#3b82f6", width: 2 },
              },
            ]}
            layout={{
              ...plotTheme,
              height: 400,
              yaxis: { ...plotTheme.yaxis, title: "Ángulo Roll (°)" },
              showlegend: true,
            }}
            style={{ width: "100%" }}
            config={{ responsive: true, displayModeBar: true }}
          />
        </CardContent>
      </Card>

      {/* GRÁFICA 2: Error vs Incertidumbre */}
      <Card sx={{ backgroundColor: "#1e293b" }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: "#fff", mb: 2 }}>
            📉 Error de Estimación vs Límites de Incertidumbre (±2σ)
          </Typography>
          <Plot
            data={[
              // Banda de incertidumbre 2σ (gris)
              {
                x: [...data.time, ...data.time.slice().reverse()],
                y: [...upperErrorBound, ...lowerErrorBound.slice().reverse()],
                type: "scatter",
                mode: "lines",
                fill: "toself",
                fillcolor: "rgba(128, 128, 128, 0.2)",
                line: { color: "transparent" },
                name: "±2σ bounds",
                showlegend: true,
              },
              // Error real (rojo)
              {
                x: data.time,
                y: data.error,
                type: "scatter",
                mode: "lines",
                name: "Estimation Error",
                line: { color: "#ef4444", width: 1.5 },
              },
              // Línea cero (gris punteada)
              {
                x: data.time,
                y: Array(data.time.length).fill(0),
                type: "scatter",
                mode: "lines",
                name: "Zero error",
                line: { color: "#6b7280", width: 0.5, dash: "dot" },
                showlegend: false,
              },
            ]}
            layout={{
              ...plotTheme,
              height: 300,
              yaxis: { ...plotTheme.yaxis, title: "Error (°)" },
              showlegend: true,
            }}
            style={{ width: "100%" }}
            config={{ responsive: true, displayModeBar: true }}
          />
        </CardContent>
      </Card>
    </>
  );
};
