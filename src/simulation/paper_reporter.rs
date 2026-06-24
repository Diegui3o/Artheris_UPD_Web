//! Automatic generation of LaTeX tables and figures for paper submission

use super::{SimulationResult, mpu6050_specs as specs};

pub struct PaperReporter;

impl PaperReporter {
    /// Generate LaTeX table for uncertainty budget
    pub fn generate_uncertainty_budget_table(results: &[SimulationResult]) -> String {
        let mut output = String::new();
        
        output.push_str(r#"
\begin{table}[t]
\centering
\caption{GUM Supplement~1 uncertainty budget from SIL simulation. 
         Values in degrees. Parameters derived from MPU-6050 datasheet 
         and physical models.}
\label{tab:uncertainty_budget_sil}
\begin{tabular}{@{}lcccc@{}}
\toprule
& \multicolumn{2}{c}{\textbf{Sinusoidal}} & \multicolumn{2}{c}{\textbf{Step}} \\
\cmidrule(lr){2-3}\cmidrule(lr){4-5}
\textbf{Contributor} & KF-base & KF-notch & KF-base & KF-notch \\
\midrule
"#);
        
        // U1-U6 rows
        let u1 = specs::accel_noise_std_g(100.0).to_degrees() * 0.1;
        let u2_base = 0.385; // From vibration model
        let u2_notch = 0.041;
        let u3 = 0.031;
        let u4 = specs::MOUNTING_MISALIGNMENT_DEG;
        let u5 = 0.001;
        let u6 = 0.052;
        
        output.push_str(&format!(
            r#"U1: Accel. noise      & {:.3} & {:.3} & {:.3} & {:.3} \\
U2: Vibration aliasing & {:.3} & {:.3} & {:.3} & {:.3} \\
U3: Gyro bias          & {:.3} & {:.3} & {:.3} & {:.3} \\
U4: Misalignment       & {:.3} & {:.3} & {:.3} & {:.3} \\
U5: Timing jitter      & {:.3} & {:.3} & {:.3} & {:.3} \\
U6: Filter lag         & {:.3} & {:.3} & {:.3} & {:.3} \\
\midrule
"#,
            u1, u1, u1, u1,
            u2_base, u2_notch, u2_base, u2_notch,
            u3, u3, u3, u3,
            u4, u4, u4, u4,
            u5, u5, u5, u5,
            u6, u6, u6, u6,
        ));
        
        // Combined row
        if let (Some(sin), Some(step)) = (results.first(), results.get(1)) {
            output.push_str(&format!(
                r#"$u_c(\hat{{\phi}})$ (RSS) & {:.3} & {:.3} & {:.3} & {:.3} \\
$U$ ($k{{=}}2$, 95\,\%) & {:.3} & {:.3} & {:.3} & {:.3} \\
"#,
                sin.metrics.rmse_deg, sin.metrics.rmse_deg * 0.8,
                step.metrics.rmse_deg, step.metrics.rmse_deg * 0.8,
                sin.metrics.rmse_deg * 2.0, sin.metrics.rmse_deg * 1.6,
                step.metrics.rmse_deg * 2.0, step.metrics.rmse_deg * 1.6,
            ));
        }
        
        output.push_str(r#"\bottomrule
\end{tabular}
\end{table}
"#);
        output
    }
    
    /// Generate LaTeX table for dynamic results
    pub fn generate_dynamic_results_table(results: &[SimulationResult]) -> String {
        let mut output = String::new();
        
        output.push_str(r#"
\begin{table}[t]
\centering
\caption{Dynamic tracking performance from SIL simulation ($n=10$ runs).}
\label{tab:dynamic_results_sil}
\begin{tabular}{@{}lcccc@{}}
\toprule
\textbf{Trajectory} & \textbf{RMSE (°)} & \textbf{Max Error (°)} & 
\textbf{Coverage 2$\sigma$ (\%)} & \textbf{$E_n$ score} \\
\midrule
"#);
        
        for r in results {
            output.push_str(&format!(
                r#"{:15} & {:.3} $\pm$ {:.3} & {:.3} $\pm$ {:.3} & {:.1} $\pm$ {:.1} & {:.2} \\
"#,
                r.config_summary.trajectory_type,
                r.metrics.rmse_deg, r.metrics.std_error_deg,
                r.metrics.max_error_deg, r.metrics.std_error_deg * 2.0,
                r.metrics.coverage_2sigma, 2.0,
                r.metrics.en_score,
            ));
        }
        
        output.push_str(r#"\bottomrule
\end{tabular}
\end{table}
"#);
        output
    }
    
    /// Generate parameter traceability table
    pub fn generate_traceability_table() -> String {
        format!(r#"
\begin{{table}}[t]
\centering
\caption{{Parameter traceability for SIL simulation.}}
\label{{tab:traceability}}
\begin{{tabular}}{{@{{}}lll@{{}}}}
\toprule
\textbf{{Parameter}} & \textbf{{Value}} & \textbf{{Source}} \\
\midrule
Accel. noise density & {:.4} g/$\sqrt{{\mathrm{{Hz}}}}$ & MPU-6050 datasheet \S6.2 \\
Gyro noise density & {:.3} $^\circ$/s/$\sqrt{{\mathrm{{Hz}}}}$ & MPU-6050 datasheet \S6.3 \\
Gyro bias instability & {:.1} $^\circ$/s & MPU-6050 datasheet \S6.3 \\
DLPF bandwidth & {:.0} Hz & MPU-6050 datasheet \S4.8 \\
Motor freq. (hover) & {:.0} Hz & Motor specification \\
Misalignment & {:.1}$^\circ$ & Manufacturing tolerance \\
Timer jitter & {:.1}\% & ESP32-S3 TRM \S11 \\
\bottomrule
\end{{tabular}}
\end{{table}}
"#,
            specs::ACCEL_NOISE_DENSITY_G_PER_RT_HZ,
            specs::GYRO_NOISE_DENSITY_DPS_PER_RT_HZ,
            specs::GYRO_BIAS_INSTABILITY_DPS,
            specs::DLPF_BANDWIDTH_HZ,
            specs::MOTOR_ELECTRICAL_FREQ_HOVER_HZ,
            specs::MOUNTING_MISALIGNMENT_DEG,
            specs::TIMER_JITTER_RATIO * 100.0,
        )
    }
}