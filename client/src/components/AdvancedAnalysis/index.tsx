"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnomalyPanel from "./AnomalyPanel";
import CorrelationHeatmap from "./CorrelationHeatmap";
import TrendPanel from "./TrendPanel";
import RecommendationsPanel from "./RecommendationsPanel";
import QualityScoreCard from "./QualityScoreCard";
import HistoricalComparisonPanel from "./HistoricalComparisonPanel";
import HypothesisTestPanel from "./HypothesisTestPanel";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

interface AdvancedAnalysisProps {
  flightId: string;
  onClose?: () => void;
}

type TabType =
  | "anomalies"
  | "correlations"
  | "trend"
  | "recommendations"
  | "score"
  | "historical"
  | "hypothesis";

export default function AdvancedAnalysis({
  flightId,
  onClose,
}: AdvancedAnalysisProps) {
  const [activeTab, setActiveTab] = useState<TabType>("score");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Datos de cada módulo
  const [anomalies, setAnomalies] = useState<any>(null);
  const [correlations, setCorrelations] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [historical, setHistorical] = useState<any>(null);
  const [hypothesis, setHypothesis] = useState<any>(null);

  // Estado para comparación de grupos
  const [groupA, setGroupA] = useState<string>("reposo");
  const [groupB, setGroupB] = useState<string>("hover");
  const [comparisonMetric, setComparisonMetric] = useState<string>("rmse_roll");

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          anomaliesRes,
          correlationsRes,
          trendRes,
          recommendationsRes,
          scoreRes,
          historicalRes,
        ] = await Promise.all([
          fetch(`${API_BASE}/api/flights/${flightId}/anomalies`),
          fetch(`${API_BASE}/api/flights/${flightId}/correlations`),
          fetch(`${API_BASE}/api/flights/${flightId}/trend`),
          fetch(`${API_BASE}/api/flights/${flightId}/recommendations`),
          fetch(`${API_BASE}/api/flights/${flightId}/score`),
          fetch(`${API_BASE}/api/flights/${flightId}/historical-comparison`),
        ]);

        if (anomaliesRes.ok) setAnomalies(await anomaliesRes.json());
        if (correlationsRes.ok) setCorrelations(await correlationsRes.json());
        if (trendRes.ok) setTrend(await trendRes.json());
        if (recommendationsRes.ok)
          setRecommendations(await recommendationsRes.json());
        if (scoreRes.ok) setScore(await scoreRes.json());
        if (historicalRes.ok) setHistorical(await historicalRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [flightId]);

  const fetchHypothesis = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/flights/compare-groups?group_a=${groupA}&group_b=${groupB}&metric=${comparisonMetric}`,
      );
      if (res.ok) {
        setHypothesis(await res.json());
      }
    } catch (err) {
      console.error("Error fetching hypothesis:", err);
    }
  };

  const tabs = [
    { id: "score", label: "🎯 Calidad", icon: "⭐" },
    { id: "anomalies", label: "⚠️ Anomalías", icon: "🔍" },
    { id: "correlations", label: "📊 Correlaciones", icon: "🔗" },
    { id: "trend", label: "📈 Tendencias", icon: "📉" },
    { id: "historical", label: "📚 Histórico", icon: "🏆" },
    { id: "hypothesis", label: "🧪 Test de Hipótesis", icon: "📐" },
    { id: "recommendations", label: "💡 Recomendaciones", icon: "✨" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-gray-400">
          Cargando análisis avanzado...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 text-center">
        <p className="text-red-300">❌ Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gray-900 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">🔬 Análisis Avanzado</h2>
          <p className="text-sm text-gray-400 font-mono mt-1">{flightId}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-gray-700 bg-gray-900/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "score" && (
            <motion.div
              key="score"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <QualityScoreCard data={score} flightId={flightId} />
            </motion.div>
          )}

          {activeTab === "anomalies" && (
            <motion.div
              key="anomalies"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <AnomalyPanel data={anomalies} />
            </motion.div>
          )}

          {activeTab === "correlations" && (
            <motion.div
              key="correlations"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <CorrelationHeatmap data={correlations} />
            </motion.div>
          )}

          {activeTab === "trend" && (
            <motion.div
              key="trend"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <TrendPanel data={trend} />
            </motion.div>
          )}

          {activeTab === "historical" && (
            <motion.div
              key="historical"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <HistoricalComparisonPanel data={historical} />
            </motion.div>
          )}

          {activeTab === "hypothesis" && (
            <motion.div
              key="hypothesis"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <HypothesisTestPanel
                data={hypothesis}
                groupA={groupA}
                groupB={groupB}
                metric={comparisonMetric}
                onGroupAChange={setGroupA}
                onGroupBChange={setGroupB}
                onMetricChange={setComparisonMetric}
                onRunTest={fetchHypothesis}
              />
            </motion.div>
          )}

          {activeTab === "recommendations" && (
            <motion.div
              key="recommendations"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <RecommendationsPanel data={recommendations} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
