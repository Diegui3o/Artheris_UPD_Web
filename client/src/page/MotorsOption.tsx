import { useState, useEffect, useCallback } from "react";
import { FaPlus } from "react-icons/fa";
import { useWebSocket } from "../hooks/useWebSocket";

type MotorKey = `motor${number}`;
type MotorState = Record<MotorKey, boolean>;

export default function MotorControl() {
  const [motorStatus, setMotorStatus] = useState<MotorState>({
    motor1: false,
  });
  const [activeMotors, setActiveMotors] = useState<number>(1);
  const { isConnected, sendMessage } = useWebSocket("ws://localhost:9001");

  const toggleMotor = (motor: MotorKey, state: boolean) => {
    if (!isConnected) {
      console.error("No WebSocket connection");
      return;
    }

    // Update UI immediately (optimistic update)
    setMotorStatus((prev) => ({
      ...prev,
      [motor]: state,
    }));

    // Send command via WebSocket
    sendMessage("MOTOR_CONTROL", {
      motor: motor.replace("motor", ""), // Send as number
      state: state ? "ON" : "OFF",
    });
  };

  const addMotor = () => {
    const newMotorNum = activeMotors + 1;
    setActiveMotors(newMotorNum);
    setMotorStatus((prev) => ({
      ...prev,
      [`motor${newMotorNum}`]: false,
    }));
  };

  const removeMotor = () => {
    if (activeMotors > 1) {
      const motorKey = `motor${activeMotors}` as MotorKey;
      const motorNumber = activeMotors;

      // Create a new state without the motor
      const newState = { ...motorStatus };
      const wasOn = newState[motorKey];
      delete newState[motorKey];

      // Update state in one go to avoid race conditions
      setActiveMotors((prev) => prev - 1);
      setMotorStatus(newState as MotorState);

      // Turn off the motor after state update
      if (isConnected && wasOn) {
        sendMessage("MOTOR_CONTROL", {
          motor: motorNumber.toString(),
          state: "OFF",
        });
      }
    }
  };

  const toggleAllMotors = (state: boolean) => {
    if (!isConnected) return;

    // Create a new state with all motors updated
    const newState = { ...motorStatus };

    // Update all active motors
    for (let i = 1; i <= activeMotors; i++) {
      const motorKey = `motor${i}` as MotorKey;
      newState[motorKey] = state;

      // Send command for each motor
      sendMessage("MOTOR_CONTROL", {
        motor: i.toString(),
        state: state ? "ON" : "OFF",
      });
    }

    setMotorStatus(newState);
  };

  // Motor colors based on position
  const getMotorColor = useCallback(
    (motorNum: number, opacity: number = 1): string => {
      const colors = [
        "rgba(99, 102, 241, {opacity})", // Indigo
        "rgba(139, 92, 246, {opacity})", // Violet
        "rgba(236, 72, 153, {opacity})", // Pink
        "rgba(249, 115, 22, {opacity})", // Orange
        "rgba(16, 185, 129, {opacity})", // Emerald
        "rgba(234, 179, 8, {opacity})", // Yellow
      ];
      const baseColor = colors[(motorNum - 1) % colors.length];
      return baseColor.replace("{opacity}", opacity.toString());
    },
    []
  );

  const getMotorColorClass = useCallback((motorNum: number): string => {
    const colors = [
      "bg-indigo-500",
      "bg-violet-500",
      "bg-pink-500",
      "bg-orange-500",
      "bg-emerald-500",
      "bg-yellow-500",
    ];
    return colors[(motorNum - 1) % colors.length];
  }, []);

  // Estado de conexión
  useEffect(() => {
    if (!isConnected) {
      console.log("Intentando conectar con el servidor WebSocket...");
    }
  }, [isConnected]);

  return (
    <div className="flex flex-col w-full space-y-4">
      {/* Header */}
      <div className="w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Control de Motores
            </h1>
            <p className="text-gray-400 mt-1">
              Gestiona los motores del sistema
            </p>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              isConnected
                ? "bg-green-900/30 text-green-400"
                : "bg-red-900/30 text-red-400"
            }`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              } animate-pulse`}
            ></div>
            <span className="text-sm font-medium">
              {isConnected ? "Conectado" : "Desconectado"}
            </span>
          </div>
        </div>
      </div>

      {/* Control para todos los motores */}
      <div className="w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Control General
            </h2>
            <p className="text-gray-400 text-sm">
              Gestiona todos los motores simultáneamente
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => toggleAllMotors(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium 
                        disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              disabled={!isConnected}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10a1 1 0 01-1.64 0l-7-10A1 1 0 014 7h4V2a1 1 0 011.707-.708l1.593 1.593z"
                  clipRule="evenodd"
                />
              </svg>
              Encender todos
            </button>
            <button
              onClick={() => toggleAllMotors(false)}
              className="px-5 py-2.5 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white rounded-lg font-medium 
                        disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              disabled={!isConnected}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Apagar todos
            </button>
          </div>
        </div>
      </div>

      {/* Controles individuales */}
      <div className="w-full">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-white">Motores</h2>
          <span className="text-xs text-gray-400">{activeMotors} motores</span>
        </div>
        <div className="grid grid-cols-1 gap-4 w-full">
          {Array.from({ length: activeMotors }).map((_, index) => {
            const motorNum = index + 1;
            const motorKey = `motor${motorNum}` as MotorKey;
            const isOn = motorStatus[motorKey];

            return (
              <div
                key={motorKey}
                className={`rounded-xl p-4 transition-all duration-300 w-full min-h-[120px] flex flex-row items-center gap-6 ${
                  isOn ? "shadow-lg" : "hover:bg-gray-700/90"
                }`}
                style={{
                  backgroundColor: isOn
                    ? getMotorColor(motorNum, 0.9)
                    : "rgba(55, 65, 81, 0.8)",
                  border: isOn
                    ? `1px solid ${getMotorColor(motorNum, 0.4)}`
                    : "1px solid rgba(75, 85, 99, 0.3)",
                  transform: isOn ? "translateY(-2px)" : "none",
                  boxShadow: isOn
                    ? `0 4px 20px -5px ${getMotorColor(motorNum, 0.3)}`
                    : "none",
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-base font-semibold text-white">
                    Motor {motorNum}
                  </span>
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{
                      backgroundColor: isOn
                        ? getMotorColor(motorNum, 1)
                        : "rgb(238, 108, 108)",
                    }}
                  ></div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-semibold text-white">
                      Motor {motorNum}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{
                        backgroundColor: isOn
                          ? getMotorColor(motorNum, 1)
                          : "rgb(248, 113, 113)",
                      }}
                    ></div>
                  </div>

                  <div className="relative h-3 w-full bg-gray-600/50 rounded-full overflow-hidden mb-4">
                    <div
                      style={{
                        width: isOn ? "100%" : "0",
                        backgroundColor: isOn
                          ? getMotorColor(motorNum, 0.8)
                          : "rgb(97, 234, 90)",
                        transition: "all 0.5s ease",
                        height: "100%",
                        borderRadius: "9999px",
                      }}
                    ></div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleMotor(motorKey, true)}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg font-medium transition-all backdrop-blur-sm min-w-[100px] ${
                        isOn
                          ? "bg-white/10 text-white/90 border border-white/20"
                          : `bg-white/5 text-white/90 hover:bg-white/10 border border-white/10 hover:border-white/20 ${getMotorColorClass(
                              motorNum
                            ).replace("bg-", "hover:bg-")}/20`
                      } ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={!isConnected || isOn}
                      style={{
                        textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        boxShadow: isOn
                          ? `0 0 12px 2px ${getMotorColor(motorNum, 0.3)}`
                          : "none",
                        transition: "all 0.3s ease, box-shadow 0.2s ease",
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {isOn ? (
                          <>
                            <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                            <span>Encendido</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-block w-2 h-2 rounded-full bg-white/50"></span>
                            <span>Encender</span>
                          </>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => toggleMotor(motorKey, false)}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg font-medium transition-all backdrop-blur-sm min-w-[100px] ${
                        !isOn
                          ? "bg-white/5 text-white/90 border border-white/10"
                          : "bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30"
                      } ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={!isConnected || !isOn}
                      style={{
                        textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        transition: "all 0.3s ease, box-shadow 0.2s ease",
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {!isOn ? (
                          <span className="inline-block w-2 h-2 rounded-full bg-white/50"></span>
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
                        )}
                        <span>Apagar</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controles de motores */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={addMotor}
          disabled={!isConnected}
          className="flex-1 py-1.5 text-xs bg-blue-600/80 hover:bg-blue-700 border border-blue-500/50 rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaPlus className="text-xs" />
          Añadir motor
        </button>
        {activeMotors > 1 && (
          <button
            onClick={removeMotor}
            disabled={!isConnected}
            className="flex-1 py-1.5 text-xs bg-red-600/80 hover:bg-red-700 border border-red-500/50 rounded flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Quitar motor
          </button>
        )}
      </div>
    </div>
  );
}
