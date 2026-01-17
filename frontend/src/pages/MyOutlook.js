/**
 * My Outlook Page
 * Personal email and calendar view - User's own data only
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import {
  Mail, Calendar, RefreshCw, Loader2, AlertCircle,
  ExternalLink, Paperclip, Clock, Users, MapPin,
  CheckCircle, XCircle, Video
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const MyOutlook = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('emails');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('week'); // today, week, month, all
  
  // Data
  const [emails, setEmails] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [emailMeta, setEmailMeta] = useState({});
  const [calendarMeta, setCalendarMeta] = useState({});

  // Check connection status
  useEffect(() => {
    checkConnection();
  }, [token]);

  // Fetch data when tab changes
  useEffect(() => {
    if (connectionStatus?.connected) {
      if (activeTab === 'emails') fetchEmails();
      else fetchCalendar();
    }
  }, [activeTab, connectionStatus]);

  const checkConnection = async () => {
    if (!token) return;
    
    try {
      const res = await fetch(`${API_URL}/api/my/connection-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setConnectionStatus(data);
    } catch (err) {
      console.error('Failed to check connection:', err);
    }
  };

  const fetchEmails = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/my/emails?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        // Check for token expiration error in response
        if (data.error_type === 'token_expired') {
          setError(data.message || 'Your Microsoft session has expired. Please sign in with Microsoft again.');
          setConnectionStatus({ connected: false });
          setEmails([]);
          return;
        }
        
        setEmails(data.emails || []);
        setEmailMeta({ count: data.count, total: data.total, source: data.source });
        
        // Show helpful message if no emails but connected
        if (data.emails && data.emails.length === 0 && data.message) {
          setError(data.message);
        }
      } else {
        // Better error messages
        if (res.status === 401) {
          setError('Your Microsoft session has expired. Please sign out and sign in with Microsoft again.');
          setConnectionStatus({ connected: false });
        } else if (res.status === 403) {
          setError('Access denied. Your account may need approval or role assignment.');
        } else if (res.status === 400) {
          setError(data.detail || 'Not connected to Microsoft 365. Please sign in again.');
        } else {
          setError(data.detail || data.message || 'Failed to load emails');
        }
      }
    } catch (err) {
      setError('Failed to fetch emails. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendar = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/my/calendar?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        setCalendar(data.events || []);
        setCalendarMeta({ count: data.count, total: data.total, source: data.source });
      } else {
        setError(data.detail || data.message || 'Failed to load calendar');
      }
    } catch (err) {
      setError('Failed to fetch calendar');
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    if (!token) return;
    setSyncing(true);
    setError('');
    
    try {
      const endpoint = activeTab === 'emails' ? '/api/my/emails/sync' : '/api/my/calendar/sync';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        // Refresh data
        if (activeTab === 'emails') fetchEmails();
        else fetchCalendar();
      } else {
        // Handle token expiration
        if (res.status === 401) {
          setError('Your Microsoft session has expired. Please sign out and sign in with Microsoft again to refresh your connection.');
          setConnectionStatus({ connected: false });
        } else {
          setError(data.detail || 'Sync failed');
        }
      }
    } catch (err) {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit' 
    });
  };

  // Filter calendar events by date range
  const getFilteredCalendar = () => {
    if (!calendar.length) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return calendar.filter(event => {
      const eventDate = new Date(event.start_time);
      
      switch(dateFilter) {
        case 'today':
          return eventDate.toDateString() === today.toDateString();
        case 'week':
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          return eventDate >= today && eventDate <= weekFromNow;
        case 'month':
          const monthFromNow = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
          return eventDate >= today && eventDate <= monthFromNow;
        case 'all':
        default:
          return true;
      }
    }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  };

  const filteredCalendar = getFilteredCalendar();

  // Not connected to MS365
  if (connectionStatus && !connectionStatus.connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">My Outlook</h1>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Not Connected to Microsoft 365</h2>
          <p className="text-zinc-400 mb-6 max-w-md mx-auto">
            To view your emails and calendar, please sign in with your Microsoft account.
          </p>
          <Button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 hover:bg-blue-500"
          >
            Sign in with Microsoft
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Outlook</h1>
          <p className="text-zinc-500 mt-1">Your personal emails and calendar</p>
        </div>
        
        <div className="flex items-center gap-3">
          {connectionStatus?.connected && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Connected as {connectionStatus.ms_email}
            </span>
          )}
          <Button
            onClick={syncData}
            disabled={syncing}
            variant="outline"
            className="border-zinc-700"
            data-testid="sync-outlook-btn"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('emails')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'emails'
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            data-testid="emails-tab"
          >
            <Mail className="w-4 h-4" />
            Emails
            {emailMeta.total > 0 && (
              <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded">{emailMeta.total}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'calendar'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            data-testid="calendar-tab"
          >
            <Calendar className="w-4 h-4" />
            Calendar
            {calendarMeta.total > 0 && (
              <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded">{calendarMeta.total}</span>
            )}
          </button>
        </div>

        {/* Date Filter for Calendar */}
        {activeTab === 'calendar' && (
          <div className="flex gap-1">
            {[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'all', label: 'All' }
            ].map(filter => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  dateFilter === filter.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Emails Tab */}
      {!loading && activeTab === 'emails' && (
        <div className="space-y-2">
          {emails.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <Mail className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No emails found</p>
              <p className="text-zinc-600 text-sm mt-1">Click Sync to fetch your latest emails</p>
            </div>
          ) : (
            emails.map((email, idx) => (
              <div
                key={email.ms_email_id || idx}
                className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors ${
                  !email.is_read ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium truncate ${!email.is_read ? 'text-white' : 'text-zinc-300'}`}>
                        {email.from_name || email.from_email || 'Unknown'}
                      </span>
                      {email.importance === 'high' && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">High</span>
                      )}
                      {email.has_attachments && (
                        <Paperclip className="w-3 h-3 text-zinc-500" />
                      )}
                    </div>
                    <p className={`truncate ${!email.is_read ? 'text-white font-medium' : 'text-zinc-400'}`}>
                      {email.subject || '(No subject)'}
                    </p>
                    <p className="text-zinc-500 text-sm truncate mt-1">
                      {email.body_preview || ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(email.received_at)}
                    </span>
                    {email.web_link && (
                      <a
                        href={email.web_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Calendar Tab */}
      {!loading && activeTab === 'calendar' && (
        <div className="space-y-4">
          {filteredCalendar.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center space-y-6">
              <div>
                <Calendar className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-300 text-lg font-medium mb-2">
                  {calendar.length === 0 ? 'No calendar events synced yet' : `No events for ${dateFilter === 'today' ? 'today' : dateFilter === 'week' ? 'this week' : dateFilter === 'month' ? 'this month' : 'selected period'}`}
                </p>
                <p className="text-zinc-500 text-sm">
                  {calendar.length === 0 ? 'Sync your calendar to see upcoming meetings and events' : 'Try selecting a different date range or sync again'}
                </p>
              </div>
              
              {/* ENHANCED: Action CTAs */}
              {calendar.length === 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    onClick={syncData}
                    disabled={syncing || !connectionStatus?.connected}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Calendar Now
                      </>
                    )}
                  </Button>
                  
                  <a
                    href="https://outlook.office365.com/calendar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors border border-zinc-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Outlook Calendar
                  </a>
                </div>
              )}
              
              {/* Date Range Selector */}
              {calendar.length > 0 && (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-zinc-500 text-sm">Try a different range:</span>
                  <div className="inline-flex gap-2 bg-zinc-800 p-1 rounded-lg">
                    {['today', 'week', 'month', 'all'].map(range => (
                      <button
                        key={range}
                        onClick={() => setDateFilter(range)}
                        className={cn(
                          "px-3 py-1 rounded text-sm font-medium transition-colors capitalize",
                          dateFilter === range 
                            ? "bg-emerald-600 text-white" 
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                        )}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Calendar Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Total Events</p>
                  <p className="text-2xl font-bold text-white">{filteredCalendar.length}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Online Meetings</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {filteredCalendar.filter(e => e.online_meeting_url).length}
                  </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Today</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {filteredCalendar.filter(e => new Date(e.start_time).toDateString() === new Date().toDateString()).length}
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-zinc-500">
                Showing {filteredCalendar.length} of {calendar.length} events
              </p>
              
              {/* Group events by date */}
              {(() => {
                const grouped = filteredCalendar.reduce((acc, event) => {
                  const date = new Date(event.start_time).toDateString();
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(event);
                  return acc;
                }, {});
                
                return Object.entries(grouped).map(([dateStr, events]) => {
                  const date = new Date(dateStr);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();
                  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                  
                  return (
                    <div key={dateStr} className="space-y-2">
                      <div className={`sticky top-0 z-10 py-2 px-3 rounded-lg ${isToday ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-300'}`}>
                        <span className="font-semibold">{dayLabel}</span>
                        <span className="text-sm opacity-70 ml-2">({events.length} event{events.length !== 1 ? 's' : ''})</span>
                      </div>
                      
                      {events.map((event, idx) => (
              <div
                key={event.ms_event_id || idx}
                className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors ${
                  event.is_cancelled ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white truncate">
                        {event.subject || '(No title)'}
                      </span>
                      {event.is_cancelled && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Cancelled</span>
                      )}
                      {event.is_all_day && (
                        <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">All day</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-zinc-400 mt-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatFullDate(event.start_time)}
                      </span>
                      {event.end_time && !event.is_all_day && (
                        <span className="text-zinc-600">→ {formatDate(event.end_time)}</span>
                      )}
                      
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                      
                      {event.attendees?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {event.attendees.length} attendees
                        </span>
                      )}
                    </div>
                    
                    {event.online_meeting_url && (
                      <a
                        href={event.online_meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mt-2"
                      >
                        <Video className="w-3 h-3" />
                        Join online meeting
                      </a>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {event.web_link && (
                      <a
                        href={event.web_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </>
          )}
        </div>
      )}

      {/* Source indicator */}
      {!loading && (activeTab === 'emails' ? emailMeta.source : calendarMeta.source) && (
        <p className="text-xs text-zinc-600 text-center">
          Data from: {activeTab === 'emails' ? emailMeta.source : calendarMeta.source}
        </p>
      )}
    </div>
  );
};

export default MyOutlook;
