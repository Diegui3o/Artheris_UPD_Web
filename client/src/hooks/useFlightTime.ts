import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { AnglesData } from "../types/angles";

type FlightRecord = {
  startedAt: number;
  endedAt: number;
  durationSec: number;
  meanAbsRoll: number;
  meanAbsPitch: number;
};

export const useFlightTime = (sample?: AnglesData & { timestamp?: number }) => {
  // Flight detection thresholds
  const THR_MIN = 1300;
  const THR_MAX = 2000;
  
  // Flight state
  const [isFlying, setIsFlying] = useState(false);
  const [currentFlightSec, setCurrentFlightSec] = useState(0);
  const [totalFlightSec, setTotalFlightSec] = useState(0);
  const [lastFlightSec, setLastFlightSec] = useState(0);
  
  // Deviation tracking
  const [meanAbsRoll, setMeanAbsRoll] = useState(0);
  const [meanAbsPitch, setMeanAbsPitch] = useState(0);
  const [lastMeanAbsRoll, setLastMeanAbsRoll] = useState(0);
  const [lastMeanAbsPitch, setLastMeanAbsPitch] = useState(0);
  
  // Flight history
  const [history, setHistory] = useState<FlightRecord[]>([]);
  
  // Flight accumulators
  const startTimeRef = useRef<number | null>(null);
  const prevTsRef = useRef<number | null>(null);
  const sumAbsRollRef = useRef(0);
  const sumAbsPitchRef = useRef(0);
  const countRef = useRef<number>(0);
  
  // Check if currently flying based on throttle
  const flyingNow = useMemo(() => {
    const throttle = sample?.InputThrottle ?? 0;
    return throttle >= THR_MIN && throttle <= THR_MAX;
  }, [sample]);

  // Reset all flight data
  const resetTotals = useCallback(() => {
    setTotalFlightSec(0);
    setLastFlightSec(0);
    setHistory([]);
    setLastMeanAbsRoll(0);
    setLastMeanAbsPitch(0);
  }, []);

  // Main effect to track flight time and deviations
  useEffect(() => {
    if (!sample) return;
    
    const ts = sample.timestamp ?? Date.now();
    
    // Flight start
    if (!isFlying && flyingNow) {
      setIsFlying(true);
      startTimeRef.current = ts;
      prevTsRef.current = ts;
      sumAbsRollRef.current = 0;
      sumAbsPitchRef.current = 0;
      countRef.current = 0;
      return;
    }
    
    // In flight
    if (isFlying && flyingNow) {
      const prev = prevTsRef.current ?? ts;
      const dtSec = Math.max(0, (ts - prev) / 1000);
      prevTsRef.current = ts;
      
      // Update flight time
      setCurrentFlightSec(s => s + dtSec);
      
      // Track deviations
      const absRoll = Math.abs(sample.KalmanAngleRoll ?? 0);
      const absPitch = Math.abs(sample.KalmanAnglePitch ?? 0);
      sumAbsRollRef.current += absRoll;
      sumAbsPitchRef.current += absPitch;
      countRef.current++;
      
      // Update mean deviations
      const currentCount = countRef.current || 1;
      setMeanAbsRoll(sumAbsRollRef.current / currentCount);
      setMeanAbsPitch(sumAbsPitchRef.current / currentCount);
      return;
    }
    
    // Flight end
    if (isFlying && !flyingNow) {
      const start = startTimeRef.current ?? ts;
      const durationSec = (ts - start) / 1000;
      // Update flight records
      setLastFlightSec(durationSec);
      setTotalFlightSec(t => t + durationSec);
      setLastMeanAbsRoll(meanAbsRoll);
      setLastMeanAbsPitch(meanAbsPitch);
      
      // Add to history
      setHistory(h => [
        ...h,
        {
          startedAt: start,
          endedAt: ts,
          durationSec,
          meanAbsRoll,
          meanAbsPitch,
        },
      ].slice(-100)); // Keep last 100 flights
      
      // Reset for next flight
      setIsFlying(false);
      setCurrentFlightSec(0);
    }
    
    prevTsRef.current = ts;
  }, [sample, isFlying, flyingNow, meanAbsRoll, meanAbsPitch]);

  return {
    // Current flight state
    isFlying,
    currentFlightSec,
    
    // Last flight stats
    lastFlightSec,
    lastMeanAbsRoll,
    lastMeanAbsPitch,
    
    // Totals
    totalFlightSec,
    history,
    
    // Current flight deviations
    meanAbsRoll,
    meanAbsPitch,
    
    // Actions
    resetTotals,
  };
};
