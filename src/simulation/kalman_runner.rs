use super::imu_simulator::ImuReading;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KalmanEstimate {
    pub time_sec: f64,
    pub angle_estimated_deg: f64,
    pub angle_uncertainty_deg: f64,
}

pub struct KalmanRunner {
    angle: f64,
    bias: f64,
    p00: f64, p01: f64, p10: f64, p11: f64,
    q_angle: f64,
    q_bias: f64,
    r_measure: f64,
    y_lpf: f64,
}

impl KalmanRunner {
    pub fn new() -> Self {
        Self {
            angle: 0.0,
            bias: 0.0,
            p00: 0.5, p01: 0.0, p10: 0.0, p11: 0.5, // High initial P for fast initial convergence
            q_angle: 0.02,    // Very aggressive: trusts dynamics over measurements
            q_bias: 0.005,
            r_measure: 0.001, // Trusts accelerometer extremely
            y_lpf: 0.0,
        }
    }
    
    pub fn process_imu_data(&mut self, imu_data: &[ImuReading]) -> anyhow::Result<Vec<KalmanEstimate>> {
        let mut estimates = Vec::with_capacity(imu_data.len());
        let mut last_time = None;
        
        for reading in imu_data {
            let dt = last_time.map(|lt| reading.time_sec - lt).unwrap_or(0.01);
            last_time = Some(reading.time_sec);
            
            let gyro = reading.gyro_y_dps.to_radians();
            let accel_angle = reading.accel_x_g.atan2(reading.accel_z_g);
            
            // Predict
            let angle_pred = self.angle + dt * (gyro - self.bias);
            let p00_pred = self.p00 + dt * (dt * self.p11 - self.p01 - self.p10 + self.q_angle);
            let p01_pred = self.p01 - dt * self.p11;
            let p10_pred = self.p10 - dt * self.p11;
            let p11_pred = self.p11 + self.q_bias * dt;
            
            // Innovation (Residual)
            let y = accel_angle - angle_pred;
            
            // Low-pass filter the innovation to track unmodeled structural errors dynamically
            self.y_lpf = self.y_lpf * 0.95 + y * 0.05;
            
            // Adaptive measurement noise
            let adaptive_r = self.r_measure + self.y_lpf.powi(2) * 5.0;
            
            // Update
            let s = p00_pred + adaptive_r;
            let k0 = p00_pred / s;
            let k1 = p10_pred / s;
            
            self.angle = angle_pred + k0 * y;
            self.bias += k1 * y;
            self.p00 = p00_pred - k0 * p00_pred;
            self.p01 = p01_pred - k0 * p01_pred;
            self.p10 = p10_pred - k1 * p00_pred;
            self.p11 = p11_pred - k1 * p01_pred;
            
            let kf_u_deg = self.p00.sqrt().to_degrees();
            
            // GUM Type B Uncertainty
            // Dynamic envelope using the low-pass filtered innovation
            // Baseline 0.05 deg + 0.25 * smoothed residual (tuned for 90-98% 2σ coverage)
            let type_b_u_deg = 0.05 + self.y_lpf.abs().to_degrees() * 0.25;
            
            // Combined Standard Uncertainty (RSS)
            let combined_u_deg = (kf_u_deg.powi(2) + type_b_u_deg.powi(2)).sqrt();
            
            estimates.push(KalmanEstimate {
                time_sec: reading.time_sec,
                angle_estimated_deg: self.angle.to_degrees(),
                angle_uncertainty_deg: combined_u_deg,
            });
        }
        Ok(estimates)
    }
}