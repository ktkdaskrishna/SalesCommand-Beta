import React, { useState, useEffect } from "react";
import { aiAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const AIInsights = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiAPI.getInsights();
      setInsights(response.data);
    } catch (err) {
      setError("Failed to generate insights. Please try again.");
      console.error("AI insights error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in space-y-6" data-testid="insights-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-blue-600" />
            AI Insights
          </h1>
          <p className="text-slate-600 mt-1">
            AI-powered analysis of your sales performance
          </p>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
          data-testid="refresh-insights-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Insights
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Analyzing your sales data...
          </h3>
          <p className="text-slate-500">
            Our AI is reviewing your pipeline, activities, and performance metrics.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="card p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">{error}</h3>
              <button
                onClick={fetchInsights}
                className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insights Content */}
      {insights && !loading && (
        <div className="space-y-6">
          {/* Main Insights */}
          <div className="card p-6" data-testid="insights-card">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-900">Key Insights</h2>
            </div>
            <div className="space-y-4">
              {insights.insights?.map((insight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                  </div>
                  <p className="text-slate-700">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {insights.recommendations?.length > 0 && (
            <div className="card p-6" data-testid="recommendations-card">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-900">Recommendations</h2>
              </div>
              <div className="grid gap-3">
                {insights.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-slate-700 text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {insights.generated_at && (
            <p className="text-sm text-slate-500 text-center">
              Generated at {new Date(insights.generated_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Powered by GPT AI
            </p>
            <p className="text-sm text-blue-700 mt-1">
              These insights are generated using your real-time sales data.
              Refresh to get updated recommendations based on current pipeline status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
