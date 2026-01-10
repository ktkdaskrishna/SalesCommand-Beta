import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { seedAPI } from "../services/api";
import { Target, Eye, EyeOff, Loader2 } from "lucide-react";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("account_manager");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register({ email, password, name, role });
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedAPI.seed();
      setError("");
      alert("Demo data seeded! You can now login with:\n\nCEO: ceo@salescommand.com\nAccount Manager: am1@salescommand.com\nPassword: demo123");
    } catch (err) {
      if (err.response?.data?.message === "Data already exists") {
        alert("Demo data already exists. Login with:\n\nCEO: ceo@salescommand.com\nAccount Manager: am1@salescommand.com\nPassword: demo123");
      }
    } finally {
      setSeeding(false);
    }
  };

  const demoAccounts = [
    { email: "superadmin@salescommand.com", role: "Super Admin" },
    { email: "ceo@salescommand.com", role: "CEO" },
    { email: "sales.director@salescommand.com", role: "Sales Director" },
    { email: "am1@salescommand.com", role: "Account Manager" },
    { email: "finance@salescommand.com", role: "Finance Manager" },
    { email: "referrer@salescommand.com", role: "Referrer" },
  ];

  return (
    <div className="min-h-screen login-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
            <Target className="w-7 h-7 text-white" />
          </div>
          <span className="font-bold text-2xl text-white drop-shadow-lg">
            SalesCommand
          </span>
        </div>

        {/* Login Card */}
        <div className="login-card rounded-2xl p-8 shadow-2xl" data-testid="login-card">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-slate-600 mb-6">
            {isLogin
              ? "Sign in to access your dashboard"
              : "Register for a new account"}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="error-message">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="John Doe"
                  required={!isLogin}
                  data-testid="name-input"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
                required
                data-testid="email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="input"
                  data-testid="role-select"
                >
                  <option value="account_manager">Account Manager</option>
                  <option value="product_director">Product Director</option>
                  <option value="strategy">Strategy Team</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-11 flex items-center justify-center"
              data-testid="submit-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              data-testid="toggle-auth-mode"
            >
              {isLogin
                ? "Don't have an account? Register"
                : "Already have an account? Sign in"}
            </button>
          </div>

          {/* Demo accounts section */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-700">Demo Accounts</p>
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-full text-slate-700 font-medium transition-colors"
                data-testid="seed-data-btn"
              >
                {seeding ? "Seeding..." : "Seed Demo Data"}
              </button>
            </div>
            <div className="space-y-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword("demo123");
                    setIsLogin(true);
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors group"
                  data-testid={`demo-account-${acc.role.toLowerCase().replace(/[^a-z]/g, "-")}`}
                >
                  <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600">
                    {acc.role}
                  </p>
                  <p className="text-xs text-slate-500">{acc.email}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">
              Password for all demo accounts: <span className="font-mono">demo123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
