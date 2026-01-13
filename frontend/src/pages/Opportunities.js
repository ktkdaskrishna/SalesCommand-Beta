import React, { useState, useEffect } from "react";
import { opportunitiesAPI, accountsAPI } from "../services/api";
import DataTable from "../components/DataTable";
import { StageBadge } from "../components/Badge";
import { formatCurrency, formatDate } from "../lib/utils";
import {
  Target,
  Plus,
  Search,
  Filter,
  Loader2,
  X,
} from "lucide-react";

const STAGES = [
  { value: "qualification", label: "Qualification" },
  { value: "discovery", label: "Discovery" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

const PRODUCT_LINES = [
  "MSSP",
  "Application Security",
  "Network Security",
  "GRC",
];

const Opportunities = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    account_id: "",
    value: "",
    stage: "qualification",
    probability: 10,
    expected_close_date: "",
    product_lines: [],
    description: "",
    single_sales_objective: "",
    competition: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [stageFilter]);

  const fetchData = async () => {
    try {
      const [oppsRes, accountsRes] = await Promise.all([
        opportunitiesAPI.getAll({ stage: stageFilter || undefined }),
        accountsAPI.getAll(),
      ]);
      setOpportunities(oppsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await opportunitiesAPI.create({
        ...formData,
        value: parseFloat(formData.value),
        probability: parseInt(formData.probability),
        expected_close_date: formData.expected_close_date || null,
      });
      setShowModal(false);
      setFormData({
        name: "",
        account_id: "",
        value: "",
        stage: "qualification",
        probability: 10,
        expected_close_date: "",
        product_lines: [],
        description: "",
        single_sales_objective: "",
        competition: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating opportunity:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleProductLine = (line) => {
    setFormData((prev) => ({
      ...prev,
      product_lines: prev.product_lines.includes(line)
        ? prev.product_lines.filter((l) => l !== line)
        : [...prev.product_lines, line],
    }));
  };

  const filteredOpportunities = opportunities.filter(
    (opp) =>
      opp.name.toLowerCase().includes(search.toLowerCase()) ||
      opp.account_name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: "name",
      label: "Opportunity",
      render: (val, row) => (
        <div>
          <p className="font-medium text-slate-900">{val}</p>
          <p className="text-sm text-slate-500">{row.account_name}</p>
        </div>
      ),
    },
    {
      key: "value",
      label: "Value",
      render: (val) => <span className="font-semibold">{formatCurrency(val)}</span>,
    },
    {
      key: "stage",
      label: "Stage",
      render: (val) => <StageBadge stage={val} />,
    },
    {
      key: "probability",
      label: "Probability",
      render: (val) => `${val}%`,
    },
    {
      key: "product_lines",
      label: "Products",
      render: (val) => val?.join(", ") || "—",
    },
    {
      key: "expected_close_date",
      label: "Expected Close",
      render: (val) => formatDate(val),
    },
    {
      key: "owner_name",
      label: "Owner",
    },
  ];

  // Calculate stats
  const totalPipeline = opportunities
    .filter((o) => !["closed_won", "closed_lost"].includes(o.stage))
    .reduce((sum, o) => sum + o.value, 0);
  const wonValue = opportunities
    .filter((o) => o.stage === "closed_won")
    .reduce((sum, o) => sum + o.value, 0);
  const avgDealSize = opportunities.length > 0
    ? opportunities.reduce((sum, o) => sum + o.value, 0) / opportunities.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="animate-in space-y-6" data-testid="opportunities-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Target className="w-5 h-5 text-white" />
            </div>
            Opportunities
          </h1>
          <p className="text-slate-500 mt-1">
            Track and manage your sales pipeline
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
          data-testid="add-opportunity-btn"
        >
          <Plus className="w-4 h-4" />
          Add Opportunity
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search opportunities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
              data-testid="search-input"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="input w-auto min-w-[140px]"
            data-testid="stage-filter"
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Total Pipeline</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPipeline)}</p>
        </div>
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Won Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(wonValue)}</p>
        </div>
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Active Deals</p>
          <p className="text-2xl font-bold text-slate-900">
            {opportunities.filter((o) => !["closed_won", "closed_lost"].includes(o.stage)).length}
          </p>
        </div>
        <div className="card p-5 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Avg. Deal Size</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(avgDealSize)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card" data-testid="opportunities-table">
        <DataTable
          columns={columns}
          data={filteredOpportunities}
          emptyMessage="No opportunities found"
        />
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" data-testid="opportunity-modal">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Add New Opportunity</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Opportunity Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                    data-testid="opp-name-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Account *
                  </label>
                  <select
                    value={formData.account_id}
                    onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    className="input"
                    required
                    data-testid="opp-account-select"
                  >
                    <option value="">Select account...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Value *
                  </label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="input"
                    required
                    placeholder="$"
                    data-testid="opp-value-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="input"
                    data-testid="opp-stage-select"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Probability (%)
                  </label>
                  <input
                    type="number"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                    className="input"
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Product Lines
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_LINES.map((line) => (
                      <button
                        key={line}
                        type="button"
                        onClick={() => toggleProductLine(line)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          formData.product_lines.includes(line)
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input min-h-[80px]"
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Single Sales Objective (Blue Sheet)
                  </label>
                  <textarea
                    value={formData.single_sales_objective}
                    onChange={(e) => setFormData({ ...formData, single_sales_objective: e.target.value })}
                    className="input min-h-[60px]"
                    rows={2}
                    placeholder="What is the single most important outcome for this deal?"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Competition
                  </label>
                  <input
                    type="text"
                    value={formData.competition}
                    onChange={(e) => setFormData({ ...formData, competition: e.target.value })}
                    className="input"
                    placeholder="Who are you competing against?"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                  data-testid="save-opportunity-btn"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Opportunities;
