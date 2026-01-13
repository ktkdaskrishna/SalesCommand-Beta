/**
 * Admin Panel - System Configuration
 * Full CRUD for Roles, Permissions, Departments, Users
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Users, Shield, Building2, Settings, ChevronRight,
  Plus, Edit2, Trash2, Check, X, Search, AlertCircle,
  Loader2, Save, Cloud, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const AdminPanel = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [permissions, setPermissions] = useState({ permissions: [], grouped: {} });

  // Modal/Edit states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingAzure, setSyncingAzure] = useState(false);
  const [expandedRole, setExpandedRole] = useState(null);

  // Check super admin access
  useEffect(() => {
    if (user && !user.is_super_admin) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [usersRes, rolesRes, deptsRes, permsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers }),
        fetch(`${API_URL}/api/admin/roles`, { headers }),
        fetch(`${API_URL}/api/admin/departments`, { headers }),
        fetch(`${API_URL}/api/admin/permissions`, { headers })
      ]);

      if (usersRes.ok) setUsers((await usersRes.json()).users || []);
      if (rolesRes.ok) setRoles((await rolesRes.json()).roles || []);
      if (deptsRes.ok) setDepartments((await deptsRes.json()).departments || []);
      if (permsRes.ok) setPermissions(await permsRes.json());
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ===================== ROLE CRUD =====================
  const saveRole = async (roleData) => {
    try {
      const isEdit = !!roleData.id;
      const url = isEdit 
        ? `${API_URL}/api/admin/roles/${roleData.id}`
        : `${API_URL}/api/admin/roles`;
      
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(roleData)
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(isEdit ? 'Role updated successfully' : 'Role created successfully');
        setShowRoleModal(false);
        setEditingRole(null);
        fetchData();
      } else {
        setError(data.detail || 'Failed to save role');
      }
    } catch (err) {
      setError('Failed to save role');
    }
  };

  const deleteRole = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/admin/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setSuccess('Role deleted');
        fetchData();
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to delete role');
      }
    } catch (err) {
      setError('Failed to delete role');
    }
  };

  // ===================== PERMISSION CRUD =====================
  const createPermission = async (permData) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(permData)
      });

      if (res.ok) {
        setSuccess('Permission created');
        setShowPermissionModal(false);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to create permission');
      }
    } catch (err) {
      setError('Failed to create permission');
    }
  };

  // ===================== DEPARTMENT CRUD =====================
  const saveDepartment = async (deptData) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/departments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deptData)
      });

      if (res.ok) {
        setSuccess('Department created');
        setShowDeptModal(false);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to create department');
      }
    } catch (err) {
      setError('Failed to create department');
    }
  };

  // ===================== USER UPDATE =====================
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
        setSuccess('User updated');
        setEditingUser(null);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user');
    }
  };

  // ===================== ODOO SYNC =====================
  const syncOdooDepartments = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/admin/sync-odoo-departments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Odoo Departments Synced: ${data.created} created, ${data.updated} updated`);
        fetchData();
      } else {
        setError(data.detail || 'Odoo department sync failed');
      }
    } catch (err) {
      setError('Odoo department sync failed');
    } finally {
      setLoading(false);
    }
  };

  const syncOdooUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/admin/sync-odoo-users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Odoo Users Synced: ${data.created} created, ${data.updated} updated. ${data.note}`);
        fetchData();
      } else {
        setError(data.detail || 'Odoo user sync failed');
      }
    } catch (err) {
      setError('Odoo user sync failed');
    } finally {
      setLoading(false);
    }
  };

  // ===================== USER APPROVAL =====================
  const approveUser = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`User ${data.user_email} approved`);
        fetchData();
      } else {
        setError(data.detail || 'Failed to approve user');
      }
    } catch (err) {
      setError('Failed to approve user');
    }
  };

  const rejectUser = async (userId) => {
    if (!confirm('Are you sure you want to reject this user?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(`User ${data.user_email} rejected`);
        fetchData();
      } else {
        setError(data.detail || 'Failed to reject user');
      }
    } catch (err) {
      setError('Failed to reject user');
    }
  };

  // ===================== AZURE SYNC =====================
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
        setSuccess(`Azure AD Sync: ${data.created} created, ${data.updated} updated`);
        fetchData();
      } else {
        setError(data.detail || 'Azure AD sync failed');
      }
    } catch (err) {
      setError('Azure AD sync failed');
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

  // Separate pending users for highlight
  const pendingUsers = filteredUsers.filter(u => u.approval_status === 'pending');
  const approvedUsers = filteredUsers.filter(u => u.approval_status !== 'pending');
  const allFilteredUsers = [...pendingUsers, ...approvedUsers]; // Show pending first

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

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
      <div className="flex-1 p-8 overflow-auto">
        {/* Messages */}
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Check className="w-4 h-4" />
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* ===================== USERS TAB ===================== */}
            {activeTab === 'users' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white">User Management</h1>
                    {pendingUsers.length > 0 && (
                      <p className="text-sm text-yellow-400 mt-1">
                        {pendingUsers.length} user{pendingUsers.length > 1 ? 's' : ''} pending approval
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={syncAzureUsers}
                      disabled={syncingAzure}
                      variant="outline"
                      className="border-blue-600 text-blue-400 hover:bg-blue-500/10"
                      data-testid="sync-azure-btn"
                    >
                      {syncingAzure ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
                      Sync Azure AD
                    </Button>
                    <Button
                      onClick={syncOdooUsers}
                      disabled={loading}
                      variant="outline"
                      className="border-emerald-600 text-emerald-400 hover:bg-emerald-500/10"
                      data-testid="sync-odoo-users-btn"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
                      Sync Odoo Users
                    </Button>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-zinc-800 border-zinc-700 w-64"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-800/50">
                        <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">User</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Role</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Department</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Approval Status</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Status</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allFilteredUsers.map(u => (
                        <tr 
                          key={u.id} 
                          className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${
                            u.approval_status === 'pending' ? 'bg-yellow-500/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p className="text-white font-medium">{u.name || 'No name'}</p>
                            <p className="text-zinc-500 text-sm">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            {editingUser?.id === u.id ? (
                              <select
                                value={editingUser.role_id || ''}
                                onChange={(e) => setEditingUser({ ...editingUser, role_id: e.target.value })}
                                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                              >
                                <option value="">No Role</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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
                          <td className="px-4 py-3">
                            {editingUser?.id === u.id ? (
                              <select
                                value={editingUser.department_id || ''}
                                onChange={(e) => setEditingUser({ ...editingUser, department_id: e.target.value })}
                                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                              >
                                <option value="">No Department</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-zinc-400">{u.department_name || '-'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {u.approval_status === 'pending' ? (
                              <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400 font-medium">
                                🕐 Pending Approval
                              </span>
                            ) : u.approval_status === 'rejected' ? (
                              <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                                ✕ Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                                ✓ Approved
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              u.is_active !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {u.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {u.approval_status === 'pending' ? (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => approveUser(u.id)}
                                  className="bg-green-600 hover:bg-green-500 text-white"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => rejectUser(u.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            ) : editingUser?.id === u.id ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => updateUser(u.id, editingUser)} className="bg-emerald-600 hover:bg-emerald-500">
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingUser(null)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setEditingUser({ id: u.id, role_id: u.role_id, department_id: u.department_id })}>
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

            {/* ===================== ROLES TAB ===================== */}
            {activeTab === 'roles' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
                  <Button onClick={() => { setEditingRole(null); setShowRoleModal(true); }} className="bg-emerald-600 hover:bg-emerald-500" data-testid="create-role-btn">
                    <Plus className="w-4 h-4 mr-2" /> Create Role
                  </Button>
                </div>

                <div className="space-y-3">
                  {roles.map(role => (
                    <div key={role.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      {/* Role Header */}
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50"
                        onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Shield className={`w-5 h-5 ${role.code === 'super_admin' ? 'text-purple-400' : 'text-emerald-400'}`} />
                          <div>
                            <h3 className="font-semibold text-white flex items-center gap-2">
                              {role.name}
                              {role.is_system && <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded">System</span>}
                            </h3>
                            <p className="text-zinc-500 text-sm">{role.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            role.data_scope === 'all' ? 'bg-purple-500/20 text-purple-400' :
                            role.data_scope === 'team' ? 'bg-blue-500/20 text-blue-400' :
                            role.data_scope === 'department' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {role.data_scope}
                          </span>
                          <span className="text-zinc-500 text-sm">{role.permissions?.length || 0} permissions</span>
                          {!role.is_system && (
                            <>
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingRole(role); setShowRoleModal(true); }}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-400" onClick={(e) => { e.stopPropagation(); deleteRole(role.id); }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {expandedRole === role.id ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                        </div>
                      </div>

                      {/* Expanded Permissions */}
                      {expandedRole === role.id && (
                        <div className="border-t border-zinc-800 p-4 bg-zinc-800/30">
                          <p className="text-xs text-zinc-500 mb-3">Assigned Permissions:</p>
                          <div className="flex flex-wrap gap-2">
                            {role.permissions?.map(perm => (
                              <span key={perm} className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">
                                {perm === '*' ? '✓ All Permissions' : perm}
                              </span>
                            ))}
                            {(!role.permissions || role.permissions.length === 0) && (
                              <span className="text-zinc-500 text-sm">No permissions assigned</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===================== DEPARTMENTS TAB ===================== */}
            {activeTab === 'departments' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">Departments</h1>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={syncOdooDepartments}
                      disabled={loading}
                      variant="outline"
                      className="border-emerald-600 text-emerald-400 hover:bg-emerald-500/10"
                      data-testid="sync-odoo-depts-btn"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
                      Sync from Odoo
                    </Button>
                    <Button onClick={() => setShowDeptModal(true)} className="bg-emerald-600 hover:bg-emerald-500" data-testid="create-dept-btn">
                      <Plus className="w-4 h-4 mr-2" /> Create Department
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {departments.map(dept => (
                    <div key={dept.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{dept.name}</h3>
                          <p className="text-zinc-500 text-sm">{dept.code}</p>
                        </div>
                      </div>
                      {dept.description && <p className="text-zinc-400 text-sm mt-3">{dept.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===================== PERMISSIONS TAB ===================== */}
            {activeTab === 'permissions' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-white">All Permissions</h1>
                  <Button onClick={() => setShowPermissionModal(true)} className="bg-emerald-600 hover:bg-emerald-500" data-testid="create-perm-btn">
                    <Plus className="w-4 h-4 mr-2" /> Create Permission
                  </Button>
                </div>

                <div className="space-y-4">
                  {Object.entries(permissions.grouped || {}).map(([module, perms]) => (
                    <div key={module} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <h3 className="text-lg font-semibold text-white mb-4 capitalize flex items-center gap-2">
                        <Settings className="w-4 h-4 text-emerald-500" />
                        {module}
                        <span className="text-zinc-500 text-sm font-normal">({perms.length})</span>
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map(perm => (
                          <div key={perm.code} className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded">
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-zinc-300">{perm.name}</span>
                            <span className="text-xs text-zinc-600 ml-auto font-mono">{perm.code}</span>
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

      {/* ===================== ROLE MODAL ===================== */}
      {showRoleModal && (
        <RoleModal
          role={editingRole}
          permissions={permissions.grouped || {}}
          onSave={saveRole}
          onClose={() => { setShowRoleModal(false); setEditingRole(null); }}
        />
      )}

      {/* ===================== PERMISSION MODAL ===================== */}
      {showPermissionModal && (
        <PermissionModal
          onSave={createPermission}
          onClose={() => setShowPermissionModal(false)}
        />
      )}

      {/* ===================== DEPARTMENT MODAL ===================== */}
      {showDeptModal && (
        <DepartmentModal
          onSave={saveDepartment}
          onClose={() => setShowDeptModal(false)}
        />
      )}
    </div>
  );
};

// ===================== ROLE MODAL COMPONENT =====================
const RoleModal = ({ role, permissions, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    id: role?.id || null,
    code: role?.code || '',
    name: role?.name || '',
    description: role?.description || '',
    data_scope: role?.data_scope || 'own',
    permissions: role?.permissions || []
  });

  const handlePermissionToggle = (permCode) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permCode)
        ? prev.permissions.filter(p => p !== permCode)
        : [...prev.permissions, permCode]
    }));
  };

  const handleSelectAll = (module, perms) => {
    const permCodes = perms.map(p => p.code);
    const allSelected = permCodes.every(c => formData.permissions.includes(c));
    
    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !permCodes.includes(p))
        : [...new Set([...prev.permissions, ...permCodes])]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{role ? 'Edit Role' : 'Create Role'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-zinc-300 mb-2 block">Role Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="e.g., sales_manager"
                className="bg-zinc-800 border-zinc-700"
                required
                disabled={role?.is_system}
              />
            </div>
            <div>
              <Label className="text-zinc-300 mb-2 block">Role Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales Manager"
                className="bg-zinc-800 border-zinc-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-zinc-300 mb-2 block">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <Label className="text-zinc-300 mb-2 block">Data Scope</Label>
              <select
                value={formData.data_scope}
                onChange={(e) => setFormData({ ...formData, data_scope: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
              >
                <option value="own">Own - Only assigned records</option>
                <option value="team">Team - Team members&apos; records</option>
                <option value="department">Department - Department records</option>
                <option value="all">All - Full access to all records</option>
              </select>
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="mb-4">
            <Label className="text-zinc-300 mb-3 block text-lg">Permissions</Label>
            <p className="text-zinc-500 text-sm mb-4">Select the permissions for this role:</p>
          </div>

          <div className="space-y-4">
            {Object.entries(permissions).map(([module, perms]) => (
              <div key={module} className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white capitalize">{module}</h4>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(module, perms)}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    {perms.every(p => formData.permissions.includes(p.code)) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {perms.map(perm => (
                    <label
                      key={perm.code}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        formData.permissions.includes(perm.code)
                          ? 'bg-emerald-500/20 border border-emerald-500/40'
                          : 'bg-zinc-800 border border-transparent hover:border-zinc-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.code)}
                        onChange={() => handlePermissionToggle(perm.code)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded flex items-center justify-center ${
                        formData.permissions.includes(perm.code) ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}>
                        {formData.permissions.includes(perm.code) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-zinc-300">{perm.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </form>

        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-500">
            <Save className="w-4 h-4 mr-2" /> {role ? 'Update Role' : 'Create Role'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ===================== PERMISSION MODAL =====================
const PermissionModal = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    module: '',
    resource: '',
    action: 'view',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Auto-generate code if empty
    const code = formData.code || `${formData.module}.${formData.resource}.${formData.action}`;
    onSave({ ...formData, code });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create Permission</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label className="text-zinc-300 mb-2 block">Permission Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., View Reports"
              className="bg-zinc-800 border-zinc-700"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-zinc-300 mb-2 block">Module</Label>
              <Input
                value={formData.module}
                onChange={(e) => setFormData({ ...formData, module: e.target.value.toLowerCase() })}
                placeholder="crm"
                className="bg-zinc-800 border-zinc-700"
                required
              />
            </div>
            <div>
              <Label className="text-zinc-300 mb-2 block">Resource</Label>
              <Input
                value={formData.resource}
                onChange={(e) => setFormData({ ...formData, resource: e.target.value.toLowerCase() })}
                placeholder="reports"
                className="bg-zinc-800 border-zinc-700"
                required
              />
            </div>
            <div>
              <Label className="text-zinc-300 mb-2 block">Action</Label>
              <select
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
              >
                <option value="view">View</option>
                <option value="create">Create</option>
                <option value="edit">Edit</option>
                <option value="delete">Delete</option>
                <option value="export">Export</option>
                <option value="manage">Manage</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-zinc-300 mb-2 block">Code (auto-generated)</Label>
            <Input
              value={formData.code || `${formData.module}.${formData.resource}.${formData.action}`}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="bg-zinc-800 border-zinc-700 font-mono text-sm"
              placeholder="module.resource.action"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">
              <Plus className="w-4 h-4 mr-2" /> Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ===================== DEPARTMENT MODAL =====================
const DepartmentModal = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create Department</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label className="text-zinc-300 mb-2 block">Department Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Engineering"
              className="bg-zinc-800 border-zinc-700"
              required
            />
          </div>

          <div>
            <Label className="text-zinc-300 mb-2 block">Code</Label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              placeholder="e.g., engineering"
              className="bg-zinc-800 border-zinc-700"
              required
            />
          </div>

          <div>
            <Label className="text-zinc-300 mb-2 block">Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">
              <Plus className="w-4 h-4 mr-2" /> Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
