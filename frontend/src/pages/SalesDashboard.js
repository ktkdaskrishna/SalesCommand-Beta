/**
 * Sales Dashboard - CQRS v2 Integration
 * Modern dashboard with real-time opportunity data and manager visibility
 */
import React, { useState, useEffect } from 'react';
import { dashboardAPI, integrationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  TrendingUp,
  DollarSign,
  Target,
  Users,
  RefreshCw,
  Zap,
  ChevronRight,
  User,
  ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SalesDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [useV2, setUseV2] = useState(true); // Use CQRS v2 by default

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      console.log('Fetching v2 dashboard...');
      // Use CQRS v2 endpoint
      const response = await dashboardAPI.getV2Dashboard();
      console.log('V2 Dashboard response:', response.data);
      setDashboardData(response.data);
      setUseV2(true);
      toast.success('Dashboard loaded successfully');
    } catch (error) {
      console.error('V2 Dashboard error:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await integrationsAPI.triggerCQRSSync();
      toast.success('Sync initiated! Refreshing dashboard...');
      
      // Wait a moment then refresh
      setTimeout(() => {
        fetchDashboard();
        setSyncing(false);
      }, 3000);
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to trigger sync');
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Loading your dashboard...</p>
          <p className="text-slate-400 text-sm mt-2">Powered by {useV2 ? 'CQRS v2' : 'Legacy v1'}</p>
        </div>
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {};
  const opportunities = dashboardData?.opportunities || [];
  const hierarchy = dashboardData?.hierarchy || {};

  return (
    <div className="space-y-6" data-testid="sales-dashboard">
      {/* Header with Sync Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Sales Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            {hierarchy.is_manager ? `Managing ${hierarchy.subordinate_count} team member(s)` : 'Your pipeline overview'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleManualSync}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button
            onClick={fetchDashboard}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Pipeline Value"
          value={`$${metrics.pipeline_value?.toLocaleString() || '0'}`}
          icon={DollarSign}
          gradient="from-emerald-500 to-teal-600"
          bgColor="bg-emerald-50"
          textColor="text-emerald-700"
        />
        
        <MetricCard
          title="Won Revenue"
          value={`$${metrics.won_revenue?.toLocaleString() || '0'}`}
          icon={TrendingUp}
          gradient="from-blue-500 to-cyan-600"
          bgColor="bg-blue-50"
          textColor="text-blue-700"
        />
        
        <MetricCard
          title="Active Opportunities"
          value={metrics.active_opportunities || 0}
          icon={Target}
          gradient="from-violet-500 to-purple-600"
          bgColor="bg-violet-50"
          textColor="text-violet-700"
        />
        
        <MetricCard
          title="Total Opportunities"
          value={metrics.total_opportunities || 0}
          icon={Users}
          gradient="from-orange-500 to-red-600"
          bgColor="bg-orange-50"
          textColor="text-orange-700"
        />
      </div>

      {/* Manager Hierarchy Info */}
      {hierarchy.is_manager && hierarchy.subordinates && hierarchy.subordinates.length > 0 && (
        <div className="card p-6 bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Your Team</h3>
              <p className="text-sm text-indigo-600">Manager view - showing your team's opportunities</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {hierarchy.subordinates.map((sub, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-indigo-200 text-sm"
              >
                <User className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-slate-900">{sub.name}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">{sub.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities Pipeline */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Opportunity Pipeline</h2>
            <p className="text-sm text-slate-500 mt-1">
              {opportunities.length} opportunities • 
              {hierarchy.is_manager && ' Including team opportunities'}
            </p>
          </div>
          <Button
            onClick={() => navigate('/opportunities')}
            variant="outline"
            size="sm"
          >
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {opportunities.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No opportunities yet</p>
            <p className="text-slate-400 text-sm mt-1">Start by creating your first opportunity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp, idx) => {
              const salesperson = opp.salesperson || {};
              const isSubordinateOpp = salesperson.email && salesperson.email !== user?.email;
              
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                    isSubordinateOpp 
                      ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-300' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-900">{opp.name}</h3>
                        {isSubordinateOpp && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium border border-indigo-200">
                            👥 Team
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>
                          <User className="w-3.5 h-3.5 inline mr-1" />
                          {salesperson.name || 'Unassigned'}
                        </span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          opp.stage === 'Won' ? 'bg-emerald-100 text-emerald-700' :
                          opp.stage === 'Lost' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {opp.stage}
                        </span>
                        <span>•</span>
                        <span className="font-medium">${opp.value?.toLocaleString() || '0'}</span>
                      </div>
                      {isSubordinateOpp && salesperson.manager && (
                        <p className="text-xs text-indigo-600 mt-1">
                          Reports to: {salesperson.manager.name}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Data Freshness Indicator */}
      {dashboardData?.data_freshness && (
        <div className="text-center text-sm text-slate-400">
          <p>
            Data synced from CQRS materialized views •{' '}
            {dashboardData.data_freshness.access_computed_at && (
              <>Last updated: {new Date(dashboardData.data_freshness.access_computed_at).toLocaleTimeString()}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, icon: Icon, gradient, bgColor, textColor }) => {
  return (
    <div className={`card p-6 ${bgColor} border-0`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium ${textColor} mb-2`}>{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
