import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { AnglesData } from "../types/angles";

interface DroneProps {
  anglesData: AnglesData;
  kalmanAngles: { roll: number; pitch: number };
}

function Drone({ anglesData, kalmanAngles }: DroneProps) {
  const droneRef = useRef<THREE.Group>(null);
  const obj = useLoader(OBJLoader, "/src/models/base(2).obj");

  useFrame(() => {
    if (droneRef.current) {
      // Set rotation order to YXZ for proper gimbal behavior (yaw, pitch, roll)
      droneRef.current.rotation.order = "YXZ";
      
      // Get angles with fallbacks in order of preference
      const pitch = anglesData.AnglePitch_est ?? anglesData.AnglePitch ?? anglesData.pitch ?? kalmanAngles.pitch;
      const yaw = anglesData.AngleYaw ?? anglesData.yaw ?? 0;
      const roll = anglesData.AngleRoll_est ?? anglesData.AngleRoll ?? anglesData.roll ?? kalmanAngles.roll;
      
      // Apply rotations in YXZ order (yaw, pitch, roll)
      droneRef.current.rotation.set(
        THREE.MathUtils.degToRad(pitch),  // X-axis rotation (pitch)
        THREE.MathUtils.degToRad(yaw),    // Y-axis rotation (yaw)
        THREE.MathUtils.degToRad(roll)    // Z-axis rotation (roll)
      );
      
      // Update kalmanAngles for reference by other components if needed
      if (anglesData.AngleRoll_est !== undefined || anglesData.AnglePitch_est !== undefined) {
        kalmanAngles.roll = roll;
        kalmanAngles.pitch = pitch;
      }
    }
  });

  return (
    <primitive ref={droneRef} object={obj} scale={1} position={[0, 0, 0]} />
  );
}

export default function Dron3D() {
  const [anglesData, setAnglesData] = useState<AnglesData>({});
  const [kalmanAngles, setKalmanAngles] = useState({ roll: 0, pitch: 0 });

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:9001");

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
            
            // Update the state with the new data
            setAnglesData(telemetryData);
            setKalmanAngles({
              roll: telemetryData.AngleRoll_est ?? telemetryData.roll ?? 0,
              pitch: telemetryData.AnglePitch_est ?? telemetryData.pitch ?? 0,
            });
          }
        } catch (error) {
          console.error('❌ Error al procesar el mensaje:', error);
        }
      } catch (err) {
        console.error("❌ Error en el manejador de mensajes:", err);
      }
    };

    return () => socket.close();
  }, []);

  // Función para renderizar cualquier campo que exista en anglesData

  return (
    <div style={{ position: "relative", width: "70vw", height: "70vh" }}>
      {/* 🔷 Cuadro flotante con telemetría */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          backgroundColor: "rgba(0, 0, 0, 0.34)",
          color: "#0AC4ff",
          padding: "15px",
          borderRadius: "10px",
          fontFamily: "monospace",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.23)",
        }}
      >
        <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>
          Kalman Roll: {anglesData.AngleRoll_est}°
        </p>
        <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>
          Kalman Pitch: {anglesData.AnglePitch_est}°
        </p>
      </div>

      {/* 🛸 Escena 3D */}
      <Canvas camera={{ position: [0, 1, 2.9], fov: 50 }}>
        <Drone kalmanAngles={kalmanAngles} anglesData={anglesData} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} castShadow intensity={1.5} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}
