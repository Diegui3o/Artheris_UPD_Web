import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/Card";
import "./AnglesDisplay.css";
import { AnglesData } from "../types/angles";

// 📦 Componente para secciones
const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="section">
    <h3 className="section-title">{title}</h3>
    <div>{children}</div>
  </div>
);

// 📦 Componente para mostrar campos
const Field = ({ label, value }: { label: string; value: unknown }) => (
  <p className="label-text">
    {label}:{" "}
    <span className="value-text">
      {typeof value === "number"
        ? value.toFixed(3)
        : value === undefined || value === null
        ? "-"
        : typeof value === "object"
        ? JSON.stringify(value)
        : String(value)}
    </span>
  </p>
);

// 📦 Componente principal
const DroneAngles = () => {
  const [angles, setAngles] = useState<AnglesData>({});

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:9001");

    socket.onopen = () => {
      console.log("✅ Conectado al servidor WebSocket");
    };

    socket.onerror = (error) => {
      console.error("❌ Error en WebSocket:", error);
    };

    socket.onclose = () => {
      console.log("🔌 Conexión cerrada con el servidor");
    };

    socket.onmessage = (event) => {
      try {
        const message = event.data;
        let telemetryData: AnglesData;
        
        try {
          const data = JSON.parse(message);
          
          // Handle both formats of the message
          if (data && typeof data === 'object') {
            // Case 1: Message has type and payload
            if (data.type === 'telemetry' && data.payload) {
              telemetryData = data.payload;
            } 
            // Case 2: Message is the telemetry data directly
            else if ('roll' in data || 'pitch' in data || 'yaw' in data) {
              telemetryData = data;
            } else {
              console.log('📦 Mensaje recibido (formato no reconocido):', data);
              return;
            }
            
            // Ensure we have valid data before updating state
            if (telemetryData && Object.keys(telemetryData).length > 0) {
              setAngles(prev => ({
                ...prev,  // Preserve previous values
                ...telemetryData  // Update with new values
              }));
            }
          }
        } catch (error) {
          console.error('❌ Error al procesar el mensaje:', error);
        }
      } catch (err) {
        console.error("❌ Error en el manejador de mensajes:", err);
      }
    };

    return () => {
      console.log("🔌 Cerrando WebSocket...");
      socket.close();
    };
  }, []);

  return (
    <Card className="p-4 shadow-lg rounded-lg bg-black neon-card">
      <CardContent>
        <h2 className="main-title">Drone Telemetría</h2>

        <Section title="Ángulos">
          <Field label="Roll" value={angles.roll} />
          <Field label="Pitch" value={angles.pitch} />
          <Field label="Yaw" value={angles.yaw} />
          <Field label="AngleRoll" value={angles.AngleRoll} />
          <Field label="AnglePitch" value={angles.AnglePitch} />
          <Field label="AngleYaw" value={angles.AngleYaw} />
        </Section>

        <Section title="Kalman y Estimaciones">
          <Field label="KalmanAngleRoll" value={angles.KalmanAngleRoll} />
          <Field label="KalmanAnglePitch" value={angles.KalmanAnglePitch} />
          <Field label="AngleRoll_est" value={angles.AngleRoll_est} />
          <Field label="AnglePitch_est" value={angles.AnglePitch_est} />
        </Section>

        <Section title="Velocidades Angulares">
          <Field label="Rate Roll" value={angles.RateRoll} />
          <Field label="Rate Pitch" value={angles.RatePitch} />
          <Field label="Rate Yaw" value={angles.RateYaw} />
          <Field label="Gyro Rate Roll" value={angles.gyroRateRoll} />
          <Field label="Gyro Rate Pitch" value={angles.gyroRatePitch} />
        </Section>

        <Section title="Valores Deseados">
          <Field label="Desired Roll" value={angles.DesiredAngleRoll} />
          <Field label="Desired Pitch" value={angles.DesiredAnglePitch} />
          <Field label="Desired Rate Yaw" value={angles.DesiredRateYaw} />
        </Section>

        <Section title="Errores y Torques">
          <Field label="Error phi" value={angles.error_phi} />
          <Field label="Error theta" value={angles.error_theta} />
          <Field label="Tau X" value={angles.tau_x} />
          <Field label="Tau Y" value={angles.tau_y} />
          <Field label="Tau Z" value={angles.tau_z} />
        </Section>

        <Section title="Entradas de Control">
          <Field label="InputThrottle" value={angles.InputThrottle} />
          <Field label="InputRoll" value={angles.InputRoll} />
          <Field label="InputPitch" value={angles.InputPitch} />
          <Field label="InputYaw" value={angles.InputYaw} />
        </Section>

        <Section title="Motores">
          <Field label="Motor 1" value={angles.MotorInput1} />
          <Field label="Motor 2" value={angles.MotorInput2} />
          <Field label="Motor 3" value={angles.MotorInput3} />
          <Field label="Motor 4" value={angles.MotorInput4} />
        </Section>

        <Section title="Otros">
          <Field label="Altura" value={angles.Altura} />
          <Field label="Modo" value={angles.modo} />
          <Field label="Modo Actual" value={angles.modoActual} />
          <Field label="K1" value={angles.k1} />
        </Section>
      </CardContent>
    </Card>
  );
};

export default DroneAngles;
