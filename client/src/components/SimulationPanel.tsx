import React, { useState } from "react";
import { useSimulation } from "../hooks/useSimulation";
import { SimulationConfig, TrajectoryType } from "../types/simulation";
import Plot from "react-plotly.js";

const TRAJECTORY_OPTIONS: { value: TrajectoryType; label: string }[] = [
  { value: "sinusoidal", label: "Sinusoidal (0.5 Hz)" },
  { value: "step", label: "Escalón" },
  { value: "composite", label: "Compuesto" },
  { value: "random", label: "Random Walk" },
  { value: "impulse", label: "Impulso" },
];

export const SimulationPanel: React.FC = () => {
  const { loading, error, result, runSimulation, downloadCSV } =
    useSimulation();

  const [config, setConfig] = useState<SimulationConfig>({
    trajectory_type: "sinusoidal",
    duration_sec: 30,
    amplitude_deg: 15,
    sample_rate_hz: 100,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleRun = async () => {
    await runSimulation(config);
  };

  const parseCSVForPlot = (csvData: string) => {
    const lines = csvData.trim().split("\n");
    const headers = lines[0].split(",");

    const time: number[] = [];
    const truth: number[] = [];
    const estimate: number[] = [];
    const error: number[] = [];
    const uncertainty: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(parseFloat);
      time.push(values[0]);
      truth.push(values[1]);
      estimate.push(values[2]);
      error.push(values[3]);
      uncertainty.push(values[4]);
    }

    return { time, truth, estimate, error, uncertainty };
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1
        style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}
      >
        🧪 Artheris SIL Simulation Validator
      </h1>
      <p style={{ color: "#64748b", marginBottom: "20px" }}>
        Software-in-the-Loop validation for Kalman filter uncertainty
      </p>

      {/* Panel de configuración */}
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginBottom: "15px" }}>Configuración de Simulación</h3>

        <div
          style={{
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}
            >
              Trayectoria
            </label>
            <select
              value={config.trajectory_type}
              onChange={(e) =>
                setConfig({
                  ...config,
                  trajectory_type: e.target.value as TrajectoryType,
                })
              }
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
              }}
            >
              {TRAJECTORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}
            >
              Duración (s)
            </label>
            <input
              type="number"
              value={config.duration_sec}
              onChange={(e) =>
                setConfig({
                  ...config,
                  duration_sec: parseFloat(e.target.value),
                })
              }
              min={5}
              max={120}
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                width: "100px",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}
            >
              Amplitud (°)
            </label>
            <input
              type="number"
              value={config.amplitude_deg}
              onChange={(e) =>
                setConfig({
                  ...config,
                  amplitude_deg: parseFloat(e.target.value),
                })
              }
              min={5}
              max={45}
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                width: "100px",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label
              style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}
            >
              Sample Rate (Hz)
            </label>
            <input
              type="number"
              value={config.sample_rate_hz}
              onChange={(e) =>
                setConfig({
                  ...config,
                  sample_rate_hz: parseFloat(e.target.value),
                })
              }
              min={50}
              max={200}
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                width: "100px",
              }}
            />
          </div>

          <button
            onClick={handleRun}
            disabled={loading}
            style={{
              padding: "10px 24px",
              background: loading ? "#94a3b8" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginLeft: "auto",
            }}
          >
            {loading ? "⏳ Ejecutando..." : "▶ Ejecutar Simulación"}
          </button>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            marginTop: "15px",
            background: "none",
            border: "none",
            color: "#2563eb",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          {showAdvanced ? "▼ Ocultar" : "▶ Mostrar"} parámetros avanzados
          (U1-U6)
        </button>

        {showAdvanced && (
          <div
            style={{
              marginTop: "15px",
              padding: "15px",
              background: "#f8fafc",
              borderRadius: "8px",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "10px",
            }}
          >
            <div>
              <label style={{ fontSize: "11px" }}>U1: Ruido Acel (g/√Hz)</label>
              <input
                type="number"
                step="0.0001"
                style={{ width: "100%", padding: "5px" }}
                value={config.accel_noise || 0.0004}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    accel_noise: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label style={{ fontSize: "11px" }}>
                U2: Ruido Gyro (°/s/√Hz)
              </label>
              <input
                type="number"
                step="0.001"
                style={{ width: "100%", padding: "5px" }}
                value={config.gyro_noise || 0.015}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    gyro_noise: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label style={{ fontSize: "11px" }}>U3: Sesgo Gyro (°/s)</label>
              <input
                type="number"
                step="0.1"
                style={{ width: "100%", padding: "5px" }}
                value={config.gyro_bias || 0.5}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    gyro_bias: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label style={{ fontSize: "11px" }}>U4: Desalineación (°)</label>
              <input
                type="number"
                step="0.1"
                style={{ width: "100%", padding: "5px" }}
                value={config.misalignment || 0.5}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    misalignment: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label style={{ fontSize: "11px" }}>U5: Factor Vibración</label>
              <input
                type="number"
                step="0.01"
                style={{ width: "100%", padding: "5px" }}
                value={config.vibration_factor || 0.02}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    vibration_factor: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label style={{ fontSize: "11px" }}>U6: Jitter Ratio</label>
              <input
                type="number"
                step="0.01"
                style={{ width: "100%", padding: "5px" }}
                value={config.jitter || 0.01}
                onChange={(e) =>
                  setConfig({ ...config, jitter: parseFloat(e.target.value) })
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "8px",
            marginBottom: "20px",
            borderLeft: "4px solid #ef4444",
          }}
        >
          ❌ Error: {error}
        </div>
      )}

      {result && (
        <div
          style={{
            padding: "12px 16px",
            background: result.success ? "#dcfce7" : "#fef3c7",
            color: result.success ? "#166534" : "#92400e",
            borderRadius: "8px",
            marginBottom: "20px",
            borderLeft: `4px solid ${result.success ? "#22c55e" : "#f59e0b"}`,
          }}
        >
          {result.summary_text}
        </div>
      )}

      {/* Resultados */}
      {result && (
        <>
          {/* Métricas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "15px",
              marginBottom: "20px",
            }}
          >
            <MetricCard
              label="RMSE"
              value={result.metrics.rmse_deg.toFixed(3)}
              unit="°"
            />
            <MetricCard
              label="Error Máximo"
              value={result.metrics.max_error_deg.toFixed(3)}
              unit="°"
            />
            <MetricCard
              label="Cobertura 2σ"
              value={result.metrics.coverage_2sigma.toFixed(1)}
              unit="%"
            />
            <MetricCard
              label="Validación"
              value={result.metrics.validation_passed ? "✅ PASÓ" : "❌ FALLÓ"}
              unit=""
            />
          </div>

          {/* Gráficos */}
          {result.csv_data && (
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <SimulationPlots csvData={result.csv_data} />
            </div>
          )}

          {/* Recomendaciones */}
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ marginBottom: "15px" }}>💡 Recomendaciones</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {result.metrics.recommendations.map((rec, i) => (
                <li
                  key={i}
                  style={{
                    padding: "8px 0",
                    borderBottom:
                      i < result.metrics.recommendations.length - 1
                        ? "1px solid #e2e8f0"
                        : "none",
                  }}
                >
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Botón descargar */}
          <button
            onClick={() => downloadCSV(result.csv_data)}
            style={{
              padding: "10px 20px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ⬇ Descargar CSV completo
          </button>
        </>
      )}
    </div>
  );
};

// Componente auxiliar para métricas
const MetricCard: React.FC<{ label: string; value: string; unit: string }> = ({
  label,
  value,
  unit,
}) => (
  <div
    style={{
      background: "white",
      padding: "20px",
      borderRadius: "12px",
      textAlign: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    }}
  >
    <div style={{ fontSize: "32px", fontWeight: "bold", color: "#0f172a" }}>
      {value}
    </div>
    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "5px" }}>
      {label} {unit && `(${unit})`}
    </div>
  </div>
);

// Componente de gráficos
const SimulationPlots: React.FC<{ csvData: string }> = ({ csvData }) => {
  const parseData = () => {
    const lines = csvData.trim().split("\n");
    const time: number[] = [];
    const truth: number[] = [];
    const estimate: number[] = [];
    const error: number[] = [];
    const uncertainty: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(parseFloat);
      time.push(values[0]);
      truth.push(values[1]);
      estimate.push(values[2]);
      error.push(values[3]);
      uncertainty.push(values[4]);
    }

    // Downsample para gráficos más ligeros (máx 500 puntos)
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
  const upperBound = data.error.map((e, i) => 2 * data.uncertainty[i]);
  const lowerBound = data.error.map((e, i) => -2 * data.uncertainty[i]);

  return (
    <>
      <Plot
        data={[
          {
            x: data.time,
            y: data.truth,
            type: "scatter",
            mode: "lines",
            name: "Ground Truth",
            line: { color: "#000000", width: 2 },
          },
          {
            x: data.time,
            y: data.estimate,
            type: "scatter",
            mode: "lines",
            name: "Kalman Estimate",
            line: { color: "#2563eb", width: 2 },
          },
        ]}
        layout={{
          title: "Ángulo Roll: Real vs Estimado",
          xaxis: { title: "Tiempo (s)" },
          yaxis: { title: "Ángulo (°)" },
          height: 350,
          margin: { t: 40, r: 20, b: 40, l: 50 },
        }}
        style={{ width: "100%" }}
        config={{ responsive: true }}
      />

      <Plot
        data={[
          {
            x: data.time,
            y: data.error,
            type: "scatter",
            mode: "lines",
            name: "Error",
            line: { color: "#dc2626", width: 1 },
          },
          {
            x: data.time,
            y: upperBound,
            type: "scatter",
            mode: "lines",
            name: "+2σ",
            line: { color: "#9ca3af", width: 1, dash: "dash" },
          },
          {
            x: data.time,
            y: lowerBound,
            type: "scatter",
            mode: "lines",
            name: "-2σ",
            line: { color: "#9ca3af", width: 1, dash: "dash" },
          },
        ]}
        layout={{
          title: "Error vs Incertidumbre (banda 2σ)",
          xaxis: { title: "Tiempo (s)" },
          yaxis: { title: "Error (°)" },
          height: 300,
          margin: { t: 40, r: 20, b: 40, l: 50 },
        }}
        style={{ width: "100%", marginTop: "20px" }}
        config={{ responsive: true }}
      />
    </>
  );
};
