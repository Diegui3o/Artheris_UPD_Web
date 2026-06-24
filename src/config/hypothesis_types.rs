use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct HypothesisTest {
    pub test_name: String,
    pub group_a_name: String,
    pub group_b_name: String,
    pub group_a_size: usize,
    pub group_b_size: usize,
    pub group_a_mean: f64,
    pub group_b_mean: f64,
    pub group_a_std: f64,
    pub group_b_std: f64,
    pub difference: f64,
    pub improvement_percent: f64,
    pub t_statistic: f64,
    pub p_value: f64,
    pub degrees_of_freedom: usize,
    pub significant: bool,
    pub confidence_level: f64,
    pub effect_size: f64,
    pub interpretation: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MultiGroupComparison {
    pub comparisons: Vec<HypothesisTest>,
    pub best_group: String,
    pub best_group_mean: f64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrendAnalysis {
    pub slope: f64,
    pub r_squared: f64,
    pub p_value: f64,
    pub significant_trend: bool,
    pub interpretation: String,
    pub forecast_next: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct ComparisonParams {
    pub metric: ComparisonMetric,
    pub alpha: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ComparisonMetric {
    RmseRoll,
    RmsePitch,
    ImprovementPercent,
    VarianceRoll,
    VariancePitch,
    ItaeRoll,
    ItaePitch,
}

impl Default for ComparisonParams {
    fn default() -> Self {
        Self {
            metric: ComparisonMetric::RmseRoll,
            alpha: 0.05,
            confidence: 0.95,
        }
    }
}