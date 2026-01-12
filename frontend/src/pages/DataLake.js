/**
 * Data Lake Page
 * View and explore Data Lake contents with detailed record inspection
 */
import React, { useState, useEffect } from 'react';
import { dataLakeAPI } from '../services/api';
import { Button } from '../components/ui/button';
import {
  Database,
  Layers,
  Server,
  RefreshCw,
  Eye,
  X,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const DataLake = () => {
  const [activeZone, setActiveZone] = useState('serving');
  const [data, setData] = useState({ count: 0, records: [] });
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showArchitecture, setShowArchitecture] = useState(false);

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

  const renderRecordId = (record) => {
    const id = record.id || record.canonical_id || record.serving_id || '';
    return id.length > 8 ? `${id.slice(0, 8)}...` : id;
  };

  const getRecordName = (record) => {
    // Try to find a name field in the record data
    if (record.data?.name) return record.data.name;
    if (record.raw_data?.name) return record.raw_data.name;
    return record.entity_type || 'Unknown';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Lake</h1>
          <p className="text-zinc-400 mt-1">Explore your three-zone data architecture</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowArchitecture(true)}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            data-testid="show-architecture-btn"
          >
            <Info className="w-4 h-4 mr-2" />
            How It Works
          </Button>
          <Button
            onClick={() => fetchData(activeZone)}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Architecture Explanation Card */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Data Flow Pipeline</h3>
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
          {/* Source */}
          <div className="flex flex-col items-center min-w-[100px]">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-2">
              <Database className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-sm font-medium text-white">Odoo ERP</span>
            <span className="text-xs text-zinc-500">Source</span>
          </div>
          
          <ArrowRight className="w-6 h-6 text-zinc-600 shrink-0" />
          
          {/* Raw Zone */}
          <div className="flex flex-col items-center min-w-[100px]">
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-2">
              <Database className="w-6 h-6 text-amber-400" />
            </div>
            <span className="text-sm font-medium text-white">Raw Zone</span>
            <span className="text-xs text-zinc-500">Bronze</span>
          </div>
          
          <ArrowRight className="w-6 h-6 text-zinc-600 shrink-0" />
          
          {/* Field Mapping */}
          <div className="flex flex-col items-center min-w-[100px]">
            <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-2">
              <Layers className="w-6 h-6 text-cyan-400" />
            </div>
            <span className="text-sm font-medium text-white">Mapping</span>
            <span className="text-xs text-zinc-500">Transform</span>
          </div>
          
          <ArrowRight className="w-6 h-6 text-zinc-600 shrink-0" />
          
          {/* Canonical Zone */}
          <div className="flex flex-col items-center min-w-[100px]">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-2">
              <Layers className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-white">Canonical</span>
            <span className="text-xs text-zinc-500">Silver</span>
          </div>
          
          <ArrowRight className="w-6 h-6 text-zinc-600 shrink-0" />
          
          {/* Serving Zone */}
          <div className="flex flex-col items-center min-w-[100px]">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-2">
              <Server className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-white">Serving</span>
            <span className="text-xs text-zinc-500">Gold</span>
          </div>
          
          <ArrowRight className="w-6 h-6 text-zinc-600 shrink-0" />
          
          {/* Dashboard */}
          <div className="flex flex-col items-center min-w-[100px]">
            <div className="w-12 h-12 rounded-lg bg-rose-500/20 flex items-center justify-center mb-2">
              <Eye className="w-6 h-6 text-rose-400" />
            </div>
            <span className="text-sm font-medium text-white">Dashboard</span>
            <span className="text-xs text-zinc-500">UI</span>
          </div>
        </div>
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
            Raw ({data.count && activeZone === 'raw' ? data.count : '...'})
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
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">{zoneInfo.title}</h2>
                <p className="text-zinc-400 text-sm mt-1">{zoneInfo.description}</p>
                <p className="text-white font-medium mt-2">
                  {data.count.toLocaleString()} records
                </p>
              </div>
              
              {/* Zone-specific explanation */}
              <div className="text-right text-sm">
                {activeZone === 'raw' && (
                  <p className="text-amber-400">Original Odoo data format</p>
                )}
                {activeZone === 'canonical' && (
                  <p className="text-blue-400">Standardized schema format</p>
                )}
                {activeZone === 'serving' && (
                  <p className="text-emerald-400">Dashboard-optimized queries</p>
                )}
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
                        Name / Type
                      </th>
                      <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">
                        Entity
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
                          {renderRecordId(record)}
                        </td>
                        <td className="px-6 py-4 text-sm text-white">
                          {getRecordName(record)}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-400 capitalize">
                          {record.entity_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-400">
                          {activeZone === 'raw' 
                            ? record.source 
                            : activeZone === 'canonical'
                              ? (
                                <span className={`px-2 py-1 rounded text-xs ${
                                  record.validation_status === 'valid' 
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {record.validation_status}
                                </span>
                              )
                              : record.last_aggregated 
                                ? new Date(record.last_aggregated).toLocaleDateString()
                                : '-'
                          }
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-zinc-400 hover:text-white"
                            onClick={() => setSelectedRecord(record)}
                            data-testid={`view-record-${index}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
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

      {/* Record Detail Modal */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Record Details ({activeZone.charAt(0).toUpperCase() + activeZone.slice(1)} Zone)
            </DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="mt-4 space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 uppercase">ID</p>
                  <p className="text-sm font-mono text-white break-all">
                    {selectedRecord.id || selectedRecord.canonical_id || selectedRecord.serving_id}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 uppercase">Entity Type</p>
                  <p className="text-sm text-white capitalize">{selectedRecord.entity_type}</p>
                </div>
                {activeZone === 'raw' && (
                  <>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 uppercase">Source</p>
                      <p className="text-sm text-white">{selectedRecord.source}</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 uppercase">Source ID</p>
                      <p className="text-sm font-mono text-white">{selectedRecord.source_id}</p>
                    </div>
                  </>
                )}
                {activeZone === 'canonical' && (
                  <>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 uppercase">Validation Status</p>
                      <p className={`text-sm ${selectedRecord.validation_status === 'valid' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {selectedRecord.validation_status}
                      </p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 uppercase">Quality Score</p>
                      <p className="text-sm text-white">{(selectedRecord.quality_score * 100).toFixed(0)}%</p>
                    </div>
                  </>
                )}
              </div>
              
              {/* Data Content */}
              <div>
                <p className="text-xs text-zinc-500 uppercase mb-2">
                  {activeZone === 'raw' ? 'Raw Data (Original from Odoo)' : 'Normalized Data'}
                </p>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto max-h-80 text-xs text-zinc-300">
                  {JSON.stringify(
                    activeZone === 'raw' ? selectedRecord.raw_data : selectedRecord.data,
                    null,
                    2
                  )}
                </pre>
              </div>
              
              {/* Explanation based on zone */}
              <div className={`p-4 rounded-lg ${
                activeZone === 'raw' ? 'bg-amber-500/10 border border-amber-500/20' :
                activeZone === 'canonical' ? 'bg-blue-500/10 border border-blue-500/20' :
                'bg-emerald-500/10 border border-emerald-500/20'
              }`}>
                <p className={`text-sm ${
                  activeZone === 'raw' ? 'text-amber-400' :
                  activeZone === 'canonical' ? 'text-blue-400' :
                  'text-emerald-400'
                }`}>
                  {activeZone === 'raw' && (
                    <>
                      <strong>Raw Zone:</strong> This is the exact data as received from Odoo. 
                      Field names like "partner_id", "expected_revenue" are Odoo's original format.
                      No transformations applied - preserves data lineage.
                    </>
                  )}
                  {activeZone === 'canonical' && (
                    <>
                      <strong>Canonical Zone:</strong> Data has been normalized to our standard schema.
                      Odoo's "partner_id" → "account_id", "expected_revenue" → "value".
                      Validation checks applied. Ready for cross-source merging.
                    </>
                  )}
                  {activeZone === 'serving' && (
                    <>
                      <strong>Serving Zone:</strong> Optimized for dashboard queries.
                      Aggregated data with fast indexes. This is what the Dashboard reads.
                      Updates lag behind canonical for performance.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Architecture Explanation Modal */}
      <Dialog open={showArchitecture} onOpenChange={setShowArchitecture}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white">How the Data Lake Works</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-6">
            {/* Overview */}
            <p className="text-zinc-400">
              The Data Lake uses a <strong className="text-white">Medallion Architecture</strong> (Bronze → Silver → Gold) 
              to progressively refine data quality and optimize for different use cases.
            </p>
            
            {/* Zones Explanation */}
            <div className="space-y-4">
              {/* Raw Zone */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <h4 className="text-amber-400 font-semibold flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  1. Raw Zone (Bronze)
                </h4>
                <p className="text-zinc-400 text-sm mt-2">
                  <strong>Purpose:</strong> Store exact copy of source data for audit trail<br/>
                  <strong>What happens:</strong> Odoo data saved as-is with timestamp and source ID<br/>
                  <strong>Example fields:</strong> <code className="text-amber-300">partner_id, expected_revenue, stage_id</code>
                </p>
              </div>
              
              {/* Mapping Process */}
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                <h4 className="text-cyan-400 font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Field Mapping (Transform)
                </h4>
                <p className="text-zinc-400 text-sm mt-2">
                  <strong>Purpose:</strong> Convert source-specific fields to standard schema<br/>
                  <strong>What happens:</strong> AI or rule-based mapping translates field names<br/>
                  <strong>Example:</strong>
                </p>
                <div className="mt-2 bg-zinc-800 rounded p-3 font-mono text-xs">
                  <span className="text-amber-300">Odoo</span> → <span className="text-blue-300">Canonical</span><br/>
                  partner_id → account_id<br/>
                  expected_revenue → value<br/>
                  stage_id → stage<br/>
                  write_date → modified_date
                </div>
              </div>
              
              {/* Canonical Zone */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  2. Canonical Zone (Silver)
                </h4>
                <p className="text-zinc-400 text-sm mt-2">
                  <strong>Purpose:</strong> Single source of truth with validated, normalized data<br/>
                  <strong>What happens:</strong> Data validated, quality scored, linked to source<br/>
                  <strong>Example fields:</strong> <code className="text-blue-300">account_id, value, stage, owner_name</code>
                </p>
              </div>
              
              {/* Serving Zone */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <h4 className="text-emerald-400 font-semibold flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  3. Serving Zone (Gold)
                </h4>
                <p className="text-zinc-400 text-sm mt-2">
                  <strong>Purpose:</strong> Fast queries for dashboards and reports<br/>
                  <strong>What happens:</strong> Data aggregated, indexed, cache-ready<br/>
                  <strong>Consumed by:</strong> Dashboard charts, account lists, opportunity tables
                </p>
              </div>
            </div>
            
            {/* Why This Architecture */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <h4 className="text-white font-semibold">Why Three Zones?</h4>
              <ul className="text-zinc-400 text-sm mt-2 space-y-1">
                <li>• <strong>Raw:</strong> Never lose original data - enables reprocessing</li>
                <li>• <strong>Canonical:</strong> One schema for all sources - enables Odoo + Salesforce merge</li>
                <li>• <strong>Serving:</strong> Fast queries - dashboard loads in milliseconds</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataLake;
