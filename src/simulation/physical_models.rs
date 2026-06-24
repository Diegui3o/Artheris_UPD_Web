//! Physics-based models for IMU error sources
//! 
//! Each model is derived from physical principles and datasheet specifications,
//! providing metrological traceability without requiring hardware measurements.

use std::f64::consts::PI;
use crate::simulation::mpu6050_specs as specs;

/// Aliasing model for rotor vibration
/// 
/// Rotor vibration occurs at the motor electrical frequency and its harmonics.
/// The MPU-6050 internal DLPF attenuates high frequencies before sampling.
/// However, energy above the Nyquist frequency folds back into the measurement band.
#[derive(Debug, Clone)]
pub struct VibrationAliasingModel {
    /// Fundamental motor electrical frequency (Hz)
    pub f1: f64,
    /// Second harmonic frequency (Hz)
    pub f2: f64,
    /// Third harmonic frequency (Hz)
    pub f3: f64,
    /// Sampling frequency (Hz)
    pub fs: f64,
    /// Fundamental amplitude (g)
    pub a1: f64,
    /// Second harmonic amplitude (g)
    pub a2: f64,
    /// Third harmonic amplitude (g)
    pub a3: f64,
}

impl Default for VibrationAliasingModel {
    fn default() -> Self {
        Self {
            f1: specs::MOTOR_ELECTRICAL_FREQ_HOVER_HZ,
            f2: specs::MOTOR_ELECTRICAL_FREQ_HARMONIC_2,
            f3: specs::MOTOR_ELECTRICAL_FREQ_HARMONIC_3,
            fs: 100.0, // Will be overridden
            a1: specs::VIBRATION_AMPLITUDE_FUNDAMENTAL_G,
            a2: specs::VIBRATION_AMPLITUDE_HARMONIC_2_G,
            a3: specs::VIBRATION_AMPLITUDE_HARMONIC_3_G,
        }
    }
}

impl VibrationAliasingModel {
    pub fn with_sample_rate(fs: f64) -> Self {
        Self { fs, ..Default::default() }
    }
    
    /// Compute the aliased frequency after sampling
    /// f_alias = |f - n*fs| where n is the integer that minimizes the result
    fn aliased_frequency(f: f64, fs: f64) -> f64 {
        let nyquist = fs / 2.0;
        if f <= nyquist {
            f
        } else {
            let n = (f / fs).round();
            (f - n * fs).abs()
        }
    }
    
    /// Compute the total vibration acceleration at time t
    pub fn compute(&self, t: f64) -> f64 {
        // Apply DLPF attenuation to each harmonic
        let att1 = specs::dlpf_attenuation(self.f1);
        let att2 = specs::dlpf_attenuation(self.f2);
        let att3 = specs::dlpf_attenuation(self.f3);
        
        // Get aliased frequencies
        let f1_alias = Self::aliased_frequency(self.f1, self.fs);
        let f2_alias = Self::aliased_frequency(self.f2, self.fs);
        let f3_alias = Self::aliased_frequency(self.f3, self.fs);
        
        // Combine harmonics with attenuation
        self.a1 * att1 * (2.0 * PI * f1_alias * t).sin()
            + self.a2 * att2 * (2.0 * PI * f2_alias * t).sin()
            + self.a3 * att3 * (2.0 * PI * f3_alias * t).sin()
    }
    
    /// Return the effective aliased frequencies for reporting
    pub fn aliased_frequencies(&self) -> Vec<(f64, f64, f64)> {
        vec![
            (self.f1, Self::aliased_frequency(self.f1, self.fs), specs::dlpf_attenuation(self.f1)),
            (self.f2, Self::aliased_frequency(self.f2, self.fs), specs::dlpf_attenuation(self.f2)),
            (self.f3, Self::aliased_frequency(self.f3, self.fs), specs::dlpf_attenuation(self.f3)),
        ]
    }
}

/// Gyroscope bias drift model (first-order Gauss-Markov process)
#[derive(Debug, Clone)]
pub struct GyroBiasModel {
    /// Current bias value (°/s)
    pub current_bias: f64,
    /// Bias instability (1σ, °/s)
    pub instability: f64,
    /// Correlation time constant (s)
    pub tau: f64,
}

impl Default for GyroBiasModel {
    fn default() -> Self {
        Self {
            current_bias: 0.0,
            instability: specs::GYRO_BIAS_INSTABILITY_DPS,
            tau: 100.0, // Typical correlation time ~100s
        }
    }
}

impl GyroBiasModel {
    /// Update bias using Gauss-Markov process
    /// E[b(t+dt)] = b(t) * exp(-dt/tau)
    /// Var[b(t+dt)] = σ² * (1 - exp(-2*dt/tau))
    pub fn update(&mut self, dt: f64, noise: f64) -> f64 {
        let phi = (-dt / self.tau).exp();
        let sigma_d = self.instability * (1.0 - phi * phi).sqrt();
        
        self.current_bias = self.current_bias * phi + sigma_d * noise;
        self.current_bias
    }
}

/// Misalignment model (cross-axis sensitivity)
#[derive(Debug, Clone)]
pub struct MisalignmentModel {
    /// Misalignment angle between IMU x-axis and body x-axis (radians)
    pub alpha_xy: f64,
    /// Misalignment angle between IMU x-axis and body y-axis (radians)
    pub alpha_xz: f64,
}

impl Default for MisalignmentModel {
    fn default() -> Self {
        let misalign_rad = specs::MOUNTING_MISALIGNMENT_DEG.to_radians();
        Self {
            alpha_xy: misalign_rad,
            alpha_xz: misalign_rad * 0.5, // Typically smaller in orthogonal axis
        }
    }
}

impl MisalignmentModel {
    /// Apply misalignment to true acceleration vector
    /// a_measured = R_misalign * a_true
    pub fn apply(&self, ax_true: f64, az_true: f64) -> (f64, f64) {
        // Small-angle approximation for misalignment matrix
        let ax_meas = ax_true + self.alpha_xy * az_true;
        let az_meas = az_true - self.alpha_xy * ax_true + self.alpha_xz * ax_true;
        (ax_meas, az_meas)
    }
}

/// Timing jitter model
#[derive(Debug, Clone)]
pub struct JitterModel {
    /// Nominal sampling period (s)
    pub nominal_dt: f64,
    /// Jitter standard deviation as fraction of nominal period
    pub jitter_ratio: f64,
}

impl Default for JitterModel {
    fn default() -> Self {
        Self {
            nominal_dt: 0.01, // 100 Hz
            jitter_ratio: specs::TIMER_JITTER_RATIO,
        }
    }
}

impl JitterModel {
    /// Generate actual sampling interval with jitter
    pub fn actual_dt(&self, noise: f64) -> f64 {
        let jitter_std = self.nominal_dt * self.jitter_ratio;
        (self.nominal_dt + jitter_std * noise).max(0.0)
    }
}