import { useEffect, useMemo, useState } from "react";

type ModeNum = 0 | 1 | 2;

type MsgMode = { type: "mode"; value: number | string };
type MsgModo = { type: "modo"; value: number | string };
type MsgAck = { type: "ack"; ok: boolean; info?: string };
type MsgCurMode = { type: "current_mode"; mode: number };
type MsgModeUpd = { type: "mode_update"; mode: number };
type MsgSnapshot = { type: "snapshot"; mode?: number | string };
type MsgStatus = { type: "status"; modoActual?: number | string };
type IncomingWS =
  | MsgMode
  | MsgModo
  | MsgAck
  | MsgCurMode
  | MsgModeUpd
  | MsgSnapshot
  | MsgStatus
  | Record<string, unknown>;

const MODE_LABEL: Record<ModeNum, string> = {
  0: "Piloto",
  1: "Espera",
  2: "Manual",
};

const LS_KEY = "lastModeNum"; // guardamos el último modo confirmado

export default function ModeSwitch() {
  // 👇 Arrancamos en null (desconocido), NO en 1.
  const [modo, setModo] = useState<ModeNum | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const normalizeMode = useMemo(
    () =>
      (raw: unknown): ModeNum | null => {
        if (typeof raw === "number" && [0, 1, 2].includes(raw)) {
          return raw as ModeNum;
        }
        if (typeof raw === "string") {
          const s = raw.trim().toLowerCase();
          if (s === "pilot" || s === "piloto") return 0;
          if (s === "idle" || s === "espera") return 1;
          if (s === "manual") return 2;
          const n = Number(s);
          if ([0, 1, 2].includes(n)) return n as ModeNum;
        }
        return null;
      },
    []
  );

  // 1) Al montar: usa localStorage como placeholder (no es la verdad)
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) {
      const n = Number(saved);
      if ([0, 1, 2].includes(n)) setModo(n as ModeNum);
    }
  }, []);

  // 2) WebSocket: pide snapshot y escucha todas las variantes que ya manejas
  useEffect(() => {
    const sock = new WebSocket("ws://localhost:9001");
    setWs(sock);

    sock.onopen = () => {
      console.log("✅ Conectado (modo)");
      // Pide un estado inicial. Tu servidor puede responder "snapshot"
      // o cualquiera de las variantes que ya manejas.
      sock.send(JSON.stringify({ type: "get_mode" })); // compat
      sock.send(JSON.stringify({ type: "get_snapshot" })); // mejor si lo implementas
    };

    const applyMode = (raw: unknown) => {
      const v = normalizeMode(raw);
      if (v !== null) {
        setModo(v);
        localStorage.setItem(LS_KEY, String(v)); // persistimos el último confirmado
      }
    };

    sock.onmessage = (ev) => {
      let data: unknown;
      try {
        data = JSON.parse(ev.data);
      } catch (e) {
        console.warn("WS: JSON inválido", e);
        return;
      }
      const msg = data as IncomingWS;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;

      switch (msg.type) {
        case "snapshot": {
          const m = (msg as MsgSnapshot).mode;
          if (m !== undefined) applyMode(m);
          return;
        }
        case "status": {
          // si el ESP32 te manda eco inmediato con modoActual
          const m = (msg as MsgStatus).modoActual;
          if (m !== undefined) applyMode(m);
          return;
        }
        case "mode": {
          applyMode((msg as MsgMode).value);
          return;
        }
        case "modo": {
          applyMode((msg as MsgModo).value);
          return;
        }
        case "current_mode": {
          applyMode((msg as MsgCurMode).mode);
          return;
        }
        case "mode_update": {
          applyMode((msg as MsgModeUpd).mode);
          return;
        }
        case "ack": {
          const info = (msg as MsgAck).info ?? "";
          // Si tu backend manda "info":"mode->2" como confirmación
          if (info.startsWith("mode->")) {
            const m = Number(info.split("->")[1]);
            applyMode(m);
          }
          return;
        }
        default:
          // ignora otros mensajes
          return;
      }
    };

    sock.onerror = (e) => console.error("❌ WS modo error:", e);
    sock.onclose = () => console.log("🔌 WS modo cerrado");

    return () => {
      if (
        sock.readyState !== WebSocket.CLOSED &&
        sock.readyState !== WebSocket.CLOSING
      ) {
        sock.close();
      }
    };
  }, [normalizeMode]);

  // 3) Cambio de modo: manda comando; el estado final lo fija el eco/telemetría
  const cambiarModo = (nuevo: ModeNum) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("WS no conectado");
      return;
    }
    // Opcional: mostrar optimista en UI (descomenta si quieres UX instantánea)
    // setModo(nuevo);
    // localStorage.setItem(LS_KEY, String(nuevo));

    ws.send(JSON.stringify({ type: "command", payload: { mode: nuevo } }));
    console.log(`Solicitando modo -> ${nuevo}`);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold text-white mb-2">
        Modo Actual:{" "}
        <span className="text-cyan-300">
          {modo === null ? "Cargando…" : MODE_LABEL[modo]}
        </span>
      </h2>

      <select
        className="bg-gray-700 text-white p-2 border border-gray-600 rounded-md"
        value={modo ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value) as ModeNum;
          if ([0, 1, 2].includes(n)) cambiarModo(n);
        }}
      >
        {/* placeholder mientras no tengamos estado */}
        {modo === null && (
          <option value="" disabled>
            — Selecciona —
          </option>
        )}
        <option value={0}>0 — Piloto</option>
        <option value={1}>1 — Espera</option>
        <option value={2}>2 — Manual</option>
      </select>
    </div>
  );
}
