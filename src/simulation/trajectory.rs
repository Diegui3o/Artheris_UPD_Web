use super::{SimulationConfig, TrajectoryType};
use rand::prelude::*;
use rand_chacha::ChaCha8Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryPoint {
    pub time_sec: f64,
    pub angle_true_deg: f64,
    pub angular_velocity_true_dps: f64,
    pub angular_acceleration_true_dps2: f64,
}

pub struct TrajectoryGenerator {
    config: SimulationConfig,
    rng: ChaCha8Rng,
}

impl TrajectoryGenerator {
    pub fn new(config: SimulationConfig) -> Self {
        let seed = config.random_seed.unwrap_or(42);
        Self { config, rng: ChaCha8Rng::seed_from_u64(seed) }
    }
    
    pub fn generate(&mut self) -> anyhow::Result<Vec<TrajectoryPoint>> {
        match self.config.trajectory_type {
            TrajectoryType::Sinusoidal => self.generate_sinusoidal(),
            TrajectoryType::Step => self.generate_step(),
            TrajectoryType::Composite => self.generate_composite(),
            TrajectoryType::RandomWalk => self.generate_random_walk(),
            TrajectoryType::Impulse => self.generate_impulse(),
        }
    }
    
    fn generate_sinusoidal(&mut self) -> anyhow::Result<Vec<TrajectoryPoint>> {
        let dt = 1.0 / self.config.sample_rate_hz;
        let num_samples = (self.config.duration_sec * self.config.sample_rate_hz) as usize;
        let freq_hz = 0.5;
        let amplitude = self.config.max_amplitude_deg;
        let omega = 2.0 * std::f64::consts::PI * freq_hz;
        
        (0..num_samples)
            .map(|i| {
                let t = i as f64 * dt;
                Ok(TrajectoryPoint {
                    time_sec: t,
                    angle_true_deg: amplitude * (omega * t).sin(),
                    angular_velocity_true_dps: amplitude * omega * (omega * t).cos(),
                    angular_acceleration_true_dps2: -amplitude * omega * omega * (omega * t).sin(),
                })
            })
            .collect()
    }
    
    fn generate_step(&mut self) -> anyhow::Result<Vec<TrajectoryPoint>> {
        let dt = 1.0 / self.config.sample_rate_hz;
        let num_samples = (self.config.duration_sec * self.config.sample_rate_hz) as usize;
        let step_time = self.config.duration_sec * 0.2;
        let amplitude = self.config.max_amplitude_deg;
        
        (0..num_samples)
            .map(|i| {
                let t = i as f64 * dt;
                Ok(TrajectoryPoint {
                    time_sec: t,
                    angle_true_deg: if t < step_time { 0.0 } else { amplitude },
                    angular_velocity_true_dps: 0.0,
                    angular_acceleration_true_dps2: 0.0,
                })
            })
            .collect()
    }
    
    fn generate_composite(&mut self) -> anyhow::Result<Vec<TrajectoryPoint>> {
        let dt = 1.0 / self.config.sample_rate_hz;
        let num_samples = (self.config.duration_sec * self.config.sample_rate_hz) as usize;
        let amplitude = self.config.max_amplitude_deg;
        let freqs = [0.2, 0.5, 1.5];
        let weights = [0.5, 0.3, 0.2];
        
        (0..num_samples)
            .map(|i| {
                let t = i as f64 * dt;
                let mut angle = 0.0;
                let mut vel = 0.0;
                let mut accel = 0.0;
                
                for (freq, &w) in freqs.iter().zip(weights.iter()) {
                    let omega = 2.0 * std::f64::consts::PI * freq;
                    angle += w * amplitude * (omega * t).sin();
                    vel += w * amplitude * omega * (omega * t).cos();
                    accel += -w * amplitude * omega * omega * (omega * t).sin();
                }
                
                Ok(TrajectoryPoint {
                    time_sec: t,
                    angle_true_deg: angle,
                    angular_velocity_true_dps: vel,
                    angular_acceleration_true_dps2: accel,
                })
            })
            .collect()
    }
    
    fn generate_random_walk(&mut self) -> anyhow::Result<Vec<TrajectoryPoint>> {
        let dt = 1.0 / self.config.sample_rate_hz;
        let num_samples = (self.config.duration_sec * self.config.sample_rate_hz) as usize;
        let max_angle = self.config.max_amplitude_deg;
        let step_std = 0.5;
        let mut angle: f64 = 0.0;
        
        (0..num_samples)
            .map(|i| {
                let t = i as f64 * dt;
                let step: f64 = self.rng.random_range(-step_std..step_std);
                angle = (angle + step) * 0.99;
                angle = angle.clamp(-max_angle, max_angle);
                
                Ok(TrajectoryPoint {
                    time_sec: t,
                    angle_true_deg: angle,
                    angular_velocity_true_dps: step / dt,
                    angular_acceleration_true_dps2: 0.0,
                })
            })
            .collect()
    }
    
    fn generate_impulse(&mut self) -> anyhow::Result<Vec<TrajectoryPoint>> {
        let dt = 1.0 / self.config.sample_rate_hz;
        let num_samples = (self.config.duration_sec * self.config.sample_rate_hz) as usize;
        let impulse_time = self.config.duration_sec * 0.3;
        let impulse_duration = 0.2;
        let amplitude = self.config.max_amplitude_deg;
        
        (0..num_samples)
            .map(|i| {
                let t = i as f64 * dt;
                let angle = if t >= impulse_time && t < impulse_time + impulse_duration {
                    amplitude * ((t - impulse_time) * std::f64::consts::PI / impulse_duration).sin()
                } else {
                    0.0
                };
                Ok(TrajectoryPoint {
                    time_sec: t,
                    angle_true_deg: angle,
                    angular_velocity_true_dps: 0.0,
                    angular_acceleration_true_dps2: 0.0,
                })
            })
            .collect()
    }
}