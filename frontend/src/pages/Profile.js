/**
 * User Profile Page
 * Shows user details including Azure AD and Odoo enrichment data
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  User, Mail, Briefcase, Building2, Phone, MapPin, 
  Calendar, Shield, CheckCircle, AlertCircle, RefreshCw,
  Link as LinkIcon, Users, Loader2
} from 'lucide-react';

const Profile = () => {
  const { user, isExecutive } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relinking, setRelinking] = useState(false);
  const [relinkMessage, setRelinkMessage] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data);
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const data = profile || user;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500">Your account information and settings</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white/20">
              {data?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{data?.name || 'User'}</h2>
              <p className="text-slate-300">{data?.email}</p>
              {data?.role && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                  {data.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfileField icon={User} label="Full Name" value={data?.name} />
              <ProfileField icon={Mail} label="Email" value={data?.email} />
              <ProfileField icon={Briefcase} label="Job Title" value={data?.job_title || data?.odoo_job_title} />
              <ProfileField icon={Building2} label="Company" value={data?.company_name} />
              <ProfileField icon={Phone} label="Mobile" value={data?.mobile_phone} />
              <ProfileField icon={MapPin} label="Office" value={data?.office_location} />
            </div>
          </div>

          {/* Azure AD Info */}
          {data?.auth_provider === 'microsoft' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Azure AD Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ProfileField icon={Building2} label="AD Department" value={data?.ad_department} />
                <ProfileField icon={Briefcase} label="AD Job Title" value={data?.job_title} />
              </div>
            </div>
          )}

          {/* Odoo Integration */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Odoo Integration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                {data?.odoo_matched ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                <div>
                  <p className="text-xs text-slate-500">Odoo Status</p>
                  <p className="font-medium text-slate-900">
                    {data?.odoo_matched ? 'Linked' : 'Not Linked'}
                  </p>
                </div>
              </div>
              <ProfileField icon={Building2} label="Odoo Department" value={data?.odoo_department_name} />
              <ProfileField icon={User} label="Odoo Salesperson" value={data?.odoo_salesperson_name} />
              <ProfileField icon={Users} label="Odoo Team" value={data?.odoo_team_name} />
            </div>
            {data?.odoo_match_status && (
              <p className="text-xs text-slate-400 mt-2">
                Match Status: {data.odoo_match_status}
              </p>
            )}
          </div>

          {/* Account Status */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Account Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${data?.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="font-medium text-slate-900">{data?.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${data?.approval_status === 'approved' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div>
                  <p className="text-xs text-slate-500">Approval</p>
                  <p className="font-medium text-slate-900 capitalize">{data?.approval_status || 'N/A'}</p>
                </div>
              </div>
              <ProfileField icon={Calendar} label="Member Since" value={data?.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Profile Field Component
const ProfileField = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
    <Icon className="w-5 h-5 text-slate-400" />
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value || '-'}</p>
    </div>
  </div>
);

export default Profile;
