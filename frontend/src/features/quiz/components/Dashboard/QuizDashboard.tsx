import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiBarChart2, FiClock, FiTarget, FiAlertCircle } from 'react-icons/fi';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import apiClient from '@/core/api/apiClient';

interface QuizDashboardProps {
  quizId: string;
  attemptId: string;
  onBack: () => void;
}

export function QuizDashboard({ quizId, attemptId, onBack }: QuizDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await apiClient.get(`/api/v1/rag/quiz/${quizId}/analytics`);
        setAnalytics(res.data);
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [quizId]);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await apiClient.get(`/api/v1/rag/quiz/attempt/${attemptId}/insights`);
        setInsights(res.data.insights);
      } catch (err) {
        console.error("Failed to fetch insights", err);
      } finally {
        setLoadingInsights(false);
      }
    };
    if (attemptId) {
      fetchInsights();
    }
  }, [attemptId]);

  if (loadingAnalytics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4" />
        <p>Loading Deep Analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-20 text-red-400">
        <p>Failed to load analytics.</p>
        <button onClick={onBack} className="mt-4 text-white underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 flex flex-col gap-8 text-white/90">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <FiChevronLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FiBarChart2 className="text-gold" /> Deep Analytics
          </h2>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg">
          <FiTarget className="text-gold mb-2" size={24} />
          <h3 className="text-gray-400 text-sm font-medium">Mastery Score</h3>
          <span className="text-4xl font-black mt-2 text-white">{analytics.mastery_score}</span>
        </div>
        
        <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg">
          <FiClock className="text-blue-400 mb-2" size={24} />
          <h3 className="text-gray-400 text-sm font-medium">Avg Time per Question</h3>
          <span className="text-3xl font-bold mt-2 text-white">{(analytics.avg_time_ms / 1000).toFixed(1)}s</span>
        </div>
        
        <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg">
          <FiAlertCircle className="text-orange-400 mb-2" size={24} />
          <h3 className="text-gray-400 text-sm font-medium">Total Hesitations</h3>
          <span className="text-3xl font-bold mt-2 text-white">{analytics.total_hesitations}</span>
          <p className="text-xs text-gray-500 mt-2">Times you changed your answer</p>
        </div>
      </div>

      {/* Actionable Insights */}
      <div className="bg-gradient-to-br from-[#1A1A1A] to-[#111111] border border-gold/20 p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-gold" />
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          ✨ AI Actionable Insights
        </h3>
        {loadingInsights ? (
          <div className="flex items-center gap-3 text-gray-400 py-4">
            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <p className="text-sm animate-pulse">Analyzing your blind spots...</p>
          </div>
        ) : (
          <p className="text-gray-200 leading-relaxed text-sm whitespace-pre-wrap font-medium">
            {insights}
          </p>
        )}
      </div>

      {/* Recharts - Blind Spot Matrix */}
      <div className="bg-[#1A1A1A] border border-white/5 p-6 rounded-2xl shadow-lg">
        <h3 className="text-lg font-bold mb-2">The Blind Spot Matrix</h3>
        <p className="text-gray-400 text-sm mb-6">
          Compares time spent vs correctness. Fast & Wrong = Blind Spot (Danger). Slow & Wrong = Knowledge Gap.
        </p>
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis 
                dataKey="x" 
                type="number" 
                name="Question" 
                stroke="#ffffff50" 
                tick={{ fill: '#ffffff50', fontSize: 12 }} 
                domain={[0, 'dataMax + 1']}
                tickCount={analytics.blind_spot_matrix?.length + 2 || 5}
              />
              <YAxis 
                dataKey="y" 
                type="number" 
                name="Time (s)" 
                stroke="#ffffff50" 
                tick={{ fill: '#ffffff50', fontSize: 12 }}
                unit="s"
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3', stroke: '#ffffff30' }} 
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#111] border border-white/10 p-3 rounded-lg shadow-xl">
                        <p className="text-white font-bold mb-1">Question {data.x}</p>
                        <p className="text-gray-300 text-sm">Time: {data.y.toFixed(1)}s</p>
                        <p className={`text-sm font-semibold mt-1 ${data.is_correct ? 'text-green-400' : 'text-red-400'}`}>
                          {data.is_correct ? 'Correct' : 'Incorrect'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }} 
              />
              <Scatter 
                name="Questions" 
                data={analytics.blind_spot_matrix?.map((d: any, i: number) => ({
                  x: i + 1,
                  y: d.time_spent_ms / 1000,
                  is_correct: d.is_correct,
                  fill: d.is_correct ? '#4ade80' : '#f87171'
                })) || []}
              >
                {(analytics.blind_spot_matrix || []).map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={_.is_correct ? '#4ade80' : '#f87171'} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
