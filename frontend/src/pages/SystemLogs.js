/**
 * System Logs Page - Admin Only
 * Comprehensive error tracking and session-based debugging
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  Search,
  Calendar,
  User,
  Code,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const SystemLogs = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedError, setExpandedError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [sessionsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/logs/sessions`, { headers }),
        axios.get(`${API_URL}/api/admin/logs/stats?hours=24`, { headers }),
      ]);

      setSessions(sessionsRes.data.sessions);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error('Failed to load system logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/admin/logs/session/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSessionDetails(response.data);
      setSelectedSession(sessionId);
    } catch (error) {
      console.error('Failed to fetch session details:', error);
      toast.error('Failed to load session details');
    }
  };

  const markResolved = async (errorId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/admin/logs/errors/${errorId}/resolve`,
        { resolution_note: 'Resolved by admin' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Error marked as resolved');
      fetchData();
      if (selectedSession) {
        fetchSessionDetails(selectedSession);
      }
    } catch (error) {
      toast.error('Failed to mark error as resolved');
    }
  };

  if (loading) {
    return (
      <div className=\"flex items-center justify-center h-96\">
        <RefreshCw className=\"w-8 h-8 text-indigo-500 animate-spin\" />
      </div>
    );
  }

  return (
    <div className=\"space-y-6\">
      {/* Header */}
      <div className=\"flex items-center justify-between\">
        <div>
          <h1 className=\"text-3xl font-bold text-slate-900\">System Logs</h1>
          <p className=\"text-slate-500 mt-1\">Session-based error tracking and debugging</p>
        </div>
        <Button onClick={fetchData} variant=\"outline\">
          <RefreshCw className=\"w-4 h-4 mr-2\" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className=\"grid grid-cols-1 md:grid-cols-4 gap-4\">
          <StatCard
            title=\"Total Errors (24h)\"
            value={stats.errors.total}
            icon={AlertTriangle}
            color=\"text-orange-600\"
            bgColor=\"bg-orange-50\"
          />
          <StatCard
            title=\"Unresolved\"
            value={stats.errors.unresolved}
            icon={XCircle}
            color=\"text-red-600\"
            bgColor=\"bg-red-50\"
          />
          <StatCard
            title=\"API Success Rate\"
            value={`${stats.api_calls.success_rate.toFixed(1)}%`}
            icon={CheckCircle}
            color=\"text-emerald-600\"
            bgColor=\"bg-emerald-50\"
          />
          <StatCard
            title=\"Unique Sessions\"
            value={stats.sessions.unique}
            icon={User}
            color=\"text-indigo-600\"
            bgColor=\"bg-indigo-50\"
          />
        </div>
      )}

      {/* Sessions with Errors */}
      <div className=\"card p-6\">
        <h2 className=\"text-xl font-bold text-slate-900 mb-4\">
          Sessions with Errors ({sessions.length})
        </h2>

        {sessions.length === 0 ? (
          <div className=\"text-center py-12\">
            <CheckCircle className=\"w-16 h-16 text-emerald-500 mx-auto mb-4\" />
            <p className=\"text-slate-600 font-medium\">No errors in recent sessions</p>
            <p className=\"text-slate-400 text-sm mt-1\">System is running smoothly!</p>
          </div>
        ) : (
          <div className=\"space-y-2\">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  selectedSession === session.session_id
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => fetchSessionDetails(session.session_id)}
              >
                <div className=\"flex items-center justify-between\">
                  <div className=\"flex-1\">
                    <div className=\"flex items-center gap-3 mb-2\">
                      <code className=\"px-2 py-1 bg-slate-100 rounded text-xs font-mono\">
                        {session.session_id.slice(0, 8)}
                      </code>
                      {session.user_email && (
                        <span className=\"text-sm text-slate-600\">
                          <User className=\"w-3.5 h-3.5 inline mr-1\" />
                          {session.user_email}
                        </span>
                      )}
                      <span className=\"px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium\">
                        {session.error_count} error{session.error_count > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className=\"flex items-center gap-4 text-sm text-slate-500\">
                      <span>
                        <Clock className=\"w-3.5 h-3.5 inline mr-1\" />
                        {new Date(session.last_error).toLocaleString()}
                      </span>
                      <span>
                        Types: {session.error_types.join(', ')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className=\"w-5 h-5 text-slate-400\" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Details */}
      {sessionDetails && (
        <div className=\"card p-6\">
          <div className=\"flex items-center justify-between mb-4\">
            <h2 className=\"text-xl font-bold text-slate-900\">
              Session Details
            </h2>
            <code className=\"px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-mono\">
              {selectedSession}
            </code>
          </div>

          {/* Summary */}
          <div className=\"grid grid-cols-4 gap-4 mb-6\">
            <div className=\"p-3 bg-red-50 rounded-lg\">
              <p className=\"text-sm text-red-600 font-medium\">Errors</p>
              <p className=\"text-2xl font-bold text-slate-900\">{sessionDetails.summary.total_errors}</p>
            </div>
            <div className=\"p-3 bg-blue-50 rounded-lg\">
              <p className=\"text-sm text-blue-600 font-medium\">Events</p>
              <p className=\"text-2xl font-bold text-slate-900\">{sessionDetails.summary.total_events}</p>
            </div>
            <div className=\"p-3 bg-purple-50 rounded-lg\">
              <p className=\"text-sm text-purple-600 font-medium\">API Calls</p>
              <p className=\"text-2xl font-bold text-slate-900\">{sessionDetails.summary.total_api_calls}</p>
            </div>
            <div className=\"p-3 bg-emerald-50 rounded-lg\">
              <p className=\"text-sm text-emerald-600 font-medium\">Duration</p>
              <p className=\"text-2xl font-bold text-slate-900\">
                {sessionDetails.summary.duration ? `${sessionDetails.summary.duration.toFixed(0)}s` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Errors List */}
          <div>
            <h3 className=\"font-semibold text-slate-900 mb-3\">Errors in this Session</h3>
            <div className=\"space-y-2\">
              {sessionDetails.errors.map((error) => (
                <div
                  key={error.id}
                  className={`p-4 rounded-lg border ${
                    error.resolved
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className=\"flex items-start justify-between mb-2\">
                    <div className=\"flex-1\">
                      <div className=\"flex items-center gap-2 mb-1\">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          error.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : error.severity === 'warning'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {error.severity}
                        </span>
                        <span className=\"text-sm font-medium text-slate-700\">{error.error_type}</span>
                        {error.resolved && (
                          <CheckCircle className=\"w-4 h-4 text-emerald-600\" />
                        )}
                      </div>
                      <p className=\"text-slate-900 font-medium\">{error.message}</p>
                      <p className=\"text-sm text-slate-500 mt-1\">
                        {new Date(error.timestamp).toLocaleString()}
                        {error.endpoint && ` • ${error.endpoint}`}
                      </p>
                    </div>
                    <div className=\"flex gap-2\">
                      {!error.resolved && (
                        <Button
                          size=\"sm\"
                          variant=\"outline\"
                          onClick={() => markResolved(error.id)}
                        >
                          Mark Resolved
                        </Button>
                      )}
                      <Button
                        size=\"sm\"
                        variant=\"ghost\"
                        onClick={() => setExpandedError(expandedError === error.id ? null : error.id)}
                      >
                        {expandedError === error.id ? <ChevronDown className=\"w-4 h-4\" /> : <ChevronRight className=\"w-4 h-4\" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedError === error.id && (
                    <div className=\"mt-3 pt-3 border-t border-slate-200\">
                      {error.details && (
                        <div className=\"mb-3\">
                          <p className=\"text-sm font-medium text-slate-700 mb-1\">Details:</p>
                          <pre className=\"text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto\">
                            {JSON.stringify(error.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      {error.stack_trace && (
                        <div>
                          <p className=\"text-sm font-medium text-slate-700 mb-1\">Stack Trace:</p>
                          <pre className=\"text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto\">
                            {error.stack_trace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bgColor }) => {
  return (
    <div className={`card p-4 ${bgColor}`}>
      <div className=\"flex items-center justify-between\">
        <div>
          <p className={`text-sm font-medium ${color}`}>{title}</p>
          <p className=\"text-2xl font-bold text-slate-900 mt-1\">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
    </div>
  );
};

export default SystemLogs;
