import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LS_KEY = "armeris:mode";
type ModeNum = 0 | 1 | 2;

type MsgMode = { type: "mode"; value: number | string };
type MsgModo = { type: "modo"; value: number | string };
type MsgAck = { type: "ack"; ok: boolean; info?: string; boot_id?: string | number; bootId?: string | number };
type MsgCurMode = { type: "current_mode"; mode: number | string };
type MsgModeUpd = { type: "mode_update"; mode: number | string };
type MsgSnapshot = { type: "snapshot"; mode?: number | string; boot_id?: string | number; uptime_ms?: number };
type MsgStatus = { type: "status"; modoActual?: number | string; mode?: number | string; boot_id?: string | number; uptime_ms?: number };
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

export default function ModeSwitch() {
  const [modo, setModo] = useState<ModeNum | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // modo pendiente de confirmar por ACK
  const pendingModeRef = useRef<ModeNum | null>(null);

  // ====== Normalizador de modo ======
  const normalizeMode = useMemo(
    () =>
      (raw: unknown): ModeNum | null => {
        if (typeof raw === "number" && [0, 1, 2].includes(raw)) return raw as ModeNum;
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

  // ====== Autoridad (boot/uptime) ======
  const lastRef = useRef<{ bootId?: string | number; uptime?: number; ts?: number; mode?: ModeNum | null }>({});

  const isNewer = (bootId?: string | number, uptime?: number) => {
    const L = lastRef.current;
    if (bootId && L.bootId && bootId !== L.bootId) return true; // boot nuevo gana
    if (bootId && L.bootId && bootId === L.bootId) {
      if (typeof uptime === "number" && typeof L.uptime === "number") return uptime > L.uptime;
    }
    if (!L.ts) return true; // primera vez
    return true; // por defecto aceptamos
  };

  const stampAndApply = (mode: ModeNum | null, bootId?: string | number, uptime?: number) => {
    if (mode !== null) {
      setModo(mode);
      localStorage.setItem(LS_KEY, String(mode));
    }
    lastRef.current = {
      bootId: bootId ?? lastRef.current.bootId,
      uptime: uptime ?? lastRef.current.uptime,
      ts: Date.now(),
      mode,
    };
    pendingModeRef.current = null;
  };

  type ModeObject = {
    boot_id?: string | number;
    bootId?: string | number;
    uptime_ms?: number;
    uptime?: number;
    mode?: unknown;
    modo?: unknown;
    modoActual?: unknown;
    current_mode?: unknown;
    payload?: {
      mode?: unknown;
      modo?: unknown;
      modoActual?: unknown;
    };
    angles?: {
      mode?: unknown;
      modo?: unknown;
      modoActual?: unknown;
    };
    data?: {
      mode?: unknown;
      modo?: unknown;
      modoActual?: unknown;
    };
    [key: string]: unknown;
  };


  // ====== Placeholder inicial desde localStorage (UNA sola vez, dentro del componente) ======
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) {
      const n = Number(saved);
      if ([0, 1, 2].includes(n)) setModo(n as ModeNum);
    }
  }, []);

  // ====== WebSocket con reconexión + uso de applyAuthoritative ======
  const applyAuthoritative = useCallback((obj: unknown): boolean => {
    if (!obj || typeof obj !== "object") return false;
    const modeObj = obj as ModeObject;
    
    const bootId = 'boot_id' in modeObj ? modeObj.boot_id : modeObj.bootId;
    const uptime = 'uptime_ms' in modeObj && typeof modeObj.uptime_ms === 'number' 
      ? modeObj.uptime_ms 
      : 'uptime' in modeObj && typeof modeObj.uptime === 'number'
        ? modeObj.uptime
        : undefined;

    // Si detecto boot distinto, invalidar UI y limpiar "modo pendiente"
    if (bootId && lastRef.current.bootId && bootId !== lastRef.current.bootId) {
      setModo(null);
      pendingModeRef.current = null;
    }

    // Candidatos en distintos niveles
    const candidates: unknown[] = [
      'mode' in modeObj ? modeObj.mode : undefined,
      'modo' in modeObj ? modeObj.modo : undefined,
      'modoActual' in modeObj ? modeObj.modoActual : undefined,
      'current_mode' in modeObj ? modeObj.current_mode : undefined,
      'payload' in modeObj && modeObj.payload && typeof modeObj.payload === 'object' && 'mode' in modeObj.payload ? modeObj.payload.mode : undefined,
      'payload' in modeObj && modeObj.payload && typeof modeObj.payload === 'object' && 'modo' in modeObj.payload ? modeObj.payload.modo : undefined,
      'payload' in modeObj && modeObj.payload && typeof modeObj.payload === 'object' && 'modoActual' in modeObj.payload ? modeObj.payload.modoActual : undefined,
      'angles' in modeObj && modeObj.angles && typeof modeObj.angles === 'object' && 'mode' in modeObj.angles ? modeObj.angles.mode : undefined,
      'angles' in modeObj && modeObj.angles && typeof modeObj.angles === 'object' && 'modo' in modeObj.angles ? modeObj.angles.modo : undefined,
      'angles' in modeObj && modeObj.angles && typeof modeObj.angles === 'object' && 'modoActual' in modeObj.angles ? modeObj.angles.modoActual : undefined,
      'data' in modeObj && modeObj.data && typeof modeObj.data === 'object' && 'mode' in modeObj.data ? modeObj.data.mode : undefined,
      'data' in modeObj && modeObj.data && typeof modeObj.data === 'object' && 'modo' in modeObj.data ? modeObj.data.modo : undefined,
      'data' in modeObj && modeObj.data && typeof modeObj.data === 'object' && 'modoActual' in modeObj.data ? modeObj.data.modoActual : undefined,
    ].filter(Boolean);

    for (const c of candidates) {
      const v = normalizeMode(c);
      if (v !== null && isNewer(bootId, uptime)) {
        stampAndApply(v, bootId, uptime);
        return true;
      }
    }
    return false;
  }, [normalizeMode]);

  useEffect(() => {
    let closedByUser = false;
    let attempt = 0;
    let sock: WebSocket;

    const connect = () => {
      sock = new WebSocket("ws://localhost:9001");
      setWs(sock);

      sock.onopen = () => {
        attempt = 0;
        console.log("✅ Conectado (modo)");
        try {
          sock.send(JSON.stringify({ type: "get_mode" }));
          sock.send(JSON.stringify({ type: "get_snapshot" }));
        } catch {
          /* no-op */
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
      
        // 1) Mensajes sin type (ya lo tienes)
        if (!msg || typeof msg !== "object" || !("type" in msg)) {
          let ok = applyAuthoritative(msg);
          if (!ok) {
            if (Array.isArray(msg)) {
              for (const it of msg) { ok = applyAuthoritative(it); if (ok) break; }
            } else if (typeof msg === 'object' && msg !== null && 'angles' in msg && typeof msg.angles === 'object' && msg.angles !== null) {
              applyAuthoritative(msg.angles);
            }
          }
          return;
        }
      
        // 2) Mensajes con type: intenta también con anidados (angles/data) ANTES del switch
        if (typeof msg === 'object' && msg !== null) {
          const msgObj = msg as Record<string, unknown>;
          if ('angles' in msgObj && typeof msgObj.angles === 'object' && msgObj.angles !== null) {
            if (applyAuthoritative(msgObj.angles)) return;
          }
          if ('data' in msgObj && typeof msgObj.data === 'object' && msgObj.data !== null) {
            if (applyAuthoritative(msgObj.data)) return;
          }
        }

        // 2.b) Con "type"
        const msgType = 'type' in msg && typeof msg.type === 'string' ? msg.type : '';
        switch (msgType) {
          case "snapshot": {
            if (!applyAuthoritative(msg)) {
              const m = (msg as MsgSnapshot).mode;
              if (m !== undefined) applyAuthoritative({ mode: m });
            }
            return;
          }
          case "status": {
            if (!applyAuthoritative(msg)) {
              const st = msg as MsgStatus;
              if (st.modoActual !== undefined) applyAuthoritative({ mode: st.modoActual, ...st });
              else if (st.mode !== undefined) applyAuthoritative({ mode: st.mode, ...st });
            }
            return;
          }
          case "mode": {
            const m = (msg as MsgMode).value;
            applyAuthoritative({ mode: m, ...msg });
            return;
          }
          case "modo": {
            const m = (msg as MsgModo).value;
            applyAuthoritative({ mode: m, ...msg });
            return;
          }
          case "current_mode": {
            const m = (msg as MsgCurMode).mode;
            applyAuthoritative({ mode: m, ...msg });
            return;
          }
          case "mode_update": {
            const m = (msg as MsgModeUpd).mode;
            applyAuthoritative({ mode: m, ...msg });
            return;
          }
          case "ack": {
            const ack = msg as MsgAck;
            const ackBoot = ack?.boot_id ?? ack?.bootId;

            // 1) "info":"mode->2"
            const info = ack.info ?? "";
            if (typeof info === "string" && info.startsWith("mode->")) {
              const m = Number(info.split("->")[1]);
              applyAuthoritative({ mode: m, boot_id: ackBoot });
              return;
            }

            // 2) ack simple
            if (ack.ok && pendingModeRef.current !== null) {
              applyAuthoritative({ mode: pendingModeRef.current, boot_id: ackBoot });
            }
            return;
          }
          default: {
            applyAuthoritative(msg);
            return;
          }
        }
      };

      sock.onerror = (e) => console.error("❌ WS modo error:", e);

      sock.onclose = () => {
        console.log("🔌 WS cerrado");
        setWs(null);
        // invalida UI y autoridad
        setModo(null);
        lastRef.current = {};
        if (!closedByUser) {
          attempt += 1;
          const delay = Math.min(30000, 500 * 2 ** attempt);
          setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (sock && sock.readyState === WebSocket.OPEN) sock.close();
    };
  }, [normalizeMode, applyAuthoritative]);
  

  // ====== Envío de comando ======
  const cambiarModo = (nuevo: ModeNum) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("WS no conectado");
      return;
    }
    pendingModeRef.current = nuevo;
    ws.send(JSON.stringify({ type: "command", payload: { mode: nuevo } }));
    console.log(`Solicitando modo -> ${nuevo}`);
    // Optimista opcional:
    // setModo(nuevo);
    // localStorage.setItem(LS_KEY, String(nuevo));
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold text-white mb-2">
        Modo Actual:{" "}
        <span className="text-cyan-300">{modo === null ? "Cargando…" : MODE_LABEL[modo]}</span>
      </h2>

      <select
        className="bg-gray-700 text-white p-2 border border-gray-600 rounded-md"
        value={modo === null ? "" : String(modo)}
        onChange={(e) => {
          const n = Number(e.target.value) as ModeNum;
          if ([0, 1, 2].includes(n)) cambiarModo(n);
        }}
      >
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
