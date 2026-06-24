//! Módulo de simulación SIL (Software-in-the-Loop)
//! Para validación de artículo Q1

pub mod mpu6050_specs;
pub mod physical_models;
pub mod paper_reporter;
pub mod trajectory;
pub mod imu_simulator;
pub mod kalman_runner;
pub mod validator;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TrajectoryType {
    Sinusoidal,
    Step,
    Composite,
    RandomWalk,
    Impulse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationConfig {
    pub trajectory_type: TrajectoryType,
    pub duration_sec: f64,
    pub max_amplitude_deg: f64,
    pub sample_rate_hz: f64,
    
    // U1-U6
    pub accel_noise_density: f64,
    pub gyro_noise_density: f64,
    pub gyro_bias_drift: f64,
    pub misalignment_deg: f64,
    pub vibration_aliasing_factor: f64,
    pub sampling_jitter_ratio: f64,
    
    pub motor_freq_hz: Vec<f64>,
    pub random_seed: Option<u64>,
}

impl Default for SimulationConfig {
    fn default() -> Self {
        Self {
            trajectory_type: TrajectoryType::Sinusoidal,
            duration_sec: 30.0,
            max_amplitude_deg: 10.0,
            sample_rate_hz: 100.0,
            accel_noise_density: 0.0004,
            gyro_noise_density: 0.015,
            gyro_bias_drift: 0.5,
            misalignment_deg: 0.5,
            vibration_aliasing_factor: 0.02,
            sampling_jitter_ratio: 0.01,
            motor_freq_hz: vec![150.0, 180.0],
            random_seed: Some(42),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub config_summary: ConfigSummary,
    pub metrics: ValidationMetrics,
    pub csv_data: String,
    pub summary_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSummary {
    pub trajectory_type: String,
    pub duration_sec: f64,
    pub amplitude_deg: f64,
    pub sample_rate_hz: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationMetrics {
    pub rmse_deg: f64,
    pub max_error_deg: f64,
    pub mean_error_deg: f64,
    pub std_error_deg: f64,
    pub mean_uncertainty_deg: f64,
    pub max_uncertainty_deg: f64,
    pub coverage_1sigma: f64,
    pub coverage_2sigma: f64,
    pub coverage_3sigma: f64,
    pub uncertainty_error_correlation: f64,
    pub en_score: f64,
    pub kalman_delay_ms: f64,
    pub validation_passed: bool,
    pub recommendations: Vec<String>,
}

pub async fn run_simulation(config: SimulationConfig) -> anyhow::Result<SimulationResult> {
    use trajectory::TrajectoryGenerator;
    use imu_simulator::ImuSimulator;
    use kalman_runner::KalmanRunner;
    use validator::SimulationValidator;
    
    // 1. Ground truth
    let mut generator = TrajectoryGenerator::new(config.clone());
    let trajectory = generator.generate()?;
    
    // 2. Simular IMU
    let mut imu_sim = ImuSimulator::new(config.clone());
    let imu_data = imu_sim.simulate_from_trajectory(&trajectory)?;
    
    // 3. Kalman
    let mut runner = KalmanRunner::new();
    let estimates = runner.process_imu_data(&imu_data)?;
    
    // 4. Validar
    let validator = SimulationValidator::new(config.clone());
    let validation_points = validator.align_and_compute_errors(&trajectory, &estimates)?;
    let result = validator.validate(&trajectory, &estimates)?;
    
    // 5. CSV
    let mut csv = String::from("time_sec,angle_true_deg,angle_estimated_deg,error_deg,uncertainty_deg,within_1sigma,within_2sigma,within_3sigma\n");
    for p in &validation_points {
        csv.push_str(&format!("{:.6},{:.6},{:.6},{:.6},{:.6},{},{},{}\n",
            p.time_sec, p.angle_true_deg, p.angle_estimated_deg,
            p.error_deg, p.uncertainty_deg,
            p.within_1sigma as u8, p.within_2sigma as u8, p.within_3sigma as u8
        ));
    }
    
    Ok(SimulationResult {
        config_summary: ConfigSummary {
            trajectory_type: format!("{:?}", config.trajectory_type),
            duration_sec: config.duration_sec,
            amplitude_deg: config.max_amplitude_deg,
            sample_rate_hz: config.sample_rate_hz,
        },
        metrics: ValidationMetrics {
            rmse_deg: result.rmse_deg,
            max_error_deg: result.max_error_deg,
            mean_error_deg: result.mean_error_deg,
            std_error_deg: result.std_error_deg,
            mean_uncertainty_deg: result.mean_uncertainty_deg,
            max_uncertainty_deg: result.max_uncertainty_deg,
            coverage_1sigma: result.coverage_1sigma,
            coverage_2sigma: result.coverage_2sigma,
            coverage_3sigma: result.coverage_3sigma,
            uncertainty_error_correlation: result.uncertainty_error_correlation,
            en_score: result.en_score,
            kalman_delay_ms: result.kalman_delay_ms,
            validation_passed: result.validation_passed,
            recommendations: result.recommendations,
        },
        csv_data: csv,
        summary_text: format!(
            "Simulación {:?}: RMSE={:.3}°, Error máx={:.3}°, Cobertura 2σ={:.1}% | {}",
            config.trajectory_type, result.rmse_deg, result.max_error_deg,
            result.coverage_2sigma,
            if result.validation_passed { "✅ VÁLIDO" } else { "❌ REVISAR" }
        ),
    })
}

pub async fn run_batch_simulation() -> anyhow::Result<Vec<SimulationResult>> {
    let configs = vec![
        SimulationConfig {
            trajectory_type: TrajectoryType::Sinusoidal,
            duration_sec: 30.0,
            max_amplitude_deg: 10.0,
            ..Default::default()
        },
        SimulationConfig {
            trajectory_type: TrajectoryType::Step,
            duration_sec: 20.0,
            max_amplitude_deg: 15.0,
            ..Default::default()
        },
        SimulationConfig {
            trajectory_type: TrajectoryType::Composite,
            duration_sec: 40.0,
            max_amplitude_deg: 12.0,
            ..Default::default()
        },
    ];
    
    let mut results = Vec::new();
    for config in configs {
        let result = run_simulation(config).await?;
        results.push(result);
    }
    Ok(results)
}