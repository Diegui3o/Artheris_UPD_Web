import { useEffect, useState } from "react";

const ModeSwitch = () => {
  const [modo, setModo] = useState<number>(1);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket server
    const ws = new WebSocket("ws://localhost:9001");
    setSocket(ws);

    ws.onopen = () => {
      console.log("✅ Conectado al servidor de modo");
      // Request current mode
      ws.send(JSON.stringify({ type: "get_mode" }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle mode updates
        if (data.type === "mode_update" && typeof data.mode === 'number' && [0, 1, 2].includes(data.mode)) {
          setModo(data.mode);
        }
        // Initial mode response
        else if (data.type === "current_mode" && typeof data.mode === 'number' && [0, 1, 2].includes(data.mode)) {
          setModo(data.mode);
        }
      } catch (error) {
        console.error("Error procesando mensaje de modo:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("Error en la conexión de modo:", error);
    };

    ws.onclose = () => {
      console.log("🔌 Conexión de modo cerrada");
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const cambiarModo = (nuevoModo: number) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "set_mode",
        mode: nuevoModo
      }));
      console.log(`Solicitando cambio a modo ${nuevoModo}`);
    } else {
      console.error("No se pudo enviar el cambio de modo: WebSocket no está conectado");
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold text-white mb-4">
        Modo Actual: {modo}
      </h2>
      <select
        className="bg-gray-700 text-white p-2 border border-gray-600 rounded-md"
        value={modo}
        onChange={(e) => {
          const nuevoModo = Number(e.target.value);

          // Verify if the newomode is valid
          if ([0, 1, 2].includes(nuevoModo)) {
            console.log("🔄 Modo seleccionado:", nuevoModo);
            cambiarModo(nuevoModo);
          } else {
            console.warn("⚠️ Modo seleccionado no válido, ignorando...");
          }
        }}
      >
        <option value={0}>Modo 0 - Modo Piloto</option>
        <option value={1}>Modo 1 - Espera</option>
        <option value={2}>Modo 2 - Modo Manual</option>
      </select>
    </div>
  );
};

export default ModeSwitch;
