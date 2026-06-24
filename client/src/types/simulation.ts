// client/src/types/simulation.ts

export type TrajectoryType =
  | "sinusoidal"
  | "step"
  | "composite"
  | "random"
  | "impulse";

export interface SimulationConfig {
  trajectory_type?: TrajectoryType;
  duration_sec?: number;
  amplitude_deg?: number;
  sample_rate_hz?: number;
  accel_noise?: number;
  gyro_noise?: number;
  gyro_bias?: number;
  misalignment?: number;
  vibration_factor?: number;
  jitter?: number;
}

export interface SimulationConfigSummary {
  trajectory_type: string;
  duration_sec: number;
  amplitude_deg: number;
  sample_rate_hz: number;
}

export interface SimulationMetrics {
  rmse_deg: number;
  max_error_deg: number;
  mean_error_deg: number;
  std_error_deg: number;
  mean_uncertainty_deg: number;
  max_uncertainty_deg: number;
  coverage_1sigma: number;
  coverage_2sigma: number;
  coverage_3sigma: number;
  uncertainty_error_correlation: number;
  kalman_delay_ms: number;
  validation_passed: boolean;
  recommendations: string[];
}

export interface SimulationResponse {
  success: boolean;
  config_summary: SimulationConfigSummary;
  metrics: SimulationMetrics;
  csv_data: string;
  summary_text: string;
}

export interface BatchSimulationResult {
  config_summary: SimulationConfigSummary;
  metrics: SimulationMetrics;
  validation_passed: boolean;
}
