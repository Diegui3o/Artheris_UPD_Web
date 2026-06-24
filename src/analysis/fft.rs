use rustfft::FftPlanner;
use num_complex::Complex;
use crate::config::spectrum_types::*;

/// Calcula FFT con ventaneo para mejor precisión
pub fn compute_fft_advanced(
    signal: &[f64], 
    sample_rate_hz: f64,
    window_type: WindowType,
) -> (Vec<f64>, Vec<f64>) {
    let n = signal.len();
    let n_fft = (n * 2).next_power_of_two();
    
    // Aplicar ventana
    let mut buffer: Vec<Complex<f64>> = (0..n_fft)
        .map(|i| {
            let val = if i < n {
                signal[i] * window_function(i, n, &window_type)
            } else {
                0.0
            };
            Complex::new(val, 0.0)
        })
        .collect();
    
    // FFT
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(n_fft);
    fft.process(&mut buffer);
    
    // Calcular magnitudes (solo hasta Nyquist)
    let nyquist = sample_rate_hz / 2.0;
    let freq_step = sample_rate_hz / n_fft as f64;
    let mut frequencies = Vec::new();
    let mut magnitudes = Vec::new();
    
    // Ignorar DC (i=0) y frecuencias muy bajas
    for i in 1..(n_fft / 2) {
        let freq = i as f64 * freq_step;
        if freq <= nyquist && freq > 0.1 {
            frequencies.push(freq);
            let mag = buffer[i].norm() / n_fft as f64;
            magnitudes.push(mag);
        }
    }
    
    (frequencies, magnitudes)
}

/// Tipos de ventana para FFT
pub enum WindowType {
    Hann,
    Hamming,
    Blackman,
    Rectangular,
}

fn window_function(i: usize, n: usize, window_type: &WindowType) -> f64 {
    let x = i as f64 / (n - 1) as f64;
    match window_type {
        WindowType::Hann => 0.5 * (1.0 - (2.0 * std::f64::consts::PI * x).cos()),
        WindowType::Hamming => 0.54 - 0.46 * (2.0 * std::f64::consts::PI * x).cos(),
        WindowType::Blackman => {
            0.42 - 0.5 * (2.0 * std::f64::consts::PI * x).cos() 
            + 0.08 * (4.0 * std::f64::consts::PI * x).cos()
        },
        WindowType::Rectangular => 1.0,
    }
}

/// Encuentra picos con análisis de armónicos - CORREGIDO
pub fn find_peaks_advanced(
    frequencies: &[f64], 
    magnitudes: &[f64], 
    top_n: usize,
) -> Vec<Peak> {
    if frequencies.len() < 3 {
        return Vec::new();
    }
    
    let mut peaks = Vec::new();
    
    // Encontrar picos locales
    for i in 1..frequencies.len() - 1 {
        if magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1] {
            // Ignorar frecuencias muy bajas
            if frequencies[i] < 0.2 {
                continue;
            }
            
            let (freq, mag) = refine_peak(
                frequencies[i-1], frequencies[i], frequencies[i+1],
                magnitudes[i-1], magnitudes[i], magnitudes[i+1]
            );
            
            peaks.push(Peak {
                frequency_hz: freq,
                magnitude: mag,
                label: None,
            });
        }
    }
    
    // Ordenar por magnitud
    peaks.sort_by(|a, b| b.magnitude.partial_cmp(&a.magnitude).unwrap());

    let fundamental_freq = peaks.first().map(|p| p.frequency_hz);
    
    if let Some(fundamental_freq) = fundamental_freq {
        if fundamental_freq > 0.2 {
            for peak in peaks.iter_mut() {
                let harmonic_order = (peak.frequency_hz / fundamental_freq).round() as u32;
                let error = (peak.frequency_hz - (harmonic_order as f64 * fundamental_freq)).abs();
                
                if error < 0.5 && harmonic_order <= 5 && harmonic_order >= 1 {
                    peak.label = Some(match harmonic_order {
                        1 => "1° armónico".to_string(),
                        2 => "2° armónico".to_string(),
                        3 => "3° armónico".to_string(),
                        4 => "4° armónico".to_string(),
                        5 => "5° armónico".to_string(),
                        _ => format!("{}° armónico", harmonic_order),
                    });
                }
            }
        }
    }
    
    peaks.into_iter().take(top_n).collect()
}

/// Refinamiento de pico con interpolación parabólica
fn refine_peak(f1: f64, f2: f64, _f3: f64, m1: f64, m2: f64, m3: f64) -> (f64, f64) {
    let denom = 2.0 * (2.0 * m2 - m1 - m3);
    if denom.abs() < 1e-10 {
        return (f2, m2);
    }
    
    let delta = (m3 - m1) / denom;
    let refined_freq = f2 + delta * (f2 - f1);
    let refined_mag = m2 - 0.25 * (m1 - m3) * delta;
    
    (refined_freq, refined_mag)
}

/// Calcula THD (Total Harmonic Distortion) - IMPLEMENTACIÓN REAL
fn calculate_thd(spectrum: &Spectrum) -> HarmonicDistortion {
    if spectrum.dominant_peaks.is_empty() {
        return HarmonicDistortion::default();
    }
    
    let fundamental = &spectrum.dominant_peaks[0];
    let mut harmonics = Vec::new();
    let mut harmonic_power = 0.0;
    
    for peak in spectrum.dominant_peaks.iter().skip(1) {
        let order = (peak.frequency_hz / fundamental.frequency_hz).round() as u32;
        let error = (peak.frequency_hz - (order as f64 * fundamental.frequency_hz)).abs();
        
        if error < 0.5 && order <= 10 {
            let ratio = peak.magnitude / fundamental.magnitude;
            harmonic_power += peak.magnitude * peak.magnitude;
            
            harmonics.push(Harmonic {
                order,
                frequency_hz: peak.frequency_hz,
                magnitude: peak.magnitude,
                ratio_to_fundamental: ratio,
            });
        }
    }
    
    let fundamental_power = fundamental.magnitude * fundamental.magnitude;
    let thd = if fundamental_power > 0.0 {
        (harmonic_power / fundamental_power).sqrt()
    } else {
        0.0
    };
    
    HarmonicDistortion {
        total_harmonic_distortion: thd,
        dominant_harmonic: harmonics.first().map(|h| h.frequency_hz),
        harmonics,
    }
}

/// Calcula centroides espectrales
fn calculate_spectral_centroids(
    roll: &Spectrum, 
    pitch: &Spectrum, 
    motors: &Spectrum
) -> SpectralCentroids {
    let calc_centroid = |spectrum: &Spectrum| -> f64 {
        let total_mag: f64 = spectrum.magnitudes.iter().sum();
        if total_mag == 0.0 {
            return 0.0;
        }
        
        let weighted_sum: f64 = spectrum.frequencies_hz.iter()
            .zip(spectrum.magnitudes.iter())
            .map(|(f, m)| f * m)
            .sum();
        
        weighted_sum / total_mag
    };
    
    let calc_flatness = |spectrum: &Spectrum| -> f64 {
        if spectrum.magnitudes.is_empty() {
            return 0.0;
        }
        
        let geometric_mean = spectrum.magnitudes.iter()
            .map(|m| m.ln())
            .sum::<f64>() / spectrum.magnitudes.len() as f64;
        
        let arithmetic_mean = spectrum.magnitudes.iter().sum::<f64>() / spectrum.magnitudes.len() as f64;
        
        if arithmetic_mean == 0.0 {
            return 0.0;
        }
        
        (geometric_mean.exp() / arithmetic_mean).min(1.0)
    };
    
    SpectralCentroids {
        roll_centroid_hz: calc_centroid(roll),
        pitch_centroid_hz: calc_centroid(pitch),
        motors_centroid_hz: calc_centroid(motors),
        spectral_flatness: calc_flatness(roll),
    }
}

// Encontrar correlaciones entre espectros - CORREGIDO (sin HashSet)
fn find_correlations(
    roll: &Spectrum,
    pitch: &Spectrum,
    motors: &Spectrum,
) -> Vec<Correlation> {
    let mut correlations = Vec::new();
    let mut seen_frequencies = Vec::new();
    
    // Correlaciones Roll-Motors
    for peak in &roll.dominant_peaks {
        if peak.frequency_hz < 0.2 {
            continue;
        }
        
        if let Some(_motor_peak) = motors.dominant_peaks.iter()
            .find(|m| (m.frequency_hz - peak.frequency_hz).abs() < 0.5) 
        {
            let freq_key = (peak.frequency_hz * 10.0).round() / 10.0;
            if !seen_frequencies.contains(&freq_key) {
                seen_frequencies.push(freq_key);
                correlations.push(Correlation {
                    frequency_hz: peak.frequency_hz,
                    sources: vec!["roll".to_string(), "motors".to_string()],
                    confidence: 0.85,
                    description: format!("Vibración en {:.1} Hz acoplada entre Roll y motores", peak.frequency_hz),
                    recommendation: Some("Verificar balance de hélices".to_string()),
                });
            }
        }
    }
    
    // Correlaciones Pitch-Motors
    for peak in &pitch.dominant_peaks {
        if peak.frequency_hz < 0.2 {
            continue;
        }
        
        if let Some(_motor_peak) = motors.dominant_peaks.iter()
            .find(|m| (m.frequency_hz - peak.frequency_hz).abs() < 0.5)
        {
            let freq_key = (peak.frequency_hz * 10.0).round() / 10.0;
            if !seen_frequencies.contains(&freq_key) {
                seen_frequencies.push(freq_key);
                correlations.push(Correlation {
                    frequency_hz: peak.frequency_hz,
                    sources: vec!["pitch".to_string(), "motors".to_string()],
                    confidence: 0.85,
                    description: format!("Vibración en {:.1} Hz acoplada entre Pitch y motores", peak.frequency_hz),
                    recommendation: Some("Verificar balance de hélices".to_string()),
                });
            }
        }
    }
    
    correlations
}

/// Genera recomendaciones basadas en el espectro - CORREGIDO
fn generate_spectrum_recommendations(
    roll: &Spectrum,
    pitch: &Spectrum,
    thd: &HarmonicDistortion,
) -> Vec<String> {
    let mut recommendations = Vec::new();
    
    if let Some(peak) = roll.dominant_peaks.first() {
        if peak.frequency_hz > 0.2 && peak.frequency_hz < 5.0 {
            recommendations.push(format!("⚠️ Baja frecuencia en Roll ({:.1} Hz) - Posible problema de tuning PID", peak.frequency_hz));
        } else if peak.frequency_hz > 20.0 {
            recommendations.push(format!("⚠️ Alta frecuencia en Roll ({:.1} Hz) - Posible vibración mecánica", peak.frequency_hz));
        }
    }
    
    if let Some(peak) = pitch.dominant_peaks.first() {
        if peak.frequency_hz > 0.2 && peak.frequency_hz < 5.0 {
            recommendations.push(format!("⚠️ Baja frecuencia en Pitch ({:.1} Hz) - Posible problema de tuning PID", peak.frequency_hz));
        } else if peak.frequency_hz > 20.0 {
            recommendations.push(format!("⚠️ Alta frecuencia en Pitch ({:.1} Hz) - Posible vibración mecánica", peak.frequency_hz));
        }
    }
    
    if thd.total_harmonic_distortion > 0.1 {
        recommendations.push(format!("📊 Distorsión armónica alta ({:.1}%) - Revisar respuesta del sistema", thd.total_harmonic_distortion * 100.0));
    }
    
    recommendations
}

/// Calcula el espectro completo para un vuelo
pub fn compute_full_flight_spectrum(
    flight_id: &str,
    roll_error: &[f64],
    pitch_error: &[f64],
    motors: &[Vec<f64>],
    acc_x: &[f64],
    acc_y: &[f64],
    acc_z: &[f64],
    sample_rate_hz: f64,
    duration_sec: f64,
) -> FlightSpectrum {
    
    // Verificar que hay datos suficientes
    if roll_error.is_empty() && pitch_error.is_empty() {
        return FlightSpectrum::default();
    }
    
    // Espectro de error combinado
    let combined_error: Vec<f64> = if !roll_error.is_empty() && !pitch_error.is_empty() {
        let min_len = roll_error.len().min(pitch_error.len());
        (0..min_len).map(|i| (roll_error[i] + pitch_error[i]) / 2.0).collect()
    } else if !roll_error.is_empty() {
        roll_error.to_vec()
    } else {
        pitch_error.to_vec()
    };
    
    let (freqs_combined, mags_combined) = compute_fft_advanced(&combined_error, sample_rate_hz, WindowType::Hann);
    let peaks_combined = find_peaks_advanced(&freqs_combined, &mags_combined, 5);
    let combined_spectrum = Spectrum {
        frequencies_hz: freqs_combined,
        magnitudes: mags_combined,
        dominant_peaks: peaks_combined,
    };
    
    // Espectro de Roll
    let (freqs_roll, mags_roll) = compute_fft_advanced(roll_error, sample_rate_hz, WindowType::Hann);
    let peaks_roll = find_peaks_advanced(&freqs_roll, &mags_roll, 5);
    let roll_spectrum = Spectrum {
        frequencies_hz: freqs_roll,
        magnitudes: mags_roll,
        dominant_peaks: peaks_roll,
    };
    
    // Espectro de Pitch
    let (freqs_pitch, mags_pitch) = compute_fft_advanced(pitch_error, sample_rate_hz, WindowType::Hann);
    let peaks_pitch = find_peaks_advanced(&freqs_pitch, &mags_pitch, 5);
    let pitch_spectrum = Spectrum {
        frequencies_hz: freqs_pitch,
        magnitudes: mags_pitch,
        dominant_peaks: peaks_pitch,
    };
    
    // Espectro de motores (promedio)
    let motor_avg: Vec<f64> = if !motors.is_empty() && !motors[0].is_empty() {
        let min_len = motors.iter().map(|m| m.len()).min().unwrap_or(0);
        (0..min_len)
            .map(|i| motors.iter().map(|m| m[i]).sum::<f64>() / motors.len() as f64)
            .collect()
    } else {
        vec![]
    };
    
    let (freqs_motor, mags_motor) = compute_fft_advanced(&motor_avg, sample_rate_hz, WindowType::Hann);
    let peaks_motor = find_peaks_advanced(&freqs_motor, &mags_motor, 5);
    let motors_spectrum = Spectrum {
        frequencies_hz: freqs_motor,
        magnitudes: mags_motor,
        dominant_peaks: peaks_motor,
    };
    
    // Espectros de acelerómetros
    let (freqs_acc_x, mags_acc_x) = compute_fft_advanced(acc_x, sample_rate_hz, WindowType::Hann);
    let peaks_acc_x = find_peaks_advanced(&freqs_acc_x, &mags_acc_x, 3);
    let acc_x_spectrum = Spectrum {
        frequencies_hz: freqs_acc_x,
        magnitudes: mags_acc_x,
        dominant_peaks: peaks_acc_x,
    };
    
    let (freqs_acc_y, mags_acc_y) = compute_fft_advanced(acc_y, sample_rate_hz, WindowType::Hann);
    let peaks_acc_y = find_peaks_advanced(&freqs_acc_y, &mags_acc_y, 3);
    let acc_y_spectrum = Spectrum {
        frequencies_hz: freqs_acc_y,
        magnitudes: mags_acc_y,
        dominant_peaks: peaks_acc_y,
    };
    
    let (freqs_acc_z, mags_acc_z) = compute_fft_advanced(acc_z, sample_rate_hz, WindowType::Hann);
    let peaks_acc_z = find_peaks_advanced(&freqs_acc_z, &mags_acc_z, 3);
    let acc_z_spectrum = Spectrum {
        frequencies_hz: freqs_acc_z,
        magnitudes: mags_acc_z,
        dominant_peaks: peaks_acc_z,
    };
    
    // Magnitud total del acelerómetro
    let acc_magnitude: Vec<f64> = acc_x.iter()
        .zip(acc_y.iter())
        .zip(acc_z.iter())
        .map(|((x, y), z)| (x*x + y*y + z*z).sqrt())
        .collect();
    
    let (freqs_acc_mag, mags_acc_mag) = compute_fft_advanced(&acc_magnitude, sample_rate_hz, WindowType::Hann);
    let peaks_acc_mag = find_peaks_advanced(&freqs_acc_mag, &mags_acc_mag, 3);
    let acc_mag_spectrum = Spectrum {
        frequencies_hz: freqs_acc_mag,
        magnitudes: mags_acc_mag,
        dominant_peaks: peaks_acc_mag,
    };
    
    // Cálculos avanzados
    let thd = calculate_thd(&roll_spectrum);
    let centroids = calculate_spectral_centroids(&roll_spectrum, &pitch_spectrum, &motors_spectrum);
    let correlations = find_correlations(&roll_spectrum, &pitch_spectrum, &motors_spectrum);
    let recommendations = generate_spectrum_recommendations(&roll_spectrum, &pitch_spectrum, &thd);
    
    FlightSpectrum {
        flight_id: flight_id.to_string(),
        sample_rate_hz,
        sample_count: roll_error.len(),
        duration_sec,
        error_spectrum: combined_spectrum.clone(),
        roll_error: roll_spectrum,
        pitch_error: pitch_spectrum,
        combined_error: combined_spectrum,
        motors_spectrum: motors_spectrum.clone(),
        motors: motors_spectrum,
        motor_individual: vec![],
        acc_x_spectrum: acc_x_spectrum.clone(),
        acc_y_spectrum: acc_y_spectrum.clone(),
        acc_z_spectrum: acc_z_spectrum.clone(),
        accelerometer_x: acc_x_spectrum,
        accelerometer_y: acc_y_spectrum,
        accelerometer_z: acc_z_spectrum,
        accelerometer_magnitude: acc_mag_spectrum,
        gyroscope_roll: None,
        gyroscope_pitch: None,
        gyroscope_yaw: None,
        harmonic_distortion: thd,
        spectral_centroids: centroids,
        correlations,
        recommendations,
    }
}