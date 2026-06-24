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

type ServerLedMessage = {
  type: "led";
  target: "all" | "one" | "many";
  id?: number;
  ids?: number[];
  value: boolean;
};

type AckMessage = {
  type: string;
  request_id?: string;
  [key: string]: unknown;
};

function genRequestId() {
  return `${Date.now()}-${Math.floor(Math.random() * 65536)}`;
}

export default function LedControl() {
  const [ledCount, setLedCount] = useState<number>(1);
  const [leds, setLeds] = useState<LedState>({ 1: false, 2: false, 3: false });
  const { isConnected, sendMessage, onMessage } = useWebSocket(
    "ws://localhost:9001"
  );

  // Para conciliar "optimistic update" con ACKs
  const pending = useRef<
    Map<string, { led: number; desired: boolean; revert?: () => void }>
  >(new Map());

  // Handler único de mensajes entrantes
  useEffect(() => {
    const messageHandler = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const message = data as AckMessage;

      // --- ACKs ---
      if (message.type === "ack" && message.request_id) {
        const op = pending.current.get(message.request_id);
        if (op) {
          const ackMsg = message as AckMsg;
          if (ackMsg.ok !== true) {
            op.revert?.();
          }
          pending.current.delete(message.request_id);
        }
        return;
      }

      // --- LED events ---
      if (message.type === "led") {
        const ledMsg = message as unknown as ServerLedMessage;

        if (ledMsg.target === "all") {
          setLeds((prev) => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
              const n = Number(k);
              if (!isNaN(n)) next[n] = ledMsg.value;
            }
            return next;
          });
          for (const [rid, op] of pending.current.entries()) {
            if (op.desired === ledMsg.value) pending.current.delete(rid);
          }
        }

        if (ledMsg.target === "one" && typeof ledMsg.id === "number") {
          const ledId = ledMsg.id;
          setLeds((prev) => ({ ...prev, [ledId]: ledMsg.value }));
          for (const [rid, op] of pending.current.entries()) {
            if (op.led === ledId && op.desired === ledMsg.value) {
              pending.current.delete(rid);
            }
          }
        }

        if (ledMsg.target === "many" && Array.isArray(ledMsg.ids)) {
          const idsArr = ledMsg.ids;
          setLeds((prev) => {
            const next = { ...prev };
            for (const id of idsArr) next[id] = ledMsg.value;
            return next;
          });
          for (const [rid, op] of pending.current.entries()) {
            if (idsArr.includes(op.led) && op.desired === ledMsg.value) {
              pending.current.delete(rid);
            }
          }
        }
      }
    };

    const cleanup = onMessage("*", messageHandler);
    return () => cleanup();
  }, [onMessage]);

  const toggleLed = (ledNumber: number) => {
    // No permitir otra operación si hay una pendiente para ese LED
    const hasPending = Array.from(pending.current.values()).some(
      (op) => op.led === ledNumber
    );
    if (hasPending) {
      console.log("Operation already in progress for LED", ledNumber);
      return;
    }

    const desired = !leds[ledNumber];
    const request_id = genRequestId();

    // Optimistic update
    setLeds((prev) => ({ ...prev, [ledNumber]: desired }));

    // Cómo revertir si falla
    const revert = () => {
      setLeds((prev) => ({ ...prev, [ledNumber]: !desired }));
    };

    pending.current.set(request_id, { led: ledNumber, desired, revert });

    if (isConnected) {
      sendMessage("command", {
        request_id, // nivel top
        payload: {
          // comando directo
          led: { id: ledNumber, state: desired },
        },
      });

      // Timeout más corto para UX ágil en LAN
      setTimeout(() => {
        const op = pending.current.get(request_id);
        if (op) {
          console.warn(`ACK timeout for LED ${ledNumber}, reverting...`);
          op.revert?.();
          pending.current.delete(request_id);
        }
      }, 1200);
    } else {
      console.error("No WebSocket connection");
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

      if (isConnected && leds[ledToRemove]) {
        const request_id = genRequestId();
        sendMessage("command", {
          request_id,
          payload: {
            led: { id: ledToRemove, state: false },
          },
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

  // Si se desconecta, limpia operaciones pendientes
  useEffect(() => {
    if (!isConnected) {
      for (const [rid, op] of pending.current.entries()) {
        op.revert?.();
        pending.current.delete(rid);
      }
    }
  }, [isConnected]);

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
