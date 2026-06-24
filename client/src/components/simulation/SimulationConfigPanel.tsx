// client/src/components/simulation/SimulationConfigPanel.tsx

import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { SimulationConfig, TrajectoryType } from "../../types/simulation";

interface Props {
  config: SimulationConfig;
  onChange: (config: SimulationConfig) => void;
  onRun: () => void;
  loading: boolean;
}

const TRAJECTORY_OPTIONS: {
  value: TrajectoryType;
  label: string;
  color: string;
}[] = [
  { value: "sinusoidal", label: "Sinusoidal (0.5 Hz)", color: "#3b82f6" },
  { value: "step", label: "Escalón", color: "#f59e0b" },
  { value: "composite", label: "Compuesto", color: "#10b981" },
  { value: "random", label: "Random Walk", color: "#8b5cf6" },
  { value: "impulse", label: "Impulso", color: "#ef4444" },
];

export const SimulationConfigPanel: React.FC<Props> = ({
  config,
  onChange,
  onRun,
  loading,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (key: keyof SimulationConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const getTrajectoryColor = (type?: string) => {
    return TRAJECTORY_OPTIONS.find((t) => t.value === type)?.color || "#6b7280";
  };

  return (
    <Card sx={{ mb: 3, backgroundColor: "#1e293b", borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600 }}>
            🧪 Configuración de Simulación SIL
          </Typography>
          <Chip
            label={
              TRAJECTORY_OPTIONS.find((t) => t.value === config.trajectory_type)
                ?.label || "Sinusoidal"
            }
            size="small"
            sx={{
              ml: 2,
              backgroundColor: getTrajectoryColor(config.trajectory_type),
              color: "#fff",
            }}
          />
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: "#9ca3af" }}>Trayectoria</InputLabel>
              <Select
                value={config.trajectory_type || "sinusoidal"}
                onChange={(e) =>
                  handleChange("trajectory_type", e.target.value)
                }
                label="Trayectoria"
                sx={{
                  color: "#fff",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#4b5563",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#6b7280",
                  },
                  "& .MuiSvgIcon-root": { color: "#9ca3af" },
                }}
              >
                {TRAJECTORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={3} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Duración (s)"
              type="number"
              value={config.duration_sec || 30}
              onChange={(e) =>
                handleChange("duration_sec", parseFloat(e.target.value))
              }
              slotProps={{
                htmlInput: { min: 5, max: 120, step: 5 },
              }}
              sx={{
                "& .MuiInputLabel-root": { color: "#9ca3af" },
                "& .MuiInputBase-input": { color: "#fff" },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#4b5563",
                },
              }}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Amplitud (°)"
              type="number"
              value={config.amplitude_deg || 15}
              onChange={(e) =>
                handleChange("amplitude_deg", parseFloat(e.target.value))
              }
              slotProps={{
                htmlInput: { min: 5, max: 45, step: 5 },
              }}
              sx={{
                "& .MuiInputLabel-root": { color: "#9ca3af" },
                "& .MuiInputBase-input": { color: "#fff" },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#4b5563",
                },
              }}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Sample Rate (Hz)"
              type="number"
              value={config.sample_rate_hz || 100}
              onChange={(e) =>
                handleChange("sample_rate_hz", parseFloat(e.target.value))
              }
              slotProps={{
                htmlInput: { min: 50, max: 200, step: 10 },
              }}
              sx={{
                "& .MuiInputLabel-root": { color: "#9ca3af" },
                "& .MuiInputBase-input": { color: "#fff" },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#4b5563",
                },
              }}
            />
          </Grid>

          <Grid item xs={6} sm={3} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={onRun}
              disabled={loading}
              sx={{
                height: "40px",
                backgroundColor: loading ? "#4b5563" : "#3b82f6",
                "&:hover": { backgroundColor: loading ? "#4b5563" : "#2563eb" },
              }}
            >
              {loading ? "Ejecutando..." : "Ejecutar Simulación"}
            </Button>
          </Grid>
        </Grid>

        <Accordion
          expanded={showAdvanced}
          onChange={() => setShowAdvanced(!showAdvanced)}
          sx={{
            backgroundColor: "#0f172a",
            "& .MuiAccordionSummary-root": { minHeight: 40 },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: "#9ca3af" }} />}
          >
            <Typography sx={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              {showAdvanced ? "Ocultar" : "Mostrar"} parámetros avanzados
              (U1-U6)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="U1: Ruido Acelerómetro (g/√Hz)"
                  type="number"
                  value={config.accel_noise || 0.0004}
                  onChange={(e) =>
                    handleChange("accel_noise", parseFloat(e.target.value))
                  }
                  slotProps={{
                    htmlInput: { step: 0.0001, min: 0 },
                  }}
                  sx={{
                    "& .MuiInputLabel-root": {
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                    },
                    "& .MuiInputBase-input": { color: "#fff" },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4b5563",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="U2: Ruido Giróscopo (°/s/√Hz)"
                  type="number"
                  value={config.gyro_noise || 0.015}
                  onChange={(e) =>
                    handleChange("gyro_noise", parseFloat(e.target.value))
                  }
                  slotProps={{
                    htmlInput: { step: 0.001, min: 0 },
                  }}
                  sx={{
                    "& .MuiInputLabel-root": {
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                    },
                    "& .MuiInputBase-input": { color: "#fff" },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4b5563",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="U3: Sesgo Giróscopo (°/s)"
                  type="number"
                  value={config.gyro_bias || 0.5}
                  onChange={(e) =>
                    handleChange("gyro_bias", parseFloat(e.target.value))
                  }
                  slotProps={{
                    htmlInput: { step: 0.1, min: 0 },
                  }}
                  sx={{
                    "& .MuiInputLabel-root": {
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                    },
                    "& .MuiInputBase-input": { color: "#fff" },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4b5563",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="U4: Desalineación (°)"
                  type="number"
                  value={config.misalignment || 0.5}
                  onChange={(e) =>
                    handleChange("misalignment", parseFloat(e.target.value))
                  }
                  slotProps={{
                    htmlInput: { step: 0.1, min: 0 },
                  }}
                  sx={{
                    "& .MuiInputLabel-root": {
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                    },
                    "& .MuiInputBase-input": { color: "#fff" },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4b5563",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="U5: Factor Vibración"
                  type="number"
                  value={config.vibration_factor || 0.02}
                  onChange={(e) =>
                    handleChange("vibration_factor", parseFloat(e.target.value))
                  }
                  slotProps={{
                    htmlInput: { step: 0.01, min: 0, max: 1 },
                  }}
                  sx={{
                    "& .MuiInputLabel-root": {
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                    },
                    "& .MuiInputBase-input": { color: "#fff" },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4b5563",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="U6: Jitter Ratio"
                  type="number"
                  value={config.jitter || 0.01}
                  onChange={(e) =>
                    handleChange("jitter", parseFloat(e.target.value))
                  }
                  slotProps={{
                    htmlInput: { step: 0.01, min: 0, max: 0.5 },
                  }}
                  sx={{
                    "& .MuiInputLabel-root": {
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                    },
                    "& .MuiInputBase-input": { color: "#fff" },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#4b5563",
                    },
                  }}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};
