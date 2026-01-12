import React from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import {
  Database,
  Cloud,
  MessageSquare,
  Mail,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Plug,
  Sparkles,
} from "lucide-react";

const integrations = [
  {
    id: "odoo",
    name: "Odoo ERP",
    description: "Sync contacts, opportunities, and activities from your Odoo instance",
    icon: Database,
    color: "purple",
    path: "/integrations/odoo",
    status: "connected", // This would come from API in real app
    features: ["Contacts & Companies", "Opportunities", "Activities"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Connect your Salesforce CRM to sync leads, accounts, and deals",
    icon: Cloud,
    color: "blue",
    path: "/integrations/salesforce",
    status: "not_configured",
    features: ["Leads", "Accounts", "Opportunities"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Integrate with HubSpot CRM for marketing and sales data",
    icon: MessageSquare,
    color: "orange",
    path: "/integrations/hubspot",
    status: "not_configured",
    features: ["Contacts", "Companies", "Deals"],
  },
  {
    id: "ms365",
    name: "Microsoft 365",
    description: "Connect Microsoft 365 for calendar, email, and user sync",
    icon: Mail,
    color: "cyan",
    path: "/integrations/ms365",
    status: "not_configured",
    features: ["Calendar", "Email", "Users"],
  },
];

const colorClasses = {
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: "bg-purple-100 text-purple-600",
    hover: "hover:border-purple-300 hover:shadow-purple-100",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "bg-blue-100 text-blue-600",
    hover: "hover:border-blue-300 hover:shadow-blue-100",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: "bg-orange-100 text-orange-600",
    hover: "hover:border-orange-300 hover:shadow-orange-100",
  },
  cyan: {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    icon: "bg-cyan-100 text-cyan-600",
    hover: "hover:border-cyan-300 hover:shadow-cyan-100",
  },
};

const IntegrationCard = ({ integration }) => {
  const colors = colorClasses[integration.color];
  const Icon = integration.icon;
  const isConnected = integration.status === "connected";

  return (
    <Link
      to={integration.path}
      className={cn(
        "block bg-white rounded-xl border p-6 transition-all duration-200 hover:shadow-lg",
        colors.border,
        colors.hover
      )}
      data-testid={`integration-card-${integration.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colors.icon)}>
          <Icon className="w-6 h-6" />
        </div>
        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            <AlertCircle className="w-3.5 h-3.5" />
            Not Configured
          </span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-1">{integration.name}</h3>
      <p className="text-sm text-slate-500 mb-4">{integration.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {integration.features.map((feature) => (
          <span
            key={feature}
            className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded"
          >
            {feature}
          </span>
        ))}
      </div>

      <div className="flex items-center text-sm font-medium text-indigo-600 group-hover:text-indigo-700">
        {isConnected ? "Manage Integration" : "Configure Integration"}
        <ArrowRight className="w-4 h-4 ml-1" />
      </div>
    </Link>
  );
};

const Integrations = () => {
  const connectedCount = integrations.filter((i) => i.status === "connected").length;

  return (
    <div className="space-y-6 animate-in" data-testid="integrations-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-500 mt-0.5">
            Connect your tools and sync data automatically
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{connectedCount}</span> of{" "}
            {integrations.length} connected
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-indigo-900">AI-Powered Field Mapping</h3>
          <p className="text-sm text-indigo-700 mt-0.5">
            Our AI automatically suggests field mappings when you connect a new integration,
            saving you hours of manual configuration.
          </p>
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      {/* Coming Soon Section */}
      <div className="border-t border-slate-200 pt-8 mt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Coming Soon</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Slack", "Zoom", "Google Workspace", "Pipedrive"].map((name) => (
            <div
              key={name}
              className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center opacity-60"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center mx-auto mb-2">
                <Plug className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Integrations;
