import React, { useState, useEffect } from "react";
import { usersAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import DataTable from "../components/DataTable";
import { formatDate, getRoleLabel, getInitials, cn } from "../lib/utils";
import {
  Users,
  Loader2,
  AlertCircle,
} from "lucide-react";

const roleColors = {
  ceo: "bg-purple-100 text-purple-700 border-purple-200",
  admin: "bg-red-100 text-red-700 border-red-200",
  product_director: "bg-blue-100 text-blue-700 border-blue-200",
  account_manager: "bg-emerald-100 text-emerald-700 border-emerald-200",
  strategy: "bg-amber-100 text-amber-700 border-amber-200",
};

const UsersPage = () => {
  const { isExecutive } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "User",
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-medium">
            {getInitials(val)}
          </div>
          <div>
            <p className="font-medium text-slate-900">{val}</p>
            <p className="text-sm text-slate-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (val) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            roleColors[val]
          )}
        >
          {getRoleLabel(val)}
        </span>
      ),
    },
    {
      key: "product_line",
      label: "Product Line",
      render: (val) => val || "—",
    },
    {
      key: "department",
      label: "Department",
      render: (val) => val || "—",
    },
    {
      key: "created_at",
      label: "Joined",
      render: (val) => formatDate(val),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isExecutive()) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Access Restricted
        </h3>
        <p className="text-slate-500">
          Only administrators can view all users.
        </p>
      </div>
    );
  }

  // Group users by role
  const roleGroups = {
    ceo: users.filter((u) => u.role === "ceo"),
    admin: users.filter((u) => u.role === "admin"),
    product_director: users.filter((u) => u.role === "product_director"),
    account_manager: users.filter((u) => u.role === "account_manager"),
    strategy: users.filter((u) => u.role === "strategy"),
  };

  return (
    <div className="animate-in space-y-6" data-testid="users-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          Users
        </h1>
        <p className="text-slate-600 mt-1">
          Manage team members and their roles
        </p>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(roleGroups).map(([role, roleUsers]) => (
          <div key={role} className="card p-4">
            <p className="label">{getRoleLabel(role)}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{roleUsers.length}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="card" data-testid="users-table">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">All Team Members</h3>
        </div>
        <DataTable
          columns={columns}
          data={users}
          emptyMessage="No users found"
        />
      </div>
    </div>
  );
};

export default UsersPage;
