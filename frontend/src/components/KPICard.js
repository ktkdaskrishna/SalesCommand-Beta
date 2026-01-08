import React from "react";
import { cn, formatCurrency, formatNumber } from "../lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const KPICard = ({
  title,
  value,
  target,
  unit = "number",
  trend = "stable",
  trendValue,
  icon: Icon,
  className,
}) => {
  const formatValue = (val) => {
    if (unit === "currency") return formatCurrency(val);
    if (unit === "percentage") return `${val}%`;
    return formatNumber(val);
  };

  const achievement = target ? Math.round((value / target) * 100) : null;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
      ? "text-red-600"
      : "text-slate-500";

  return (
    <div
      className={cn(
        "kpi-card group",
        className
      )}
      data-testid="kpi-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="label mb-1">{title}</p>
          {Icon && (
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
              <Icon className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
            </div>
          )}
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1", trendColor)}>
            <TrendIcon className="w-4 h-4" />
            {trendValue && <span className="text-sm font-medium">{trendValue}</span>}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-auto">
        <p className="kpi-value text-slate-900">{formatValue(value)}</p>
        {target && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500">Target: {formatValue(target)}</span>
              <span
                className={cn(
                  "font-medium",
                  achievement >= 100
                    ? "text-emerald-600"
                    : achievement >= 75
                    ? "text-amber-600"
                    : "text-red-600"
                )}
              >
                {achievement}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  achievement >= 100
                    ? "bg-emerald-500"
                    : achievement >= 75
                    ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{ width: `${Math.min(achievement, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
