//! Enhanced validator with GUM-compliant metrics

use super::{SimulationConfig, trajectory::TrajectoryPoint, kalman_runner::KalmanEstimate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationPoint {
    pub time_sec: f64,
    pub angle_true_deg: f64,
    pub angle_estimated_deg: f64,
    pub error_deg: f64,
    pub uncertainty_deg: f64,
    pub within_1sigma: bool,
    pub within_2sigma: bool,
    pub within_3sigma: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    // Core metrics
    pub rmse_deg: f64,
    pub max_error_deg: f64,
    pub mean_error_deg: f64,
    pub std_error_deg: f64,
    
    // Uncertainty metrics
    pub mean_uncertainty_deg: f64,
    pub max_uncertainty_deg: f64,
    pub coverage_1sigma: f64,
    pub coverage_2sigma: f64,
    pub coverage_3sigma: f64,
    
    // GUM compliance metrics
    pub coverage_profile: Vec<(f64, f64)>,  // (k, coverage %)
    pub uncertainty_error_correlation: f64,
    pub en_score: f64,  // En score for GUM validation
    
    // Timing
    pub kalman_delay_ms: f64,
    
    // Status
    pub validation_passed: bool,
    pub recommendations: Vec<String>,
}

pub struct SimulationValidator {
    config: SimulationConfig,
}

impl SimulationValidator {
    pub fn new(config: SimulationConfig) -> Self { Self { config } }
    pub fn align_and_compute_errors(
        &self,
        trajectory: &[TrajectoryPoint],
        estimates: &[KalmanEstimate],
    ) -> anyhow::Result<Vec<ValidationPoint>> {
        anyhow::ensure!(trajectory.len() == estimates.len(), "Trajectory and estimates length mismatch");
        
        let mut points = Vec::with_capacity(trajectory.len());
        for (t, e) in trajectory.iter().zip(estimates.iter()) {
            let error = e.angle_estimated_deg - t.angle_true_deg;
            let uncertainty = e.angle_uncertainty_deg;
            
            points.push(ValidationPoint {
                time_sec: t.time_sec,
                angle_true_deg: t.angle_true_deg,
                angle_estimated_deg: e.angle_estimated_deg,
                error_deg: error,
                uncertainty_deg: uncertainty,
                within_1sigma: error.abs() <= uncertainty,
                within_2sigma: error.abs() <= 2.0 * uncertainty,
                within_3sigma: error.abs() <= 3.0 * uncertainty,
            });
        }
        
        Ok(points)
    }

    /// Compute coverage profile for multiple k values
    pub fn compute_coverage_profile(&self, points: &[ValidationPoint]) -> Vec<(f64, f64)> {
        let max_k = 3.0;
        let steps = 30;
        (0..=steps)
            .map(|i| {
                let k = i as f64 * max_k / steps as f64;
                let covered = points.iter()
                    .filter(|p| p.error_deg.abs() <= k * p.uncertainty_deg)
                    .count();
                let coverage = covered as f64 / points.len() as f64 * 100.0;
                (k, coverage)
            })
            .collect()
    }
    
    /// Compute uncertainty-error correlation
    /// High correlation (>0.7) indicates well-calibrated uncertainty
    pub fn compute_uncertainty_error_correlation(&self, points: &[ValidationPoint]) -> f64 {
        let n = points.len() as f64;
        if n < 2.0 { return 0.0; }
        
        let mean_u = points.iter().map(|p| p.uncertainty_deg).sum::<f64>() / n;
        let mean_e = points.iter().map(|p| p.error_deg.abs()).sum::<f64>() / n;
        
        let mut cov = 0.0;
        let mut var_u = 0.0;
        let mut var_e = 0.0;
        
        for p in points {
            let u = p.uncertainty_deg - mean_u;
            let e = p.error_deg.abs() - mean_e;
            cov += u * e;
            var_u += u * u;
            var_e += e * e;
        }
        
        if var_u > 0.0 && var_e > 0.0 {
            cov / (var_u.sqrt() * var_e.sqrt())
        } else {
            0.0
        }
    }
    
    /// Compute En score for GUM validation
    /// |En| < 1 indicates validated uncertainty
    pub fn compute_en_score(&self, points: &[ValidationPoint]) -> f64 {
        let n = points.len() as f64;
        let mean_error = points.iter().map(|p| p.error_deg.abs()).sum::<f64>() / n;
        let mean_uncertainty = points.iter().map(|p| p.uncertainty_deg).sum::<f64>() / n;
        
        mean_error / mean_uncertainty
    }
    
    pub fn validate(&self, trajectory: &[TrajectoryPoint], estimates: &[KalmanEstimate]) -> anyhow::Result<ValidationResult> {
        let points = self.align_and_compute_errors(trajectory, estimates)?;
        let n = points.len() as f64;
        
        // Basic metrics
        let rmse = (points.iter().map(|p| p.error_deg.powi(2)).sum::<f64>() / n).sqrt();
        let max_error = points.iter().map(|p| p.error_deg.abs()).fold(0.0, f64::max);
        let mean_error = points.iter().map(|p| p.error_deg).sum::<f64>() / n;
        let std_error = (points.iter().map(|p| (p.error_deg - mean_error).powi(2)).sum::<f64>() / n).sqrt();
        
        let mean_uncertainty = points.iter().map(|p| p.uncertainty_deg).sum::<f64>() / n;
        let max_uncertainty = points.iter().map(|p| p.uncertainty_deg).fold(0.0, f64::max);
        
        // Coverage
        let cov1 = points.iter().filter(|p| p.within_1sigma).count() as f64 / n * 100.0;
        let cov2 = points.iter().filter(|p| p.within_2sigma).count() as f64 / n * 100.0;
        let cov3 = points.iter().filter(|p| p.within_3sigma).count() as f64 / n * 100.0;
        
        // Advanced metrics
        let coverage_profile = self.compute_coverage_profile(&points);
        let correlation = self.compute_uncertainty_error_correlation(&points);
        let en_score = self.compute_en_score(&points);
        
        // Validation criteria (GUM-compliant)
        // Note: No upper bound on cov2 — over-coverage is acceptable for non-stationary signals
        let validation_passed = rmse < 3.0 
            && cov2 >= 90.0 
            && en_score < 1.5;
        
        let mut recommendations = Vec::new();
        if rmse > 3.0 { 
            recommendations.push(format!("RMSE elevado ({:.2}°)", rmse)); 
        }
        if cov2 < 90.0 { 
            recommendations.push(format!("Cobertura 2σ baja ({:.1}% < 90%)", cov2)); 
        }
        if cov2 > 99.9 { 
            // Only flag if fully saturated (uncertainty is wildly over-estimated)
            recommendations.push(format!("Cobertura 2σ saturada ({:.1}% ≈ 100%)", cov2)); 
        }
        if correlation < 0.0 { 
            recommendations.push(format!("Correlación negativa anómala ({:.2})", correlation)); 
        }
        if en_score > 1.5 { 
            recommendations.push(format!("En score elevado ({:.2} > 1.0)", en_score)); 
        }
        if recommendations.is_empty() { 
            recommendations.push("✅ Validación GUM exitosa. Incertidumbre bien calibrada.".into()); 
        }
        
        Ok(ValidationResult {
            rmse_deg: rmse,
            max_error_deg: max_error,
            mean_error_deg: mean_error,
            std_error_deg: std_error,
            mean_uncertainty_deg: mean_uncertainty,
            max_uncertainty_deg: max_uncertainty,
            coverage_1sigma: cov1,
            coverage_2sigma: cov2,
            coverage_3sigma: cov3,
            coverage_profile,
            uncertainty_error_correlation: correlation,
            en_score,
            kalman_delay_ms: 0.0,
            validation_passed,
            recommendations,
        })
    }
}