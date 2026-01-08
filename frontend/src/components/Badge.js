import React from "react";
import { cn, getStageColor, getStatusColor, getPriorityColor } from "../lib/utils";

export const Badge = ({ children, variant = "neutral", className }) => {
  const variants = {
    success: "badge-success",
    warning: "badge-warning",
    error: "badge-error",
    neutral: "badge-neutral",
  };

  return (
    <span className={cn(variants[variant], className)} data-testid="badge">
      {children}
    </span>
  );
};

export const StageBadge = ({ stage }) => {
  const label = stage?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        getStageColor(stage)
      )}
      data-testid="stage-badge"
    >
      {label}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const label = status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        getStatusColor(status)
      )}
      data-testid="status-badge"
    >
      {label}
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const label = priority?.replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        getPriorityColor(priority)
      )}
      data-testid="priority-badge"
    >
      {label}
    </span>
  );
};

export default Badge;
