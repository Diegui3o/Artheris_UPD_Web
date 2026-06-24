// client/src/hooks/useSimulation.ts

import { useState } from "react";
import {
  SimulationConfig,
  SimulationResponse,
  BatchSimulationResult,
} from "../types/simulation";

const API_BASE = "http://localhost:3000/api";

export function useSimulation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResponse | null>(null);

  const runSimulation = async (
    config: SimulationConfig,
  ): Promise<SimulationResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/simulation/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SimulationResponse = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const runBatchSimulation = async (): Promise<
    BatchSimulationResult[] | null
  > => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/simulation/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en batch");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (csvData: string, filename?: string) => {
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || `simulation_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    loading,
    error,
    result,
    runSimulation,
    runBatchSimulation,
    downloadCSV,
    reset,
  };
}
