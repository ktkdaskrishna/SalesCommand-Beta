/**
 * Dashboard Page
 * Modern light-themed design with Data Lake health and integration status
 * Preserves all existing functionality
 */
import React, { useState, useEffect } from 'react';
import { dataLakeAPI, integrationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import {
  Database,
  Layers,
  Server,
  Activity,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plug2,
  TrendingUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dataLakeHealth, setDataLakeHealth] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [healthRes, integrationsRes] = await Promise.all([
        dataLakeAPI.getHealth(),
        integrationsAPI.list(),
      ]);
      setDataLakeHealth(healthRes.data);
      setIntegrations(integrationsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getZoneIcon = (zone) => {
    switch (zone) {
      case 'raw': return Database;
      case 'canonical': return Layers;
      case 'serving': return Server;
      default: return Activity;
    }
  };

  const getZoneGradient = (zone) => {
    switch (zone) {
      case 'raw': return 'from-amber-500 to-orange-600';
      case 'canonical': return 'from-blue-500 to-indigo-600';
      case 'serving': return 'from-emerald-500 to-teal-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getZoneBg = (zone) => {
    switch (zone) {
      case 'raw': return 'bg-amber-50 border-amber-200';
      case 'canonical': return 'bg-blue-50 border-blue-200';
      case 'serving': return 'bg-emerald-50 border-emerald-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-slate-500 mt-1">Here&apos;s what&apos;s happening with your data platform</p>
        </div>
        <Button
          onClick={fetchData}
          className="btn-secondary"
          data-testid="refresh-dashboard-btn"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-500">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Data Lake Health */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Data Lake Health</h2>
                <p className="text-sm text-slate-500">Monitor your data pipeline zones</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dataLakeHealth?.zones && Object.entries(dataLakeHealth.zones).map(([zone, data]) => {
                const ZoneIcon = getZoneIcon(zone);
                return (
                  <div
                    key={zone}
                    className={`card p-6 border ${getZoneBg(zone)} hover:shadow-lg transition-all`}
                    data-testid={`zone-card-${zone}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getZoneGradient(zone)} flex items-center justify-center shadow-lg`}>
                        <ZoneIcon className="w-6 h-6 text-white" />
                      </div>
                      {data.status === 'healthy' ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Healthy
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Issues
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600 capitalize mb-1">{zone} Zone</p>
                      <p className="text-3xl font-bold text-slate-900">{data.count.toLocaleString()}</p>
                      <p className="text-sm text-slate-500 mt-1">total records</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quality Metrics */}
            {dataLakeHealth?.quality && (
              <div className="card p-6 mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Data Quality Score</h3>
                    <p className="text-sm text-slate-500">Overall pipeline health</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="flex-shrink-0">
                    <p className="text-4xl font-bold text-slate-900">{dataLakeHealth.quality.quality_rate}%</p>
                    <p className="text-sm text-slate-500 mt-1">Quality Rate</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          dataLakeHealth.quality.quality_rate >= 90 
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                            : dataLakeHealth.quality.quality_rate >= 70 
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                            : 'bg-gradient-to-r from-red-500 to-rose-500'
                        }`}
                        style={{ width: `${dataLakeHealth.quality.quality_rate}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-semibold text-slate-900">{dataLakeHealth.quality.invalid_records}</p>
                    <p className="text-sm text-slate-500">Invalid Records</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Integrations */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Plug2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
                  <p className="text-sm text-slate-500">Connected data sources</p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/integrations')}
                className="btn-ghost"
                data-testid="view-integrations-btn"
              >
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="card p-5 hover:shadow-lg hover:border-slate-300 transition-all cursor-pointer group"
                  onClick={() => navigate(`/integrations/${integration.integration_type}`)}
                  data-testid={`integration-card-${integration.integration_type}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <Plug2 className="w-6 h-6 text-slate-600 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      integration.enabled 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {integration.enabled ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 capitalize group-hover:text-blue-600 transition-colors">
                      {integration.integration_type}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {integration.last_sync 
                        ? `Last sync: ${new Date(integration.last_sync).toLocaleDateString()}`
                        : 'Never synced'
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-1 mt-3 text-sm text-slate-400 group-hover:text-blue-500 transition-colors">
                    <span>Configure</span>
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}

              {integrations.length === 0 && (
                <div className="col-span-full card p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Plug2 className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">No integrations yet</h3>
                  <p className="text-slate-500 mb-4">Connect your first data source to get started</p>
                  <Button onClick={() => navigate('/integrations')} className="btn-primary">
                    <Plug2 className="w-4 h-4 mr-2" />
                    Add Integration
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => navigate('/integrations')}
                className="btn-primary"
                data-testid="configure-integration-btn"
              >
                <Plug2 className="w-4 h-4 mr-2" />
                Configure Integration
              </Button>
              <Button
                onClick={() => navigate('/data-lake')}
                className="btn-secondary"
                data-testid="view-data-lake-btn"
              >
                <Database className="w-4 h-4 mr-2" />
                View Data Lake
              </Button>
              <Button
                onClick={() => navigate('/accounts')}
                className="btn-ghost"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                View Accounts
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;
