import React, { useReducer, useCallback, useEffect } from "react";
import { AnglesData } from "../types/angles";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const NON_NUMERIC_KEYS: Array<keyof AnglesData> = [
  "modo",
  "modoActual",
  "time",
  "throttle",
];

const colores: Partial<Record<keyof AnglesData, string>> = {
  AngleRoll: "#b07acc",
  pitch: "#3F51B5",
  yaw: "#FF5722",
  RateRoll: "#1EA2E5",
  RatePitch: "#F4ab00",
  RateYaw: "#F4DCCA",
  GyroXdps: "#4236ab",
  GyroYdps: "#345aef",
  GyroZdps: "#3cd44d",
  AngleRoll_est: "#1EA7E5",
  KalmanAnglePitch: "#a73935",
  InputThrottle: "#FDD835",
  InputRoll: "#43A047",
  InputPitch: "#FB8B00",
  InputYaw: "#5E35B1",
  MotorInput1: "#F44336",
  MotorInput2: "#d84a75",
  MotorInput3: "#3F5BB5",
  MotorInput4: "#009688",
  Altura: "#00BCD4",
  tau_x: "#FF9800",
  tau_y: "#9C27B0",
  tau_z: "#8BC34A",
  error_phi: "#E91E63",
  error_theta: "#3F51B5",
};

const getAvailableNumericKeys = (
  rows: AnglesData[]
): Array<keyof AnglesData> => {
  const found = new Set<keyof AnglesData>();
  for (const row of rows) {
    for (const k in row) {
      const key = k as keyof AnglesData;
      if (NON_NUMERIC_KEYS.includes(key)) continue;
      const v = row[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        found.add(key);
      }
    }
  }
  // Orden alfabético para una UI estable
  return Array.from(found).sort((a, b) => String(a).localeCompare(String(b)));
};

type AngleKeys = keyof AnglesData;

type Action = { type: "ADD_DATA"; payload: AnglesData[] };

const dataReducer = (state: AnglesData[], action: Action): AnglesData[] => {
  switch (action.type) {
    case "ADD_DATA": {
      const newData = [...state, ...action.payload];
      return newData.slice(-130);
    }
    default:
      return state;
  }
};

const MultiSensorDashboard: React.FC = () => {
  const [selectedChart, setSelectedChart] = React.useState("Roll");
  const [customKeys, setCustomKeys] = React.useState<Array<keyof AnglesData>>([]);
  const [showCustomChart, setShowCustomChart] = React.useState(false);
  const [data, dispatch] = useReducer(dataReducer, [] as AnglesData[]);

  // Recalculate available numeric keys when data changes
  const availableNumericKeys = React.useMemo(
    () => getAvailableNumericKeys(data),
    [data]
  );

  // Clean up custom keys if they're no longer in available keys
  React.useEffect(() => {
    setCustomKeys((prev) =>
      prev.filter((k) => availableNumericKeys.includes(k))
    );
  }, [availableNumericKeys]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:9001");

    socket.onopen = () => console.log("WebSocket conectado");
    socket.onclose = () => console.log("WebSocket desconectado");

    socket.onmessage = (event) => {
      try {
        const message = event.data;
        let telemetryData: AnglesData;

        try {
          const data = JSON.parse(message);

          // Handle both formats of the message
          if (data && typeof data === "object") {
            // Case 1: Message has type and payload
            if (data.type === "telemetry" && data.payload) {
              telemetryData = data.payload;
            }
            // Case 2: Message is the telemetry data directly
            else if (
              "roll" in data ||
              "pitch" in data ||
              "yaw" in data ||
              "MotorInput1" in data ||
              "MotorInput2" in data ||
              "MotorInput3" in data ||
              "MotorInput4" in data
            ) {
              telemetryData = data;
            } else {
              console.log("📦 Mensaje recibido (formato no reconocido):", data);
              return;
            }

            // Add timestamp if not present
            const dataWithTime = {
              ...telemetryData,
              time: telemetryData.time || new Date().toLocaleTimeString(),
            };
            dispatch({ type: "ADD_DATA", payload: [dataWithTime] });
          }
        } catch (error) {
          console.error("❌ Error al procesar el mensaje:", error);
        }
      } catch (err) {
        console.error("❌ Error en el manejador de mensajes:", err);
      }
    };

    return () => {
      socket.close();
    };
  }, [dispatch]);

  // Generate a consistent color for a key using a hash function
  const getColorForKey = (key: string) => {
    // Predefined color palette with good contrast
    const colorPalette = [
      '#4E79A7', // blue
      '#F28E2B', // orange
      '#E15759', // red
      '#76B7B2', // teal
      '#59A14F', // green
      '#EDC948', // yellow
      '#B07AA1', // purple
      '#FF9DA7', // pink
      '#9C755F', // brown
      '#BAB0AC', // gray
      '#17BECF', // cyan
      '#BCBD22', // olive
    ];
    
    // Use a simple hash to get a consistent color for each key
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use the hash to select a color from the palette
    const colorIndex = Math.abs(hash) % colorPalette.length;
    return colorPalette[colorIndex];
  };

  const renderLineChart = useCallback(
    (keys: Array<keyof AnglesData>, title: string) => {
      if (!data.length) return null;

      const chartData = {
        labels: Array.from({ length: data.length }, (_, i) => i.toString()),
        datasets: keys.map((key) => {
          const color = getColorForKey(key as string);
          return {
            label: key,
            data: data.map((d) => d[key] as number),
            borderColor: color,
            backgroundColor: `${color}40`,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: true,
          };
        }),
      };

      return (
        <div style={{ width: "100%", height: "320px", marginBottom: "40px" }}>
          <h3 style={{ marginLeft: "10px" }}>{title}</h3>
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: "index",
                intersect: false,
              },
              plugins: {
                legend: {
                  position: "top",
                  labels: {
                    color: "#fff",
                    font: {
                      size: 14,
                      family: "Calibri, sans-serif",
                      weight: 500,
                    },
                  },
                },
                tooltip: {
                  mode: "index",
                  intersect: false,
                },
              },
              scales: {
                x: {
                  display: false,
                  grid: {
                    display: false,
                  },
                },
                y: {
                  ticks: {
                    color: "#666",
                    font: {
                      size: 12,
                    },
                  },
                  grid: {
                    color: "rgba(255, 255, 255, 0.1)",
                    display: true,
                  },
                },
              },
              animation: false,
            }}
          />
        </div>
      );
    },
    [data]
  );

  const renderBarChart = useCallback(
    (keys: Array<keyof AnglesData>, title: string) => {
      if (!data.length) return null;

      const lastData = data[data.length - 1];
      const validKeys = keys.filter((key) => {
        const value = lastData[key];
        return typeof value === "number" && Number.isFinite(value);
      });

      if (validKeys.length === 0) {
        return (
          <div style={{ padding: "20px", color: "#fff", textAlign: "center" }}>
            No hay datos numéricos disponibles para mostrar.
          </div>
        );
      }

      const chartData = {
        labels: validKeys,
        datasets: [
          {
            label: title,
            data: validKeys.map((key) => lastData[key] as number),
            backgroundColor: validKeys.map(
              (key) =>
                colores[key as keyof typeof colores] ||
                `#${Math.floor(Math.random() * 16777215).toString(16)}`
            ),
            borderRadius: 6,
            barThickness: 40,
          },
        ],
      };

      return (
        <div style={{ width: "100%", height: "250px", marginBottom: "40px" }}>
          <h3 style={{ marginLeft: "10px" }}>{title}</h3>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              plugins: {
                legend: {
                  display: false,
                  labels: {
                    color: "#fff",
                    font: { size: 12 },
                  },
                },
                tooltip: {
                  mode: "index",
                  intersect: false,
                },
              },
              scales: {
                x: {
                  ticks: { color: "#ccc", font: { size: 12 } },
                  grid: { display: false },
                },
                y: {
                  ticks: {
                    color: "#ccc",
                    font: { size: 12 },
                  },
                  grid: {
                    color: "#444",
                  },
                },
              },
            }}
          />
        </div>
      );
    },
    [data]
  );

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="chartSelect" style={{ marginRight: "10px" }}>
          Select chart:
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <select
            id="chartSelect"
            value={selectedChart}
            onChange={(e) => setSelectedChart(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid #666",
              backgroundColor: "#222",
              color: "#fff",
              fontSize: "14px",
              cursor: "pointer",
              outline: "none",
              fontFamily: "helvetica",
              width: "100%",
              maxWidth: "300px"
            }}
          >
            <option value="Roll">Roll Comparación</option>
            <option value="Pitch">Pitch Comparación</option>
            <option value="Rate">Rate Comparación</option>
            <option value="Tau Comparación">Tau Comparación</option>
            <option value="Input">Controles de Entrada</option>
            <option value="Motor">Motores</option>
            <option value="Altura">Altura</option>
            <option value="Errores">Errores</option>
            <option value="Personalizado">Personalizado</option>
          </select>
          
          {selectedChart === "Personalizado" && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                  onClick={() => setShowCustomChart(true)}
                  disabled={customKeys.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: customKeys.length > 0 ? '#4CAF50' : '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: customKeys.length > 0 ? 'pointer' : 'not-allowed',
                    opacity: customKeys.length > 0 ? 1 : 0.7
                  }}
                >
                  Graficar
                </button>
                <button
                  onClick={() => {
                    setCustomKeys([]);
                    setShowCustomChart(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Reiniciar
                </button>
              </div>
              
              {customKeys.length === 0 && (
                <div style={{ padding: '12px', color: '#ddd', marginTop: '10px' }}>
                  Selecciona al menos una serie y haz clic en 'Graficar'.
                </div>
              )}
              
              {showCustomChart && customKeys.length > 0 && (
                <div style={{ width: '100%', minHeight: '300px', marginTop: '10px' }}>
                  {renderLineChart(customKeys as AngleKeys[], "Gráfico personalizado")}
                </div>
              )}
            </div>
          )}
        </div>
        {selectedChart === "Personalizado" && (
          <div style={{ margin: "10px 0 20px" }}>
            <label
              htmlFor="seriesSelect"
              style={{ display: "block", marginBottom: 8 }}
            >
              Series disponibles (solo claves con números detectados):
            </label>
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: "5px", fontWeight: "500" }}>
                  Series disponibles:
                </div>
                <select
                  id="availableSeries"
                  multiple
                  size={Math.min(10, Math.max(4, availableNumericKeys.length))}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #666",
                    backgroundColor: "#222",
                    color: "#fff",
                    fontFamily: "helvetica",
                  }}
                >
                  {availableNumericKeys
                    .filter((k) => !customKeys.includes(k))
                    .map((k) => (
                      <option
                        key={String(k)}
                        value={String(k)}
                        onDoubleClick={() =>
                          setCustomKeys((prev) => [...prev, k])
                        }
                        style={{ padding: "4px", cursor: "pointer" }}
                      >
                        {String(k)}
                      </option>
                    ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                <button
                  onClick={() => {
                    const select = document.getElementById(
                      "availableSeries"
                    ) as HTMLSelectElement;
                    const selected = Array.from(select.selectedOptions).map(
                      (o) => o.value as keyof AnglesData
                    );
                    setCustomKeys((prev) => [...prev, ...selected]);
                  }}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#3F51B5",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  ➜
                </button>
                <button
                  onClick={() => {
                    const select = document.getElementById(
                      "selectedSeries"
                    ) as HTMLSelectElement;
                    const selected = Array.from(select.selectedOptions).map(
                      (o) => o.value as keyof AnglesData
                    );
                    setCustomKeys((prev) =>
                      prev.filter((k) => !selected.includes(k))
                    );
                  }}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  ←
                </button>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: "5px", fontWeight: "500" }}>
                  Series seleccionadas:
                </div>
                <select
                  id="selectedSeries"
                  multiple
                  size={Math.min(10, Math.max(4, customKeys.length))}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #666",
                    backgroundColor: "#222",
                    color: "#fff",
                    fontFamily: "helvetica",
                  }}
                >
                  {customKeys.map((k) => (
                    <option
                      key={String(k)}
                      value={String(k)}
                      onDoubleClick={() =>
                        setCustomKeys((prev) => prev.filter((key) => key !== k))
                      }
                      style={{
                        padding: "4px",
                        cursor: "pointer",
                        backgroundColor:
                          colores[k as keyof typeof colores] || "#3F51B5",
                        color: "#fff",
                        borderRadius: "3px",
                        margin: "2px 0",
                      }}
                    >
                      {String(k)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 13, marginTop: 10, color: "#ddd" }}>
              <div>• Haz doble clic en una serie para añadirla o quitarla</div>
              <div>• Usa los botones para mover series entre las listas</div>
              <div>• Las series seleccionadas se mostrarán en el gráfico</div>
            </div>
          </div>
        )}
      </div>

      {selectedChart === "Roll" &&
        renderLineChart(["AngleRoll", "AngleRoll_est"], "Roll Comparación")}
      {selectedChart === "Pitch" &&
        renderLineChart(["AnglePitch", "AnglePitch_est"], "Pitch Comparación")}
      {selectedChart === "Rate" &&
        renderLineChart(
          ["RateRoll", "RatePitch", "RateYaw"],
          "Rate Comparación"
        )}
      {selectedChart === "Tau Comparación" &&
        renderLineChart(["tau_x", "tau_y", "tau_z"], "Tau Comparación")}
      {selectedChart === "Input" &&
        renderBarChart(
          ["InputThrottle", "InputRoll", "InputPitch", "InputYaw"],
          "Controles de Entrada"
        )}
      {selectedChart === "Motor" &&
        renderBarChart(
          ["MotorInput1", "MotorInput2", "MotorInput3", "MotorInput4"],
          "Motores"
        )}
      {selectedChart === "Altura" && renderLineChart(["Altura"], "Altura")}
      {selectedChart === "Errores" &&
        renderLineChart(["error_phi", "error_theta"], "Errores")}
    </div>
  );
};

export default React.memo(MultiSensorDashboard);
