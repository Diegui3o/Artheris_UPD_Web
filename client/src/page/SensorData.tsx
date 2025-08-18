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

const colores: Record<string, string> = {
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

const MultiSensorDashboard = () => {
  const [data, dispatch] = useReducer(dataReducer, [] as AnglesData[]);
  const [selectedChart, setSelectedChart] = React.useState("Roll");

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

  const renderLineChart = useCallback(
    (keys: AngleKeys[], title: string) => {
      const chartData = {
        labels: data.map((d: AnglesData) => d.time || ""),
        datasets: keys.map((key) => ({
          label: key,
          data: data.map((d: AnglesData) =>
            typeof d[key] === "number" ? d[key] : null
          ),
          borderColor: colores[key] || "#FF0000", // Color rojo si no existe
          backgroundColor: (colores[key] || "#FF0000") + "33",
          borderWidth: 3, // Aumentado para mejor visibilidad
          tension: 0.4,
          pointRadius: 2, // Aumentado para mejor visibilidad
          pointHoverRadius: 5,
          fill: false,
        })),
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
                  display: false,
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
                    color: "#fff",
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
    (keys: AngleKeys[], title: string) => {
      const lastData = data[data.length - 1];
      const chartData = {
        labels: keys,
        datasets: [
          {
            label: title,
            data: keys.map((key) =>
              typeof lastData?.[key] === "number" ? lastData[key] : 0
            ),
            backgroundColor: keys.map((key) => colores[key]),
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
          Seleccionar gráfica:
        </label>
        <select
          id="chartSelect"
          onChange={(e) => setSelectedChart(e.target.value)}
          value={selectedChart}
          style={{
            color: "black",
            backgroundColor: "white",
            padding: "5px",
            borderRadius: "7px",
            fontFamily: "helvetica",
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
        </select>
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
