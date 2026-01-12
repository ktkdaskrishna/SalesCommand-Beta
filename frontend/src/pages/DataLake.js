/**
 * Data Lake Page
 * View and explore Data Lake contents
 */
import React, { useState, useEffect } from 'react';
import { dataLakeAPI } from '../services/api';
import { Button } from '../components/ui/button';
import {
  Database,
  Layers,
  Server,
  RefreshCw,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

const DataLake = () => {
  const [activeZone, setActiveZone] = useState('serving');
  const [data, setData] = useState({ count: 0, records: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData(activeZone);
  }, [activeZone]);

  const fetchData = async (zone) => {
    setLoading(true);
    try {
      let response;
      switch (zone) {
        case 'raw':
          response = await dataLakeAPI.getRawRecords({ limit: 50 });
          break;
        case 'canonical':
          response = await dataLakeAPI.getCanonicalRecords({ limit: 50 });
          break;
        case 'serving':
        default:
          response = await dataLakeAPI.getServingRecords({ limit: 50 });
          break;
      }
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setData({ count: 0, records: [] });
    } finally {
      setLoading(false);
    }
  };

  const getZoneInfo = (zone) => {
    const info = {
      raw: {
        icon: Database,
        color: 'amber',
        title: 'Raw Zone (Bronze)',
        description: 'Unprocessed data exactly as received from source systems',
      },
      canonical: {
        icon: Layers,
        color: 'blue',
        title: 'Canonical Zone (Silver)',
        description: 'Normalized and validated data with quality checks applied',
      },
      serving: {
        icon: Server,
        color: 'emerald',
        title: 'Serving Zone (Gold)',
        description: 'Aggregated, query-optimized data ready for dashboards',
      },
    };
    return info[zone];
  };

  const zoneInfo = getZoneInfo(activeZone);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Lake</h1>
          <p className="text-zinc-400 mt-1">Explore your three-zone data architecture</p>
        </div>
        <Button
          onClick={() => fetchData(activeZone)}
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Zone Tabs */}
      <Tabs value={activeZone} onValueChange={setActiveZone} className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
          <TabsTrigger
            value="raw"
            className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
            data-testid="tab-raw"
          >
            <Database className="w-4 h-4 mr-2" />
            Raw
          </TabsTrigger>
          <TabsTrigger
            value="canonical"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            data-testid="tab-canonical"
          >
            <Layers className="w-4 h-4 mr-2" />
            Canonical
          </TabsTrigger>
          <TabsTrigger
            value="serving"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            data-testid="tab-serving"
          >
            <Server className="w-4 h-4 mr-2" />
            Serving
          </TabsTrigger>
        </TabsList>

        {/* Zone Content */}
        <div className="mt-6">
          {/* Zone Header */}
          <div className={`bg-${zoneInfo.color}-500/10 border border-${zoneInfo.color}-500/20 rounded-xl p-6 mb-6`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-${zoneInfo.color}-500/20`}>
                <zoneInfo.icon className={`w-6 h-6 text-${zoneInfo.color}-500`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{zoneInfo.title}</h2>
                <p className="text-zinc-400 text-sm mt-1">{zoneInfo.description}</p>
                <p className="text-white font-medium mt-2">
                  {data.count.toLocaleString()} records
                </p>
              </div>
            </div>
          </div>

          {/* Records Table */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          ) : data.records.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
              <Database className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-white font-medium mb-2">No Records</h3>
              <p className="text-zinc-500">
                This zone is empty. Configure an integration and sync data to populate.
              </p>
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">
                        ID
                      </th>
                      <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">
                        Type
                      </th>
                      <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">
                        {activeZone === 'raw' ? 'Source' : activeZone === 'canonical' ? 'Status' : 'Updated'}
                      </th>
                      <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.records.slice(0, 20).map((record, index) => (
                      <tr key={record.id || index} className="hover:bg-zinc-800/50">
                        <td className="px-6 py-4 text-sm font-mono text-zinc-300">
                          {(record.id || record.canonical_id || record.serving_id || '').slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 text-sm text-white capitalize">
                          {record.entity_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-400">
                          {activeZone === 'raw' 
                            ? record.source 
                            : activeZone === 'canonical'
                              ? record.validation_status
                              : record.last_aggregated 
                                ? new Date(record.last_aggregated).toLocaleDateString()
                                : '-'
                          }
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default DataLake;
