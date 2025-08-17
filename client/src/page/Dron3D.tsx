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
      droneRef.current.rotation.order = "YXZ";
      droneRef.current.rotation.set(
        THREE.MathUtils.degToRad(
          anglesData.AnglePitch_est ?? kalmanAngles.pitch
        ),
        THREE.MathUtils.degToRad(anglesData.yaw ?? anglesData.AngleYaw ?? 0),
        THREE.MathUtils.degToRad(anglesData.AngleRoll_est ?? kalmanAngles.roll)
      );
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
        const parsed = JSON.parse(event.data);
        if (parsed.event === "angles" && parsed.data) {
          const data: AnglesData = parsed.data;
          setAnglesData(data);

          setKalmanAngles({
            roll: data.AngleRoll_est ?? 0,
            pitch: data.AnglePitch_est ?? 0,
          });
        }
      } catch (err) {
        console.error("Error parseando JSON:", err);
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
