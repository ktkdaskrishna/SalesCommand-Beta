import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { seedAPI } from "../services/api";
import { Target, Eye, EyeOff, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

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
      alert("Demo data seeded! You can now login with:\n\nSuper Admin: superadmin@salescommand.com\nAccount Manager: am1@salescommand.com\nPassword: demo123");
    } catch (err) {
      if (err.response?.data?.message === "Data already exists") {
        alert("Demo data already exists. Login with:\n\nSuper Admin: superadmin@salescommand.com\nAccount Manager: am1@salescommand.com\nPassword: demo123");
      }
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickLogin = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("demo123");
  };

  const demoAccounts = [
    { email: "superadmin@salescommand.com", role: "Super Admin", color: "indigo" },
    { email: "ceo@salescommand.com", role: "CEO", color: "purple" },
    { email: "am1@salescommand.com", role: "Account Manager", color: "blue" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">SalesCommand</span>
            </div>
            
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Your Sales Intelligence<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                Command Center
              </span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md">
              Connect your CRM, sync your data, and unlock powerful insights to close more deals.
            </p>
          </div>
          
          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-300">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-sm">AI-powered field mapping</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-sm">Real-time pipeline tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">SalesCommand</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8" data-testid="login-card">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {isLogin ? "Sign in" : "Create account"}
              </h2>
              <p className="text-slate-500 mt-1">
                {isLogin
                  ? "Welcome back! Enter your credentials."
                  : "Get started with your free account."}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="error-message">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
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
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="input"
                    data-testid="role-select"
                  >
                    <option value="account_manager">Account Manager</option>
                    <option value="sales_director">Sales Director</option>
                    <option value="ceo">CEO</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary h-11 text-base"
                data-testid="submit-button"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Sign in" : "Create account"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                {isLogin ? (
                  <>Don&apos;t have an account? <span className="font-medium text-indigo-600">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="font-medium text-indigo-600">Sign in</span></>
                )}
              </button>
            </div>
          </div>

          {/* Quick Access */}
          {isLogin && (
            <div className="mt-6">
              <p className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                Quick Access
              </p>
              <div className="grid grid-cols-3 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    onClick={() => handleQuickLogin(account.email)}
                    className={cn(
                      "p-3 rounded-xl text-center transition-all hover:scale-105",
                      "bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md"
                    )}
                  >
                    <p className="text-xs font-semibold text-slate-900">{account.role}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="w-full mt-3 btn-ghost text-sm"
              >
                {seeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Seed Demo Data"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
