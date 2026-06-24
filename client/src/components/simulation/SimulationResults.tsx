// client/src/components/simulation/SimulationResults.tsx

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import DownloadIcon from "@mui/icons-material/Download";
import { SimulationResponse } from "../../types/simulation";

interface Props {
  result: SimulationResponse;
  onDownloadCSV: () => void;
}

export const SimulationResults: React.FC<Props> = ({
  result,
  onDownloadCSV,
}) => {
  const { metrics, config_summary, success, summary_text } = result;

  const MetricCard: React.FC<{
    label: string;
    value: string | number;
    unit?: string;
    color?: string;
  }> = ({ label, value, unit, color = "#3b82f6" }) => (
    <Card sx={{ backgroundColor: "#1e293b", height: "100%" }}>
      <CardContent sx={{ textAlign: "center" }}>
        <Typography variant="h4" sx={{ color, fontWeight: 700 }}>
          {typeof value === "number" ? value.toFixed(3) : value}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "#9ca3af", display: "block", mt: 1 }}
        >
          {label} {unit && `(${unit})`}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Status Alert */}
      <Alert
        severity={success ? "success" : "warning"}
        icon={success ? <CheckCircleIcon /> : <InfoIcon />}
        sx={{
          mb: 3,
          backgroundColor: success ? "#065f46" : "#78350f",
          color: "#fff",
          "& .MuiAlert-icon": { color: "#fff" },
        }}
      >
        {summary_text}
      </Alert>

      {/* Configuration Summary */}
      <Box sx={{ mb: 3, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Chip
          label={`Trayectoria: ${config_summary.trajectory_type}`}
          sx={{ backgroundColor: "#374151", color: "#fff" }}
        />
        <Chip
          label={`Duración: ${config_summary.duration_sec}s`}
          sx={{ backgroundColor: "#374151", color: "#fff" }}
        />
        <Chip
          label={`Amplitud: ${config_summary.amplitude_deg}°`}
          sx={{ backgroundColor: "#374151", color: "#fff" }}
        />
        <Chip
          label={`Sample Rate: ${config_summary.sample_rate_hz}Hz`}
          sx={{ backgroundColor: "#374151", color: "#fff" }}
        />
      </Box>

      {/* Main Metrics */}
      <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 600 }}>
        📊 Métricas de Validación
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <MetricCard
            label="RMSE"
            value={metrics.rmse_deg}
            unit="°"
            color="#ef4444"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            label="Error Máximo"
            value={metrics.max_error_deg}
            unit="°"
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            label="Cobertura 2σ"
            value={metrics.coverage_2sigma}
            unit="%"
            color="#10b981"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            label="Validación"
            value={metrics.validation_passed ? "✅ PASÓ" : "❌ FALLÓ"}
            color={metrics.validation_passed ? "#10b981" : "#ef4444"}
          />
        </Grid>
      </Grid>

      {/* Secondary Metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={2.4}>
          <Typography sx={{ color: "#9ca3af", fontSize: "0.75rem" }}>
            Error Medio
          </Typography>
          <Typography sx={{ color: "#fff", fontWeight: 600 }}>
            {metrics.mean_error_deg.toFixed(3)}°
          </Typography>
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <Typography sx={{ color: "#9ca3af", fontSize: "0.75rem" }}>
            Desv. Estándar
          </Typography>
          <Typography sx={{ color: "#fff", fontWeight: 600 }}>
            {metrics.std_error_deg.toFixed(3)}°
          </Typography>
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <Typography sx={{ color: "#9ca3af", fontSize: "0.75rem" }}>
            Incert. Media
          </Typography>
          <Typography sx={{ color: "#fff", fontWeight: 600 }}>
            {metrics.mean_uncertainty_deg.toFixed(3)}°
          </Typography>
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <Typography sx={{ color: "#9ca3af", fontSize: "0.75rem" }}>
            Cobertura 1σ
          </Typography>
          <Typography sx={{ color: "#fff", fontWeight: 600 }}>
            {metrics.coverage_1sigma.toFixed(1)}%
          </Typography>
        </Grid>
        <Grid item xs={6} sm={2.4}>
          <Typography sx={{ color: "#9ca3af", fontSize: "0.75rem" }}>
            Retardo Kalman
          </Typography>
          <Typography sx={{ color: "#fff", fontWeight: 600 }}>
            {metrics.kalman_delay_ms.toFixed(1)}ms
          </Typography>
        </Grid>
      </Grid>

      {/* Recommendations */}
      {metrics.recommendations.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h6"
            sx={{ color: "#fff", mb: 1, fontWeight: 600 }}
          >
            💡 Recomendaciones
          </Typography>
          <List sx={{ backgroundColor: "#1e293b", borderRadius: 2, p: 1 }}>
            {metrics.recommendations.map((rec, idx) => (
              <ListItem key={idx}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <InfoIcon sx={{ color: "#3b82f6", fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText
                  primary={rec}
                  sx={{ "& .MuiListItemText-primary": { color: "#d1d5db" } }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Download Button */}
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={onDownloadCSV}
        sx={{
          color: "#3b82f6",
          borderColor: "#3b82f6",
          "&:hover": {
            borderColor: "#2563eb",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
          },
        }}
      >
        Descargar CSV Completo
      </Button>
    </Box>
  );
};
