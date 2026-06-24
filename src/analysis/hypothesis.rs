use crate::config::hypothesis_types::*;
use crate::config::metrics::FullFlightMetrics;

/// Extrae valores de una métrica específica de los vuelos
fn extract_values(
    flights: &[FullFlightMetrics],
    metric: &ComparisonMetric,
) -> Vec<f64> {
    flights.iter()
        .filter_map(|f| {
            match metric {
                ComparisonMetric::RmseRoll => f.error_metrics.rmse_roll,
                ComparisonMetric::RmsePitch => f.error_metrics.rmse_pitch,
                ComparisonMetric::ImprovementPercent => f.comparison_roll.improvement_percent,
                ComparisonMetric::VarianceRoll => f.error_metrics.variance_roll,
                ComparisonMetric::VariancePitch => f.error_metrics.variance_pitch,
                ComparisonMetric::ItaeRoll => f.error_metrics.itae_roll,
                ComparisonMetric::ItaePitch => f.error_metrics.itae_pitch,
            }
        })
        .collect()
}

/// Calcula media y desviación estándar
fn calculate_stats(values: &[f64]) -> (f64, f64, usize) {
    let n = values.len();
    if n == 0 {
        return (0.0, 0.0, 0);
    }
    let mean = values.iter().sum::<f64>() / n as f64;
    let variance = values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n as f64;
    let std_dev = variance.sqrt();
    (mean, std_dev, n)
}

/// Test t de Student para muestras independientes (Welch's t-test)
pub fn welch_t_test(group_a: &[f64], group_b: &[f64]) -> (f64, f64, usize) {
    let (mean_a, std_a, n_a) = calculate_stats(group_a);
    let (mean_b, std_b, n_b) = calculate_stats(group_b);
    
    if n_a == 0 || n_b == 0 {
        return (0.0, 1.0, 0);
    }
    
    // Estadístico t (Welch)
    let var_a = std_a.powi(2);
    let var_b = std_b.powi(2);
    let t = (mean_a - mean_b) / (var_a / n_a as f64 + var_b / n_b as f64).sqrt();
    
    // Grados de libertad (Welch–Satterthwaite)
    let numerator = (var_a / n_a as f64 + var_b / n_b as f64).powi(2);
    let denominator = (var_a.powi(2) / (n_a as f64).powi(2) / (n_a - 1) as f64)
        + (var_b.powi(2) / (n_b as f64).powi(2) / (n_b - 1) as f64);
    let df = (numerator / denominator).round() as usize;
    
    // Calcular p-value (aproximación usando distribución t)
    let p_value = t_cdf(t.abs(), df);
    
    (t, p_value, df)
}

/// Función de distribución acumulada de Student (aproximación)
fn t_cdf(t: f64, df: usize) -> f64 {
    // Aproximación simple usando la función beta incompleta
    // Para valores pequeños de t, usamos una aproximación polinomial
    if t < 0.0 {
        return 1.0 - t_cdf(-t, df);
    }
    
    // Aproximación para df grande (>30) usar normal
    if df > 30 {
        return normal_cdf(t);
    }
    
    // Aproximación para df pequeño (usando fórmula simplificada)
    let x = t / (df as f64).sqrt();
    let c = 1.0 / (1.0 + x * x);
    let p = 1.0 - 0.5 * c.powi(df as i32);
    p.min(0.9999)
}

/// Función de distribución acumulada normal
fn normal_cdf(z: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.2316419 * z.abs());
    let d = 0.3989423 * (-z.powi(2) / 2.0).exp();
    let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if z > 0.0 { 1.0 - p } else { p }
}

/// Cohen's d - tamaño del efecto
fn cohens_d(group_a: &[f64], group_b: &[f64]) -> f64 {
    let (mean_a, std_a, n_a) = calculate_stats(group_a);
    let (mean_b, std_b, n_b) = calculate_stats(group_b);
    
    if n_a == 0 || n_b == 0 {
        return 0.0;
    }
    
    let pooled_std = ((std_a.powi(2) * (n_a - 1) as f64 + std_b.powi(2) * (n_b - 1) as f64)
        / (n_a + n_b - 2) as f64).sqrt();
    
    (mean_a - mean_b).abs() / pooled_std
}

/// Interpretación del tamaño del efecto
fn interpret_effect_size(d: f64) -> String {
    if d < 0.2 {
        "Despreciable".to_string()
    } else if d < 0.5 {
        "Pequeño".to_string()
    } else if d < 0.8 {
        "Mediano".to_string()
    } else {
        "Grande".to_string()
    }
}

/// Compara dos grupos de vuelos
pub fn compare_groups(
    group_a: &[FullFlightMetrics],
    group_b: &[FullFlightMetrics],
    group_a_name: &str,
    group_b_name: &str,
    params: &ComparisonParams,
) -> HypothesisTest {
    let values_a = extract_values(group_a, &params.metric);
    let values_b = extract_values(group_b, &params.metric);
    
    let (mean_a, std_a, n_a) = calculate_stats(&values_a);
    let (mean_b, std_b, n_b) = calculate_stats(&values_b);
    
    let difference = mean_a - mean_b;
    let improvement_percent = if mean_b > 0.0 {
        ((mean_a - mean_b) / mean_b).abs() * 100.0
    } else {
        0.0
    };
    
    let (t_stat, p_value, df) = welch_t_test(&values_a, &values_b);
    let significant = p_value < params.alpha;
    let effect_size = cohens_d(&values_a, &values_b);
    
    let metric_name = match params.metric {
        ComparisonMetric::RmseRoll => "RMSE Roll",
        ComparisonMetric::RmsePitch => "RMSE Pitch",
        ComparisonMetric::ImprovementPercent => "Mejora Kalman",
        ComparisonMetric::VarianceRoll => "Varianza Roll",
        ComparisonMetric::VariancePitch => "Varianza Pitch",
        ComparisonMetric::ItaeRoll => "ITAE Roll",
        ComparisonMetric::ItaePitch => "ITAE Pitch",
    };
    
    let interpretation = if significant {
        if difference < 0.0 {
            format!("✅ {} es significativamente MEJOR que {} (p = {:.4})", 
                    group_b_name, group_a_name, p_value)
        } else {
            format!("✅ {} es significativamente MEJOR que {} (p = {:.4})", 
                    group_a_name, group_b_name, p_value)
        }
    } else {
        format!("❌ No hay diferencia significativa entre los grupos (p = {:.4})", p_value)
    };
    
    let effect_desc = interpret_effect_size(effect_size);
    let recommendation = if significant {
        if difference < 0.0 {
            format!("Se recomienda usar {} ya que reduce el {} en {:.1}% (efecto {})", 
                    group_b_name, metric_name, improvement_percent, effect_desc)
        } else {
            format!("Se recomienda usar {} ya que reduce el {} en {:.1}% (efecto {})", 
                    group_a_name, metric_name, improvement_percent, effect_desc)
        }
    } else {
        format!("No hay evidencia suficiente para preferir un grupo sobre otro. El tamaño del efecto es {}.",
                effect_desc.to_lowercase())
    };
    
    HypothesisTest {
        test_name: format!("Welch's t-test para {}", metric_name),
        group_a_name: group_a_name.to_string(),
        group_b_name: group_b_name.to_string(),
        group_a_size: n_a,
        group_b_size: n_b,
        group_a_mean: mean_a,
        group_b_mean: mean_b,
        group_a_std: std_a,
        group_b_std: std_b,
        difference,
        improvement_percent,
        t_statistic: t_stat,
        p_value,
        degrees_of_freedom: df,
        significant,
        confidence_level: params.confidence,
        effect_size,
        interpretation,
        recommendation,
    }
}

/// Compara múltiples grupos (análisis de varianza simple)
pub fn compare_multiple_groups(
    groups: Vec<(Vec<FullFlightMetrics>, String)>,
    params: &ComparisonParams,
) -> MultiGroupComparison {
    let mut comparisons = Vec::new();
    let mut group_means = Vec::new();
    
    // Comparar cada par
    for i in 0..groups.len() {
        let (group_a, name_a) = &groups[i];
        for j in i + 1..groups.len() {
            let (group_b, name_b) = &groups[j];
            let test = compare_groups(group_a, group_b, name_a, name_b, params);
            comparisons.push(test);
        }
        let values = extract_values(group_a, &params.metric);
        let (mean, _, _) = calculate_stats(&values);
        group_means.push((name_a.clone(), mean));
    }
    
    // Encontrar el mejor grupo (menor media para métricas de error)
    group_means.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
    let best_group = group_means.first().map(|(n, _)| n.clone()).unwrap_or_default();
    let best_group_mean = group_means.first().map(|(_, m)| *m).unwrap_or(0.0);
    
    let summary = format!(
        "El mejor rendimiento es de '{}' con una media de {:.3}°. {} comparaciones realizadas.",
        best_group, best_group_mean, comparisons.len()
    );
    
    MultiGroupComparison {
        comparisons,
        best_group,
        best_group_mean,
        summary,
    }
}

/// Análisis de tendencia temporal (regresión lineal)
pub fn analyze_temporal_trend(
    flights: &[FullFlightMetrics],
    metric: &ComparisonMetric,
) -> TrendAnalysis {
    let data: Vec<(usize, f64)> = flights.iter()
        .enumerate()
        .filter_map(|(i, f)| {
            match metric {
                ComparisonMetric::RmseRoll => f.error_metrics.rmse_roll.map(|v| (i, v)),
                ComparisonMetric::RmsePitch => f.error_metrics.rmse_pitch.map(|v| (i, v)),
                ComparisonMetric::ImprovementPercent => f.comparison_roll.improvement_percent.map(|v| (i, v)),
                ComparisonMetric::VarianceRoll => f.error_metrics.variance_roll.map(|v| (i, v)),
                ComparisonMetric::VariancePitch => f.error_metrics.variance_pitch.map(|v| (i, v)),
                ComparisonMetric::ItaeRoll => f.error_metrics.itae_roll.map(|v| (i, v)),
                ComparisonMetric::ItaePitch => f.error_metrics.itae_pitch.map(|v| (i, v)),
            }
        })
        .collect();
    
    if data.len() < 3 {
        return TrendAnalysis {
            slope: 0.0,
            r_squared: 0.0,
            p_value: 1.0,
            significant_trend: false,
            interpretation: "Datos insuficientes para análisis de tendencia".to_string(),
            forecast_next: None,
        };
    }
    
    // Regresión lineal simple
    let n = data.len() as f64;
    let sum_x = data.iter().map(|(x, _)| *x as f64).sum::<f64>();
    let sum_y = data.iter().map(|(_, y)| *y).sum::<f64>();
    let sum_xy = data.iter().map(|(x, y)| *x as f64 * y).sum::<f64>();
    let sum_x2 = data.iter().map(|(x, _)| (*x as f64).powi(2)).sum::<f64>();
    
    let denominator = n * sum_x2 - sum_x.powi(2);
    if denominator == 0.0 {
        return TrendAnalysis {
            slope: 0.0,
            r_squared: 0.0,
            p_value: 1.0,
            significant_trend: false,
            interpretation: "No se puede calcular tendencia".to_string(),
            forecast_next: None,
        };
    }
    
    let slope = (n * sum_xy - sum_x * sum_y) / denominator;
    let intercept = (sum_y - slope * sum_x) / n;
    
    // Calcular R²
    let ss_tot = data.iter().map(|(_, y)| (y - sum_y / n).powi(2)).sum::<f64>();
    let ss_res = data.iter().map(|(x, y)| (y - (intercept + slope * *x as f64)).powi(2)).sum::<f64>();
    let r_squared = 1.0 - (ss_res / ss_tot);
    
    // Test de significancia de la pendiente
    let se = (ss_res / (n - 2.0)).sqrt();
    let se_slope = se / (sum_x2 - sum_x.powi(2) / n).sqrt();
    let t_stat = slope / se_slope;
    let p_value = 2.0 * (1.0 - t_cdf(t_stat.abs(), (n - 2.0) as usize));
    let significant_trend = p_value < 0.05;
    
    // Predicción para el siguiente punto
    let next_x = data.len() as f64;
    let forecast_next = Some(intercept + slope * next_x);
    
    let interpretation = if significant_trend {
        if slope < 0.0 {
            format!("Tendencia de mejora significativa: la métrica disminuye {:.3} por vuelo (R² = {:.3})", 
                    slope.abs(), r_squared)
        } else {
            format!("Tendencia de degradación significativa: la métrica aumenta {:.3} por vuelo (R² = {:.3})", 
                    slope, r_squared)
        }
    } else {
        "No hay tendencia significativa en los datos".to_string()
    };
    
    TrendAnalysis {
        slope,
        r_squared,
        p_value,
        significant_trend,
        interpretation,
        forecast_next,
    }
}