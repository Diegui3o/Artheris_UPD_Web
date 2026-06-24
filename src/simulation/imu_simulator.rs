//! MPU-6050 IMU Simulator with physics-based error models
//!
//! Implements all six uncertainty contributors (U1-U6) with traceable parameters.

use super::{SimulationConfig, trajectory::TrajectoryPoint};
use super::mpu6050_specs as specs;
use super::physical_models::{VibrationAliasingModel, GyroBiasModel, MisalignmentModel, JitterModel};
use rand::prelude::*;
use rand_chacha::ChaCha8Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImuReading {
    pub time_sec: f64,
    pub accel_x_g: f64,
    pub accel_z_g: f64,
    pub gyro_y_dps: f64,
    pub actual_dt: f64,  // Actual sampling interval with jitter
}

pub struct ImuSimulator {
    config: SimulationConfig,
    rng: ChaCha8Rng,
    
    // Physical error models
    vibration_model: VibrationAliasingModel,
    gyro_bias_model: GyroBiasModel,
    misalignment_model: MisalignmentModel,
    jitter_model: JitterModel,
    
    // Static biases (from calibration residuals)
    accel_bias_x: f64,
    accel_bias_z: f64,
}

impl ImuSimulator {
    pub fn new(config: SimulationConfig) -> Self {
        let seed = config.random_seed.unwrap_or(42);
        let mut rng = ChaCha8Rng::seed_from_u64(seed);
        
        // Initialize with datasheet-derived parameters
        let vibration_model = VibrationAliasingModel::with_sample_rate(config.sample_rate_hz);
        let gyro_bias_model = GyroBiasModel::default();
        let misalignment_model = MisalignmentModel::default();
        let jitter_model = JitterModel {
            nominal_dt: 1.0 / config.sample_rate_hz,
            jitter_ratio: config.sampling_jitter_ratio,
        };
        
        // Residual biases after calibration (small random values)
        let accel_bias_x = rng.random_range(-0.02..0.02);
        let accel_bias_z = rng.random_range(-0.02..0.02);
        
        Self {
            config,
            rng,
            vibration_model,
            gyro_bias_model,
            misalignment_model,
            jitter_model,
            accel_bias_x,
            accel_bias_z,
        }
    }
    
    pub fn simulate_from_trajectory(
        &mut self,
        trajectory: &[TrajectoryPoint],
    ) -> anyhow::Result<Vec<ImuReading>> {
        let mut readings = Vec::with_capacity(trajectory.len());
        
        for point in trajectory {
            // U5: Generate actual dt with jitter
            let jitter_noise: f64 = self.rng.random_range(-1.0..1.0);
            let actual_dt = self.jitter_model.actual_dt(jitter_noise);
            
            let reading = self.simulate_single_point(point, actual_dt)?;
            readings.push(reading);
        }
        
        Ok(readings)
    }
    
    fn simulate_single_point(
        &mut self,
        point: &TrajectoryPoint,
        dt: f64,
    ) -> anyhow::Result<ImuReading> {
        let angle_rad = point.angle_true_deg.to_radians();
        let angular_vel_dps = point.angular_velocity_true_dps;
        
        // ====================================================================
        // IDEAL MEASUREMENTS
        // ====================================================================
        
        // Accelerometer measures gravity projection
        let accel_x_ideal = angle_rad.sin();
        let accel_z_ideal = angle_rad.cos();
        let gyro_ideal = angular_vel_dps;
        
        // ====================================================================
        // APPLY ERROR MODELS (U1-U6)
        // ====================================================================
        
        // U1: Accelerometer white noise (from datasheet)
        let accel_noise_std = specs::accel_noise_std_g(self.config.sample_rate_hz);
        let accel_x_noise: f64 = self.rng.random_range(-accel_noise_std..accel_noise_std) * 3.0;
        let accel_z_noise: f64 = self.rng.random_range(-accel_noise_std..accel_noise_std) * 3.0;
        
        // U2: Vibration aliasing (physics-based model)
        let vibration = self.vibration_model.compute(point.time_sec) 
            * self.config.vibration_aliasing_factor;
        
        // U3: Gyroscope bias drift (Gauss-Markov)
        let bias_noise: f64 = self.rng.random_range(-1.0..1.0);
        let gyro_bias = self.gyro_bias_model.update(dt, bias_noise);
        
        // Gyroscope white noise (from datasheet)
        let gyro_noise_std = specs::gyro_noise_std_dps(self.config.sample_rate_hz);
        let gyro_noise: f64 = self.rng.random_range(-gyro_noise_std..gyro_noise_std) * 3.0;
        
        // U4: Mounting misalignment
        let (accel_x_misaligned, accel_z_misaligned) = 
            self.misalignment_model.apply(accel_x_ideal, accel_z_ideal);
        
        // Quantization noise (Type B)
        let accel_quant = specs::accel_quantization_uncertainty_g();
        let gyro_quant = specs::gyro_quantization_uncertainty_dps();
        let accel_x_quant: f64 = self.rng.random_range(-accel_quant..accel_quant);
        let accel_z_quant: f64 = self.rng.random_range(-accel_quant..accel_quant);
        let gyro_quant_noise: f64 = self.rng.random_range(-gyro_quant..gyro_quant);
        
        // ====================================================================
        // COMBINE ALL CONTRIBUTIONS
        // ====================================================================
        
        let accel_x = accel_x_misaligned 
            + self.accel_bias_x 
            + accel_x_noise 
            + vibration 
            + accel_x_quant;
            
        let accel_z = accel_z_misaligned 
            + self.accel_bias_z 
            + accel_z_noise 
            + vibration * 0.5  // Vibration couples less to Z axis
            + accel_z_quant;
            
        let gyro = gyro_ideal 
            + gyro_bias 
            + gyro_noise 
            + gyro_quant_noise;
        
        Ok(ImuReading {
            time_sec: point.time_sec,
            accel_x_g: accel_x.clamp(-2.0, 2.0),
            accel_z_g: accel_z.clamp(-2.0, 2.0),
            gyro_y_dps: gyro.clamp(-500.0, 500.0),
            actual_dt: dt,
        })
    }
    
    /// Export model parameters for paper reporting
    pub fn get_model_parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "U1_accel_noise": {
                "density_g_per_rt_hz": specs::ACCEL_NOISE_DENSITY_G_PER_RT_HZ,
                "std_at_100hz_g": specs::accel_noise_std_g(100.0),
                "source": "MPU-6050 datasheet §6.2"
            },
            "U2_vibration": {
                "f1_hz": self.vibration_model.f1,
                "f2_hz": self.vibration_model.f2,
                "aliased_frequencies": self.vibration_model.aliased_frequencies(),
                "dlpf_cutoff_hz": specs::DLPF_BANDWIDTH_HZ,
                "source": "Motor specs + MPU-6050 §4.8"
            },
            "U3_gyro_bias": {
                "instability_dps": specs::GYRO_BIAS_INSTABILITY_DPS,
                "source": "MPU-6050 datasheet §6.3"
            },
            "U4_misalignment": {
                "angle_deg": specs::MOUNTING_MISALIGNMENT_DEG,
                "source": "Manufacturing tolerance"
            },
            "U5_jitter": {
                "ratio": self.config.sampling_jitter_ratio,
                "source": "ESP32-S3 TRM §11"
            },
        })
    }
}