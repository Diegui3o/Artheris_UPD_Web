// client/src/page/Simulator.tsx

import React, { useState } from "react";
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import { motion } from "framer-motion";
import { SimulationConfig } from "../types/simulation";
import { useSimulation } from "../hooks/useSimulation";
import {
  SimulationConfigPanel,
  SimulationResults,
  SimulationPlots,
} from "../components/simulation";

const DEFAULT_CONFIG: SimulationConfig = {
  trajectory_type: "sinusoidal",
  duration_sec: 30,
  amplitude_deg: 15,
  sample_rate_hz: 100,
};

export default function Simulator() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState(0);
  const { loading, error, result, runSimulation, downloadCSV } =
    useSimulation();

  const handleRunSimulation = async () => {
    await runSimulation(config);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{ color: "#fff", fontWeight: 700, mb: 1 }}
          >
            🧪 Artheris SIL Simulation Validator
          </Typography>
          <Typography variant="body1" sx={{ color: "#9ca3af" }}>
            Software-in-the-Loop validation for Kalman filter uncertainty
            estimation. Generate synthetic IMU data with realistic errors
            (U1-U6) and validate your filter.
          </Typography>
        </Box>
      </motion.div>

      <SimulationConfigPanel
        config={config}
        onChange={setConfig}
        onRun={handleRunSimulation}
        loading={loading}
      />

      {error && (
        <Box
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: "#7f1d1d",
            borderRadius: 2,
            color: "#fca5a5",
          }}
        >
          ❌ Error: {error}
        </Box>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#3b82f6" }} />
        </Box>
      )}

      {result && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Box sx={{ mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              sx={{
                "& .MuiTab-root": { color: "#9ca3af" },
                "& .Mui-selected": { color: "#3b82f6" },
                "& .MuiTabs-indicator": { backgroundColor: "#3b82f6" },
              }}
            >
              <Tab label="📊 Resultados" />
              <Tab label="📈 Gráficos" />
            </Tabs>
          </Box>

          {activeTab === 0 && (
            <SimulationResults
              result={result}
              onDownloadCSV={() => downloadCSV(result.csv_data)}
            />
          )}

          {activeTab === 1 && <SimulationPlots csvData={result.csv_data} />}
        </motion.div>
      )}
    </Container>
  );
}
