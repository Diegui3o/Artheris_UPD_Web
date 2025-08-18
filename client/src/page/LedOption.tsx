import { useState, useEffect, useRef } from "react";
import { FaPlus, FaLightbulb, FaWifi } from "react-icons/fa";
import { FaWifi as FaWifiOff } from "react-icons/fa6";
import { useWebSocket } from "../hooks/useWebSocket";

type LedState = Record<number, boolean>;

type AckMsg = {
  type: "ack";
  request_id?: string;
  ok: boolean;
  info?: string;
};

type LedEvent = {
  type: "led";
  id: number;
  value: boolean;
};

function genRequestId() {
  return `${Date.now()}-${Math.floor(Math.random() * 65536)}`;
}

export default function LedControl() {
  const [ledCount, setLedCount] = useState<number>(3);
  const [leds, setLeds] = useState<LedState>({ 1: false, 2: false, 3: false });
  const { isConnected, sendMessage, onMessage } = useWebSocket(
    "ws://localhost:9001"
  );

  // Para conciliar "optimistic update" con ACKs
  const pending = useRef<
    Map<string, { led: number; desired: boolean; revert?: () => void }>
  >(new Map());

  const toggleLed = (ledNumber: number) => {
    const desired = !leds[ledNumber];
    const request_id = genRequestId();

    // Optimistic update
    setLeds((prev) => ({ ...prev, [ledNumber]: desired }));

    // Guardamos cómo revertir si el ACK falla o no llega
    const revert = () =>
      setLeds((prev) => ({ ...prev, [ledNumber]: !desired }));
    pending.current.set(request_id, { led: ledNumber, desired, revert });

    // Enviar comando con el nuevo protocolo
    if (isConnected) {
      // El hook asume { type, ...payload } y lo serializa
      sendMessage("command", {
        request_id,
        payload: {
          led: { id: ledNumber, state: desired }, // ← id y boolean
        },
      });
      // Si quieres timeout de seguridad (ej. 2.5s) para revertir:
      setTimeout(() => {
        const p = pending.current.get(request_id);
        if (p) {
          // No llegó ACK a tiempo → revertir y limpiar
          p.revert?.();
          pending.current.delete(request_id);
          console.warn(`ACK timeout para request_id=${request_id}`);
        }
      }, 2500);
    } else {
      console.error("No hay conexión WebSocket");
      // Revertir si no hay conexión
      revert();
      pending.current.delete(request_id);
    }
  };

  const addLed = () => {
    const newLedNum = ledCount + 1;
    setLedCount(newLedNum);
    setLeds((prev) => ({ ...prev, [newLedNum]: false }));
  };

  const removeLed = () => {
    if (ledCount > 1) {
      const ledToRemove = ledCount;

      // Si está encendido, intenta apagarlo antes (no obligatorio)
      if (isConnected && leds[ledToRemove]) {
        const request_id = genRequestId();
        sendMessage("command", {
          request_id,
          payload: { led: { id: ledToRemove, state: false } },
        });
      }

      setLedCount((prev) => prev - 1);
      setLeds((prev) => {
        const next = { ...prev };
        delete next[ledToRemove];
        return next;
      });
    }
  };

  // Estado de conexión
  useEffect(() => {
    if (!isConnected)
      console.log("Intentando conectar con el servidor WebSocket...");
  }, [isConnected]);

  // Escuchar ACKs del servidor
  useEffect(() => {
    const offAck = onMessage<AckMsg>("ack", (msg) => {
      if (!msg?.request_id) return;
      const p = pending.current.get(msg.request_id);
      if (!p) return;

      if (msg.ok) {
        // Listo: mantenemos el estado como está
        pending.current.delete(msg.request_id);
      } else {
        // Falló: revertimos
        p.revert?.();
        pending.current.delete(msg.request_id);
        console.warn("ACK negativo:", msg.info);
      }
    });

    // También escuchar eventos 'led' que el backend emite (sincr. de estado)
    const offLed = onMessage<LedEvent>("led", (evt) => {
      if (typeof evt?.id === "number" && typeof evt?.value === "boolean") {
        setLeds((prev) => ({ ...prev, [evt.id]: evt.value }));
      }
    });

    return () => {
      offAck?.();
      offLed?.();
    };
  }, [onMessage]);

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          color: isConnected ? "#4CAF50" : "#f44336",
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: "5px 10px",
          borderRadius: "15px",
          fontSize: "14px",
        }}
      >
        {isConnected ? <FaWifi /> : <FaWifiOff />}
        {isConnected ? "Conectado" : "Desconectado"}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2
          style={{
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            margin: 0,
          }}
        >
          Control de LEDs
        </h2>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={addLed}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
            title="Añadir LED"
          >
            <FaPlus /> Añadir
          </button>
          {ledCount > 1 && (
            <button
              onClick={removeLed}
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
              title="Quitar LED"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "20px",
          marginTop: "15px",
        }}
      >
        {Array.from({ length: ledCount }, (_, i) => i + 1).map((ledNum) => (
          <button
            key={ledNum}
            style={{
              padding: "16px",
              backgroundColor: leds[ledNum] ? "#3b82f6" : "#4b5563",
              color: "white",
              borderRadius: "12px",
              textAlign: "center",
              cursor: isConnected ? "pointer" : "not-allowed",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              border: "none",
              opacity: isConnected ? 1 : 0.6,
            }}
            onClick={() => isConnected && toggleLed(ledNum)}
            disabled={!isConnected}
          >
            <FaLightbulb
              size={24}
              color={leds[ledNum] ? "#ffffff" : "#f3f4f6"}
              style={{
                filter: leds[ledNum]
                  ? "drop-shadow(0 0 8px rgba(255, 235, 59, 0.8))"
                  : "none",
              }}
            />
            <div
              style={{ fontSize: "16px", fontWeight: "bold", marginTop: "5px" }}
            >
              LED {ledNum}
            </div>
            <div
              style={{
                fontSize: "14px",
                backgroundColor: "rgba(0, 0, 0, 0.15)",
                padding: "4px 10px",
                borderRadius: "8px",
                minWidth: "80px",
                fontWeight: 500,
              }}
            >
              {leds[ledNum] ? "ENCENDIDO" : "APAGADO"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
