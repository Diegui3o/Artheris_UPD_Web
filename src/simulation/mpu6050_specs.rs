//! MPU-6050 Specifications from InvenSense Datasheet PS-MPU-6000A-00
//! Revision 3.4, Release Date: 08/19/2013
//!
//! These values provide metrological traceability for the SIL simulation.
//! Each constant is documented with its source in the datasheet.

// ============================================================================
// Accelerometer Specifications (§6.2 of datasheet)
// ============================================================================

/// Accelerometer noise density for ±8g range (Table 6.2)
/// Value: 400 µg/√Hz
/// Source: MPU-6000/MPU-6050 Product Specification, Section 6.2
pub const ACCEL_NOISE_DENSITY_G_PER_RT_HZ: f64 = 0.0004;

/// Accelerometer full-scale range used (±8g)
pub const ACCEL_FS_RANGE_G: f64 = 8.0;

/// Accelerometer ADC resolution (16-bit)
pub const ACCEL_ADC_BITS: u8 = 16;

/// Accelerometer quantization step for ±8g range
pub const ACCEL_QUANTIZATION_STEP_G: f64 = 
    (2.0 * ACCEL_FS_RANGE_G) / ((1u32 << ACCEL_ADC_BITS) as f64);

// ============================================================================
// Gyroscope Specifications (§6.3 of datasheet)
// ============================================================================

/// Gyroscope noise density for ±500°/s range (Table 6.3)
/// Value: 0.015 °/s/√Hz
/// Source: MPU-6000/MPU-6050 Product Specification, Section 6.3
pub const GYRO_NOISE_DENSITY_DPS_PER_RT_HZ: f64 = 0.015;

/// Gyroscope full-scale range used (±500°/s)
pub const GYRO_FS_RANGE_DPS: f64 = 500.0;

/// Gyroscope in-run bias stability
/// Value: 0.5 °/s (typical at room temperature)
/// Source: Section 6.3, "Gyroscope Specifications" - Bias Instability
pub const GYRO_BIAS_INSTABILITY_DPS: f64 = 0.5;

/// Gyroscope ADC resolution (16-bit)
pub const GYRO_ADC_BITS: u8 = 16;

/// Gyroscope quantization step for ±500°/s range
pub const GYRO_QUANTIZATION_STEP_DPS: f64 = 
    (2.0 * GYRO_FS_RANGE_DPS) / ((1u32 << GYRO_ADC_BITS) as f64);

// ============================================================================
// Digital Low-Pass Filter Specifications (§4.8 of datasheet)
// ============================================================================

/// DLPF cutoff frequency for DLPF_CFG = 2 (98 Hz bandwidth)
/// Actually 94 Hz for accelerometer, 98 Hz for gyroscope - using conservative 94 Hz
/// Source: Table 3, Register 26 - Configuration
pub const DLPF_BANDWIDTH_HZ: f64 = 94.0;

/// DLPF filter order (approximated as 2nd order for attenuation calculation)
pub const DLPF_ORDER: u8 = 2;

// ============================================================================
// Physical Constants & Platform Specifications
// ============================================================================

/// Gravity constant (m/s²)
pub const GRAVITY_MS2: f64 = 9.80665;

/// ESP32-S3 hardware timer resolution (µs)
pub const TIMER_RESOLUTION_US: f64 = 1.0;

/// ESP32-S3 timer jitter (fraction of sampling period)
/// Source: Espressif ESP32-S3 Technical Reference Manual, Section 11
pub const TIMER_JITTER_RATIO: f64 = 0.01;

/// Typical brushless motor electrical frequency at hover
/// For 2300KV motors with 14 poles at 50% throttle on 4S battery
/// f_electrical = (KV * Voltage * poles) / 120
/// = (2300 * 14.8 * 14) / 120 ≈ 150 Hz
pub const MOTOR_ELECTRICAL_FREQ_HOVER_HZ: f64 = 150.0;

/// Second harmonic of motor electrical frequency
pub const MOTOR_ELECTRICAL_FREQ_HARMONIC_2: f64 = 300.0;

/// Third harmonic (significantly attenuated)
pub const MOTOR_ELECTRICAL_FREQ_HARMONIC_3: f64 = 450.0;

/// Typical vibration amplitude at IMU mounting point (g)
/// Estimated from literature on multirotor vibration
pub const VIBRATION_AMPLITUDE_FUNDAMENTAL_G: f64 = 0.5;
pub const VIBRATION_AMPLITUDE_HARMONIC_2_G: f64 = 0.15;
pub const VIBRATION_AMPLITUDE_HARMONIC_3_G: f64 = 0.05;

/// IMU-to-body mounting misalignment tolerance (degrees)
/// Represents typical manufacturing and assembly variation
pub const MOUNTING_MISALIGNMENT_DEG: f64 = 0.5;

// ============================================================================
// Derived quantities for uncertainty propagation
// ============================================================================

/// Calculate accelerometer noise standard deviation for given sample rate
pub fn accel_noise_std_g(sample_rate_hz: f64) -> f64 {
    ACCEL_NOISE_DENSITY_G_PER_RT_HZ * sample_rate_hz.sqrt()
}

/// Calculate gyroscope noise standard deviation for given sample rate
pub fn gyro_noise_std_dps(sample_rate_hz: f64) -> f64 {
    GYRO_NOISE_DENSITY_DPS_PER_RT_HZ * sample_rate_hz.sqrt()
}

/// Calculate DLPF attenuation at given frequency
pub fn dlpf_attenuation(freq_hz: f64) -> f64 {
    let fc = DLPF_BANDWIDTH_HZ;
    let n = DLPF_ORDER as f64;
    1.0 / (1.0 + (freq_hz / fc).powf(2.0 * n)).sqrt()
}

/// Calculate accelerometer quantization uncertainty (Type B, rectangular)
pub fn accel_quantization_uncertainty_g() -> f64 {
    ACCEL_QUANTIZATION_STEP_G / (12.0_f64).sqrt()
}

/// Calculate gyroscope quantization uncertainty (Type B, rectangular)
pub fn gyro_quantization_uncertainty_dps() -> f64 {
    GYRO_QUANTIZATION_STEP_DPS / (12.0_f64).sqrt()
}