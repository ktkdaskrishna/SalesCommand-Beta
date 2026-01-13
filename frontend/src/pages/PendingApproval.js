/**
 * Pending Approval Page
 * Shown to users who have signed up but are awaiting admin approval
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, Shield, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';

const PendingApproval = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Status Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Account Pending Approval
          </h1>

          {/* User Info */}
          <p className="text-zinc-400 mb-6">
            Welcome, <span className="text-white font-medium">{user?.name || user?.email}</span>
          </p>

          {/* Message */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-zinc-300 mb-2">
                  Your account has been successfully created. However, access to the Sales Intelligence Platform requires administrator approval.
                </p>
                <p className="text-sm text-zinc-400">
                  A system administrator has been notified and will review your request shortly. You will receive access once your account has been approved.
                </p>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-yellow-400">Awaiting Approval</span>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 mb-4">
              If you believe this is an error, please contact your system administrator.
            </p>
            <Button
              onClick={logout}
              variant="outline"
              className="w-full border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-4">
          Sales Intelligence Platform © 2025
        </p>
      </div>
    </div>
  );
};

export default PendingApproval;
