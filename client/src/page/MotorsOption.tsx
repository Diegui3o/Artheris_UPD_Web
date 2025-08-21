import { useState, useEffect, useCallback, useMemo } from "react";
import { FaPlus } from "react-icons/fa";
import { useWebSocket } from "../hooks/useWebSocket";

type MotorKey = `motor${number}`;
type OneMotor = { on: boolean; speed: number }; // µs (1000–2000)
type MotorState = Record<MotorKey, OneMotor>;

// === Ajusta estos valores a tu setup ===
const DEFAULT_MOTORS = 4; // arranca mostrando 4 motores
const DEFAULT_IDLE_US = 1170; // idle real
const MIN_US = 1000;
const MAX_US = 2000;

// Debounce genérico por tuplas (compatible browser/Node)
function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number
): (...args: A) => void {
  let t: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Lo que el ESP32 espera DENTRO de "payload" del WS: { motor: {...} } o { motors: {...} }
type MotorPayload =
  | { motor: { id: number; speed: number } }
  | { motor: { id: number; state: boolean } }
  | { motors: { speed: number } }
  | { motors: { state: boolean } }
  | { motors: { ids: number[]; speed: number } }
  | { motors: { ids: number[]; state: boolean } };

export default function MotorControl() {
  const { isConnected, sendMessage } = useWebSocket("ws://localhost:9001");

  // Estado: on+speed por motor
  const [activeMotors, setActiveMotors] = useState<number>(DEFAULT_MOTORS);
  const [motorStatus, setMotorStatus] = useState<MotorState>(() => {
    const init = {} as MotorState;
    for (let i = 1; i <= DEFAULT_MOTORS; i++) {
      init[`motor${i}` as MotorKey] = { on: false, speed: DEFAULT_IDLE_US };
    }
    return init;
  });

  // Velocidad global (para “todos a X µs”)
  const [globalSpeed, setGlobalSpeed] = useState<number>(DEFAULT_IDLE_US);

  // Helper: envía { type:"command", payload: <MotorPayload> }
  const sendCmd = useCallback(
    (payload: MotorPayload) => {
      if (!isConnected) return;
      sendMessage("command", payload);
    },
    [isConnected, sendMessage]
  );

  // === Acciones por motor ===
  const setOneMotorOn = useCallback(
    (id: number, speed?: number) => {
      const key = `motor${id}` as MotorKey;
      const us = Math.max(
        MIN_US,
        Math.min(MAX_US, speed ?? motorStatus[key]?.speed ?? DEFAULT_IDLE_US)
      );

      // UI optimista
      setMotorStatus((prev) => ({
        ...prev,
        [key]: { on: true, speed: us },
      }));

      // Firmware: {"type":"command","payload":{"motor":{"id":N,"speed":US}}}
      sendCmd({ motor: { id, speed: us } });
    },
    [sendCmd, motorStatus]
  );

  const setOneMotorOff = useCallback(
    (id: number) => {
      const key = `motor${id}` as MotorKey;
      setMotorStatus((prev) => ({
        ...prev,
        [key]: { on: false, speed: prev[key]?.speed ?? DEFAULT_IDLE_US },
      }));

      // Firmware: {"type":"command","payload":{"motor":{"id":N,"state":false}}}
      sendCmd({ motor: { id, state: false } });
    },
    [sendCmd]
  );

  const toggleMotor = useCallback(
    (id: number, newOn: boolean) => {
      if (newOn) setOneMotorOn(id);
      else setOneMotorOff(id);
    },
    [setOneMotorOn, setOneMotorOff]
  );

  // Slider por motor (debounced) — usa tupla [id, us]
  const sendSpeedDebounced = useMemo(
    () =>
      debounce(([id, us]: [number, number]) => {
        const key = `motor${id}` as MotorKey;
        // Solo enviar si está encendido
        if (motorStatus[key]?.on) {
          sendCmd({ motor: { id, speed: us } });
        }
      }, 120),
    [sendCmd, motorStatus]
  );

  const handleSpeedChange = useCallback(
    (id: number, us: number) => {
      const key = `motor${id}` as MotorKey;

      setMotorStatus((prev) => ({
        ...prev,
        [key]: { on: prev[key]?.on ?? false, speed: us },
      }));

      // Enviar (debounced) solo si está encendido
      sendSpeedDebounced([id, us]);
    },
    [sendSpeedDebounced]
  );

  // === Acciones globales ===
  const turnAllOn = useCallback(() => {
    for (let i = 1; i <= activeMotors; i++) {
      const key = `motor${i}` as MotorKey;
      const us = motorStatus[key]?.speed ?? DEFAULT_IDLE_US;
      setOneMotorOn(i, us);
    }
  }, [activeMotors, motorStatus, setOneMotorOn]);

  const turnAllOff = useCallback(() => {
    sendCmd({ motors: { state: false } });
    // UI
    setMotorStatus((prev) => {
      const next: MotorState = { ...prev };
      for (let i = 1; i <= activeMotors; i++) {
        const k = `motor${i}` as MotorKey;
        next[k] = { on: false, speed: prev[k]?.speed ?? DEFAULT_IDLE_US };
      }
      return next;
    });
  }, [activeMotors, sendCmd]);

  const setAllToSpeed = useCallback(
    (us: number) => {
      const v = Math.max(MIN_US, Math.min(MAX_US, us));
      setGlobalSpeed(v);

      const ids: number[] = [];
      for (let i = 1; i <= activeMotors; i++) {
        const k = `motor${i}` as MotorKey;
        if (motorStatus[k]?.on) ids.push(i);
      }
      if (ids.length) sendCmd({ motors: { ids, speed: v } });

      // UI: no cambies 'on', solo la velocidad
      setMotorStatus((prev) => {
        const next: MotorState = { ...prev };
        for (let i = 1; i <= activeMotors; i++) {
          const k = `motor${i}` as MotorKey;
          const wasOn = prev[k]?.on ?? false;
          next[k] = { on: wasOn, speed: v }; // ✅ respeta ON/OFF
        }
        return next;
      });
    },
    [activeMotors, motorStatus, sendCmd]
  );

  // === Añadir / Quitar motores ===
  const addMotor = useCallback(() => {
    const n = activeMotors + 1;
    setActiveMotors(n);
    setMotorStatus((prev) => ({
      ...prev,
      [`motor${n}`]: { on: false, speed: DEFAULT_IDLE_US },
    }));
  }, [activeMotors]);

  const removeMotor = useCallback(() => {
    if (activeMotors <= 1) return;
    const id = activeMotors;
    const key = `motor${id}` as MotorKey;
    const wasOn = motorStatus[key]?.on;

    setActiveMotors((p) => p - 1);
    // Evita no-unused-vars usando delete
    setMotorStatus((prev) => {
      const rest = { ...prev };
      delete rest[key];
      return rest as MotorState;
    });

    if (wasOn) sendCmd({ motor: { id, state: false } });
  }, [activeMotors, motorStatus, sendCmd]);

  // Estado conexión
  useEffect(() => {
    if (!isConnected) {
      console.log("Intentando conectar con el servidor WebSocket...");
    }
  }, [isConnected]);

  // UI helpers (colores)
  const getMotorColor = useCallback((motorNum: number, opacity = 1): string => {
    const colors = [
      "rgba(99,102,241,{o})", // Indigo
      "rgba(139,92,246,{o})", // Violet
      "rgba(236,72,153,{o})", // Pink
      "rgba(249,115,22,{o})", // Orange
      "rgba(16,185,129,{o})", // Emerald
      "rgba(234,179,8,{o})", // Yellow
    ];
    return colors[(motorNum - 1) % colors.length].replace(
      "{o}",
      String(opacity)
    );
  }, []);

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

      {/* Control general */}
      <div className="w-full space-y-3">
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
              onClick={turnAllOn}
              disabled={!isConnected}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Encender todos
            </button>
            <button
              onClick={turnAllOff}
              disabled={!isConnected}
              className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Apagar todos
            </button>
          </div>
        </div>

        {/* Velocidad global */}
        <div className="rounded-lg p-4 bg-gray-700/40 border border-gray-600/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-semibold">Velocidad Global</div>
            <div className="text-white/70 text-sm">{globalSpeed} µs</div>
          </div>
          <input
            type="range"
            min={MIN_US}
            max={MAX_US}
            step={1}
            value={globalSpeed}
            onChange={(e) => setAllToSpeed(Number(e.target.value))}
            disabled={!isConnected}
            className="w-full accent-white/90"
          />
          <div className="text-xs text-gray-300 mt-1">
            Aplica a todos: envía <code>{"{motors:{speed:US}}"}</code> al ESP32.
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
            const key = `motor${motorNum}` as MotorKey;
            const st = motorStatus[key] ?? {
              on: false,
              speed: DEFAULT_IDLE_US,
            };
            const isOn = st.on;

            return (
              <div
                key={key}
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
                    />
                  </div>

                  {/* Slider por motor */}
                  <div className="rounded-md p-3 bg-black/10 border border-white/10 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/90 text-sm">Velocidad</span>
                      <span className="text-white/70 text-sm">
                        {st.speed} µs
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_US}
                      max={MAX_US}
                      step={1}
                      value={st.speed}
                      onChange={(e) =>
                        handleSpeedChange(motorNum, Number(e.target.value))
                      }
                      disabled={!isConnected}
                      className="w-full accent-white/90"
                    />
                    <div className="text-[11px] text-white/60 mt-1">
                      {isOn
                        ? "Se envía {motor:{id,speed}} (con debounce)."
                        : "Ajusta la velocidad; al encender se usará ese valor."}
                    </div>
                  </div>

                  {/* Botones ON/OFF */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleMotor(motorNum, true)}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg font-medium transition-all min-w-[100px] ${
                        isOn
                          ? "bg-white/10 text-white/90 border border-white/20"
                          : `bg-white/5 text-white/90 hover:bg-white/10 border border-white/10 hover:border-white/20 ${getMotorColorClass(
                              motorNum
                            ).replace("bg-", "hover:bg-")}/20`
                      } ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={!isConnected || isOn}
                    >
                      {isOn ? "Encendido" : "Encender"}
                    </button>

                    <button
                      onClick={() => toggleMotor(motorNum, false)}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg font-medium transition-all min-w-[100px] ${
                        !isOn
                          ? "bg-white/5 text-white/90 border border-white/10"
                          : "bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30"
                      } ${!isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={!isConnected || !isOn}
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Añadir/Quitar motores */}
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
    </div>
  );
}
