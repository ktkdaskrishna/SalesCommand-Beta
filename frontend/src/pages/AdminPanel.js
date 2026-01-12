/**
 * Admin Panel - System Configuration
 * Super Admin only - Manages users, roles, departments, permissions
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Users, Shield, Building2, Settings, ChevronRight,
  Plus, Edit2, Trash2, Check, X, Search, AlertCircle,
  Loader2, Save
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const AdminPanel = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [permissions, setPermissions] = useState({ permissions: [], grouped: {} });

  // Edit states
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingAzure, setSyncingAzure] = useState(false);

  // Check if user is super admin
  useEffect(() => {
    if (user && !user.is_super_admin) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch data based on active tab
  useEffect(() => {
    fetchData();
  }, [activeTab, token]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      if (activeTab === 'users' || activeTab === 'roles') {
        const [usersRes, rolesRes, deptsRes] = await Promise.all([
          fetch(`${API_URL}/api/admin/users`, { headers }),
          fetch(`${API_URL}/api/admin/roles`, { headers }),
          fetch(`${API_URL}/api/admin/departments`, { headers })
        ]);

        if (usersRes.ok) setUsers((await usersRes.json()).users || []);
        if (rolesRes.ok) setRoles((await rolesRes.json()).roles || []);
        if (deptsRes.ok) setDepartments((await deptsRes.json()).departments || []);
      }

      if (activeTab === 'departments') {
        const deptsRes = await fetch(`${API_URL}/api/admin/departments`, { headers });
        if (deptsRes.ok) setDepartments((await deptsRes.json()).departments || []);
      }

      if (activeTab === 'permissions') {
        const permsRes = await fetch(`${API_URL}/api/admin/permissions`, { headers });
        if (permsRes.ok) setPermissions(await permsRes.json());
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        fetchData();
        setEditingUser(null);
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const syncAzureUsers = async () => {
    setSyncingAzure(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/admin/sync-azure-users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Show success and refresh users
        alert(`Azure AD Sync Complete!\n\nFetched: ${data.total_fetched}\nCreated: ${data.created}\nUpdated: ${data.updated}\nSkipped: ${data.skipped}`);
        fetchData();
      } else {
        setError(data.detail || 'Azure AD sync failed');
      }
    } catch (err) {
      setError('Failed to sync Azure AD users');
    } finally {
      setSyncingAzure(false);
    }
  };

  const tabs = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'permissions', label: 'All Permissions', icon: Settings },
  ];

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-4">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-500" />
          System Config
        </h2>

        <nav className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`admin-tab-${tab.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${
                activeTab === tab.id ? 'rotate-90' : ''
              }`} />
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {error && (
          <div className="mb-6 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError('')} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Users Tab */}
            {activeTab === 'users' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">User Management</h1>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-zinc-800 border-zinc-700 w-64"
                        data-testid="user-search-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">User</th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Role</th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Department</th>
                        <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Status</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-white font-medium">{u.name || 'No name'}</p>
                              <p className="text-zinc-500 text-sm">{u.email}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {editingUser?.id === u.id ? (
                              <select
                                value={editingUser.role_id || ''}
                                onChange={(e) => setEditingUser({ ...editingUser, role_id: e.target.value })}
                                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                              >
                                <option value="">No Role</option>
                                {roles.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                u.is_super_admin ? 'bg-purple-500/20 text-purple-400' :
                                u.role_name ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                              }`}>
                                {u.is_super_admin ? '👑 Super Admin' : u.role_name || 'No Role'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {editingUser?.id === u.id ? (
                              <select
                                value={editingUser.department_id || ''}
                                onChange={(e) => setEditingUser({ ...editingUser, department_id: e.target.value })}
                                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                              >
                                <option value="">No Department</option>
                                {departments.map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-zinc-400">{u.department_name || '-'}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              u.is_active !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {u.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {editingUser?.id === u.id ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateUser(u.id, {
                                    role_id: editingUser.role_id || null,
                                    department_id: editingUser.department_id || null
                                  })}
                                  className="bg-emerald-600 hover:bg-emerald-500"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingUser(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingUser({
                                  id: u.id,
                                  role_id: u.role_id,
                                  department_id: u.department_id
                                })}
                                data-testid={`edit-user-${u.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
                </div>

                <div className="grid gap-4">
                  {roles.map(role => (
                    <div
                      key={role.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
                      data-testid={`role-card-${role.code}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            {role.name}
                            {role.is_system && (
                              <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded">System</span>
                            )}
                          </h3>
                          <p className="text-zinc-500 text-sm mt-1">{role.description}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          role.data_scope === 'all' ? 'bg-purple-500/20 text-purple-400' :
                          role.data_scope === 'team' ? 'bg-blue-500/20 text-blue-400' :
                          role.data_scope === 'department' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>
                          Scope: {role.data_scope}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {role.permissions?.slice(0, 10).map(perm => (
                          <span
                            key={perm}
                            className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300"
                          >
                            {perm === '*' ? 'All Permissions' : perm}
                          </span>
                        ))}
                        {role.permissions?.length > 10 && (
                          <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-500">
                            +{role.permissions.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Departments Tab */}
            {activeTab === 'departments' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">Departments</h1>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {departments.map(dept => (
                    <div
                      key={dept.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
                      data-testid={`dept-card-${dept.code}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{dept.name}</h3>
                          <p className="text-zinc-500 text-sm">{dept.code}</p>
                        </div>
                      </div>
                      {dept.description && (
                        <p className="text-zinc-400 text-sm mt-3">{dept.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {activeTab === 'permissions' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">All Permissions</h1>
                  <span className="text-zinc-500">{permissions.permissions?.length || 0} total</span>
                </div>

                <div className="space-y-6">
                  {Object.entries(permissions.grouped || {}).map(([module, perms]) => (
                    <div key={module} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 capitalize">
                        {module} <span className="text-zinc-500 text-sm font-normal">({perms.length})</span>
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map(perm => (
                          <div
                            key={perm.code}
                            className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded"
                          >
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-zinc-300">{perm.name}</span>
                            <span className="text-xs text-zinc-600 ml-auto">{perm.code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
