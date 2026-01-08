import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getStageColor(stage) {
  const colors = {
    qualification: "bg-indigo-100 text-indigo-700 border-indigo-200",
    discovery: "bg-blue-100 text-blue-700 border-blue-200",
    proposal: "bg-amber-100 text-amber-700 border-amber-200",
    negotiation: "bg-orange-100 text-orange-700 border-orange-200",
    closed_won: "bg-emerald-100 text-emerald-700 border-emerald-200",
    closed_lost: "bg-red-100 text-red-700 border-red-200",
  };
  return colors[stage] || "bg-slate-100 text-slate-700 border-slate-200";
}

export function getStatusColor(status) {
  const colors = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    in_progress: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return colors[status] || "bg-slate-100 text-slate-700 border-slate-200";
}

export function getPriorityColor(priority) {
  const colors = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-indigo-100 text-indigo-700 border-indigo-200",
  };
  return colors[priority] || "bg-slate-100 text-slate-700 border-slate-200";
}

export function getRoleLabel(role) {
  const labels = {
    ceo: "CEO",
    admin: "Administrator",
    product_director: "Product Director",
    account_manager: "Account Manager",
    strategy: "Strategy Team",
  };
  return labels[role] || role;
}

export function getDaysUntil(date) {
  if (!date) return null;
  const now = new Date();
  const target = new Date(date);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isOverdue(date, status) {
  if (!date || status === "completed" || status === "cancelled") return false;
  return new Date(date) < new Date();
}
