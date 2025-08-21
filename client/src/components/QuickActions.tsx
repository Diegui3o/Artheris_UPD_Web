import { useEffect, useMemo, useRef, useState } from "react";

type WSState = "closed" | "connecting" | "open";
type ToggleState = {
  mpuCalib: boolean;
  orientation: boolean;
  motorsCalib: boolean;
};

export default function QuickActions({
  wsUrl = "ws://localhost:9001",
}: {
  wsUrl?: string;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSState>("closed");
  const [toggleState, setToggleState] = useState<ToggleState>({
    mpuCalib: false,
    orientation: false,
    motorsCalib: false,
  });

  const sendJson = useMemo(
    () => (obj: unknown) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("WS no conectado para enviar:", obj);
        return;
      }
      ws.send(JSON.stringify(obj));
    },
    []
  );

  useEffect(() => {
    setStatus("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onclose = () => {
      setStatus("closed");
      wsRef.current = null;
    };
    ws.onerror = (e) => console.error("QuickActions WS error:", e);
    
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "ack") {
          console.log("ACK:", msg);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    return () => {
      try {
        ws.close();
      } catch (error) {
        console.error("Error closing WebSocket:", error);
      }
    };
  }, [wsUrl]);

  const isDisabled = status !== "open";

  const toggleMpuCalib = () => {
    const newState = !toggleState.mpuCalib;
    setToggleState(prev => ({ ...prev, mpuCalib: newState }));
    sendJson({ 
      type: "command", 
      payload: { 
        calibrate: "mpu",
        state: newState ? "on" : "off"
      } 
    });
  };

  const toggleOrientation = () => {
    const newState = !toggleState.orientation;
    setToggleState(prev => ({ ...prev, orientation: newState }));
    sendJson({ 
      type: "command", 
      payload: { 
        orient: newState ? "north" : "off"
      } 
    });
  };

  const toggleMotorsCalib = () => {
    const newState = !toggleState.motorsCalib;
    setToggleState(prev => ({ ...prev, motorsCalib: newState }));
    sendJson({ 
      type: "command", 
      payload: { 
        calibrate: "motors",
        state: newState ? "on" : "off"
      } 
    });
  };

  const goHome = () => {
    window.location.assign("/");
  };

  const getButtonClass = (isActive: boolean, color: string) => {
    const base = "w-full px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 " +
                "focus:outline-none focus:ring-2 focus:ring-offset-2 " +
                "disabled:opacity-50 disabled:cursor-not-allowed ";
    
    if (isActive) {
      return base + `bg-${color}-700 hover:bg-${color}-600 text-white focus:ring-${color}-400`;
    }
    return base + `bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-400`;
  };

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        className={getButtonClass(toggleState.mpuCalib, "blue")}
        onClick={toggleMpuCalib}
        disabled={isDisabled}
        title={isDisabled ? "Conectando..." : "Activar/Desactivar calibración MPU"}
      >
        {toggleState.mpuCalib ? "Desactivar" : "Activar"} calibración MPU
      </button>

      <button
        className={getButtonClass(toggleState.orientation, "cyan")}
        onClick={toggleOrientation}
        disabled={isDisabled}
        title={isDisabled ? "Conectando..." : "Activar/Desactivar orientación norte"}
      >
        {toggleState.orientation ? "Desorientar" : "Orientar al Norte"}
      </button>

      <button
        className={getButtonClass(toggleState.motorsCalib, "amber")}
        onClick={toggleMotorsCalib}
        disabled={isDisabled}
        title={isDisabled ? "Conectando..." : "Activar/Desactivar calibración de motores"}
      >
        {toggleState.motorsCalib ? "Detener" : "Iniciar"} calibración motores
      </button>

      <button
        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
        onClick={goHome}
      >
        Regresar a Home
      </button>
    </div>
  );
}
