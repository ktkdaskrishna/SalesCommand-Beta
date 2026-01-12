/**
 * Dashboard Page
 * Main dashboard with Data Lake health and integration status
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
      case 'raw': return <Database className="w-5 h-5" />;
      case 'canonical': return <Layers className="w-5 h-5" />;
      case 'serving': return <Server className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getZoneColor = (zone) => {
    switch (zone) {
      case 'raw': return 'text-amber-500 bg-amber-500/10';
      case 'canonical': return 'text-blue-500 bg-blue-500/10';
      case 'serving': return 'text-emerald-500 bg-emerald-500/10';
      default: return 'text-zinc-500 bg-zinc-500/10';
    }
  };

  const getIntegrationIcon = (type) => {
    return <Plug2 className="w-5 h-5" />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Welcome back, {user?.name}</p>
        </div>
        <Button
          onClick={fetchData}
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          data-testid="refresh-dashboard-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Data Lake Health */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-500" />
              Data Lake Health
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dataLakeHealth?.zones && Object.entries(dataLakeHealth.zones).map(([zone, data]) => (
                <div
                  key={zone}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
                  data-testid={`zone-card-${zone}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-lg ${getZoneColor(zone)}`}>
                      {getZoneIcon(zone)}
                    </div>
                    {data.status === 'healthy' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-zinc-400 text-sm capitalize">{zone} Zone</p>
                    <p className="text-2xl font-bold text-white mt-1">{data.count.toLocaleString()}</p>
                    <p className="text-zinc-500 text-sm mt-1">records</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Quality Metrics */}
            {dataLakeHealth?.quality && (
              <div className="mt-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Data Quality</h3>
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-3xl font-bold text-white">{dataLakeHealth.quality.quality_rate}%</p>
                    <p className="text-zinc-500 text-sm">Quality Rate</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${dataLakeHealth.quality.quality_rate}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">{dataLakeHealth.quality.invalid_records}</p>
                    <p className="text-zinc-500 text-sm">Invalid Records</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Integrations */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Plug2 className="w-5 h-5 text-blue-500" />
                Integrations
              </h2>
              <Button
                onClick={() => navigate('/integrations')}
                variant="ghost"
                className="text-zinc-400 hover:text-white"
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
                  className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors cursor-pointer"
                  onClick={() => navigate(`/integrations/${integration.integration_type}`)}
                  data-testid={`integration-card-${integration.integration_type}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-lg bg-zinc-800">
                      {getIntegrationIcon(integration.integration_type)}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      integration.enabled 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-zinc-500/10 text-zinc-400'
                    }`}>
                      {integration.enabled ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-white font-medium capitalize">
                      {integration.integration_type}
                    </p>
                    <p className="text-zinc-500 text-sm mt-1">
                      {integration.last_sync 
                        ? `Last sync: ${new Date(integration.last_sync).toLocaleDateString()}`
                        : 'Never synced'
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => navigate('/integrations')}
                className="bg-emerald-600 hover:bg-emerald-500"
                data-testid="configure-integration-btn"
              >
                <Plug2 className="w-4 h-4 mr-2" />
                Configure Integration
              </Button>
              <Button
                onClick={() => navigate('/data-lake')}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                data-testid="view-data-lake-btn"
              >
                <Database className="w-4 h-4 mr-2" />
                View Data Lake
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;
