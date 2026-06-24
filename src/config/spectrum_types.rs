use serde::{Serialize, Deserialize};

/// Espectro de una señal
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Spectrum {
    pub frequencies_hz: Vec<f64>,
    pub magnitudes: Vec<f64>,
    pub dominant_peaks: Vec<Peak>,
}

/// Pico de frecuencia dominante
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Peak {
    pub frequency_hz: f64,
    pub magnitude: f64,
    pub label: Option<String>,
}

/// Espectro completo de un vuelo
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FlightSpectrum {
    pub flight_id: String,
    pub sample_rate_hz: f64,
    pub sample_count: usize,
    pub duration_sec: f64,
    
    /// Espectro del error (phi_ref - KalmanAngleRoll)
    pub error_spectrum: Spectrum,
    pub roll_error: Spectrum,
    pub pitch_error: Spectrum,
    pub combined_error: Spectrum,
    
    /// Espectro promedio de los motores
    pub motors_spectrum: Spectrum,
    pub motors: Spectrum,
    pub motor_individual: Vec<Spectrum>,
    
    /// Espectro del acelerómetro
    pub acc_x_spectrum: Spectrum,
    pub acc_y_spectrum: Spectrum,
    pub acc_z_spectrum: Spectrum,
    pub accelerometer_x: Spectrum,
    pub accelerometer_y: Spectrum,
    pub accelerometer_z: Spectrum,
    pub accelerometer_magnitude: Spectrum,
    
    pub gyroscope_roll: Option<Spectrum>,
    pub gyroscope_pitch: Option<Spectrum>,
    pub gyroscope_yaw: Option<Spectrum>,
    
    pub harmonic_distortion: HarmonicDistortion,
    pub spectral_centroids: SpectralCentroids,
    
    /// Correlaciones encontradas entre frecuencias
    pub correlations: Vec<Correlation>,
    pub recommendations: Vec<String>,
}

/// Correlación entre frecuencias de diferentes señales
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Correlation {
    pub frequency_hz: f64,
    pub sources: Vec<String>,
    pub description: String,
    pub confidence: f64,
    pub recommendation: Option<String>,
}

/// Distorsión armónica (THD)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HarmonicDistortion {
    pub total_harmonic_distortion: f64,
    pub dominant_harmonic: Option<f64>,
    pub harmonics: Vec<Harmonic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Harmonic {
    pub order: u32,
    pub frequency_hz: f64,
    pub magnitude: f64,
    pub ratio_to_fundamental: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SpectralCentroids {
    pub roll_centroid_hz: f64,
    pub pitch_centroid_hz: f64,
    pub motors_centroid_hz: f64,
    pub spectral_flatness: f64,
}