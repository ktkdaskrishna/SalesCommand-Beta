/**
 * Blue Sheet Configuration Component
 * Admin UI for managing AI scoring weights used in opportunity probability calculations
 */
import React, { useState, useEffect } from 'react';
import { configAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Brain,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Scale,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';

// Weight Category Card
const WeightCategoryCard = ({ title, description, icon: Icon, children, colorClass = "blue" }) => {
  const colors = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600" },
    green: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600" },
    red: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600" },
    amber: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600" },
  };
  const c = colors[colorClass] || colors.blue;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center border ${c.border}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
};

// Weight Input Field
const WeightInput = ({ label, value, onChange, min = -100, max = 100, step = 1, helperText, isNegative = false }) => (
  <div className="flex items-center justify-between gap-4 p-3 bg-white rounded-lg border border-slate-200">
    <div className="flex-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {helperText && <p className="text-xs text-slate-400 mt-0.5">{helperText}</p>}
    </div>
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className={`w-20 text-center font-medium ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}
      />
      <span className="text-xs text-slate-400">pts</span>
    </div>
  </div>
);

// Validation Warning
const ValidationWarning = ({ message }) => (
  <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
    <span>{message}</span>
  </div>
);

const BlueSheetConfiguration = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weights, setWeights] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationWarnings, setValidationWarnings] = useState([]);

  useEffect(() => {
    fetchWeights();
  }, []);

  const fetchWeights = async () => {
    try {
      setLoading(true);
      const response = await configAPI.getBlueSheetWeights();
      setWeights(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load Blue Sheet weights');
    } finally {
      setLoading(false);
    }
  };

  // Validate weights
  useEffect(() => {
    if (!weights) return;
    
    const warnings = [];
    
    // Check if max possible score is reasonable
    const maxPositive = 
      weights.economic_buyer_identified +
      weights.economic_buyer_favorable +
      (weights.max_user_buyers * weights.user_buyer_favorable_each) +
      (weights.max_technical_buyers * weights.technical_buyer_favorable_each) +
      weights.coach_identified +
      weights.coach_engaged +
      weights.clear_business_results +
      weights.quantifiable_value +
      weights.next_steps_defined +
      weights.mutual_action_plan;
    
    if (weights.max_possible_score > maxPositive) {
      warnings.push(`Max possible score (${weights.max_possible_score}) exceeds sum of all positive weights (${maxPositive}). This may cause inflated probabilities.`);
    }
    
    if (weights.max_possible_score < maxPositive * 0.5) {
      warnings.push(`Max possible score (${weights.max_possible_score}) is too low compared to positive weights (${maxPositive}). This may cause deflated probabilities.`);
    }
    
    // Check for extreme negative weights
    const totalNegative = Math.abs(
      weights.no_access_to_economic_buyer +
      weights.reorganization_pending +
      weights.budget_not_confirmed +
      weights.competition_preferred +
      weights.timeline_unclear
    );
    
    if (totalNegative > maxPositive) {
      warnings.push('Total negative penalty weights exceed positive weights. Consider rebalancing.');
    }
    
    setValidationWarnings(warnings);
  }, [weights]);

  const handleWeightChange = (key, value) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await configAPI.updateBlueSheetWeights(weights);
      setSuccess('Blue Sheet weights saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save weights');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="bluesheet-config">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Blue Sheet AI Configuration
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Configure the weights used in AI probability calculations for opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchWeights}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {success}
        </div>
      )}
      
      {/* Validation Warnings */}
      {validationWarnings.map((warning, i) => (
        <ValidationWarning key={i} message={warning} />
      ))}

      {/* Info Banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">How Blue Sheet Scoring Works</p>
          <p className="text-blue-600 mt-1">
            Positive weights increase probability when criteria are met. Negative weights (red flags) decrease it.
            The final score is scaled to 0-100% based on the maximum possible score setting.
          </p>
        </div>
      </div>

      {weights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buying Influences */}
          <WeightCategoryCard
            title="Buying Influences"
            description="Key stakeholders in the decision process"
            icon={TrendingUp}
            colorClass="green"
          >
            <WeightInput
              label="Economic Buyer Identified"
              value={weights.economic_buyer_identified}
              onChange={(v) => handleWeightChange('economic_buyer_identified', v)}
              helperText="Person with final budget authority"
            />
            <WeightInput
              label="Economic Buyer Favorable"
              value={weights.economic_buyer_favorable}
              onChange={(v) => handleWeightChange('economic_buyer_favorable', v)}
              helperText="They support our solution"
            />
            <WeightInput
              label="User Buyer (per favorable)"
              value={weights.user_buyer_favorable_each}
              onChange={(v) => handleWeightChange('user_buyer_favorable_each', v)}
              helperText={`Max ${weights.max_user_buyers} counted`}
            />
            <WeightInput
              label="Technical Buyer (per favorable)"
              value={weights.technical_buyer_favorable_each}
              onChange={(v) => handleWeightChange('technical_buyer_favorable_each', v)}
              helperText={`Max ${weights.max_technical_buyers} counted`}
            />
            <WeightInput
              label="Coach Identified"
              value={weights.coach_identified}
              onChange={(v) => handleWeightChange('coach_identified', v)}
              helperText="Internal guide/advocate"
            />
            <WeightInput
              label="Coach Engaged"
              value={weights.coach_engaged}
              onChange={(v) => handleWeightChange('coach_engaged', v)}
              helperText="Actively helping us win"
            />
          </WeightCategoryCard>

          {/* Red Flags */}
          <WeightCategoryCard
            title="Red Flags"
            description="Risk factors that reduce probability"
            icon={TrendingDown}
            colorClass="red"
          >
            <WeightInput
              label="No Access to Economic Buyer"
              value={weights.no_access_to_economic_buyer}
              onChange={(v) => handleWeightChange('no_access_to_economic_buyer', v)}
              isNegative
              helperText="Cannot reach the decision maker"
            />
            <WeightInput
              label="Reorganization Pending"
              value={weights.reorganization_pending}
              onChange={(v) => handleWeightChange('reorganization_pending', v)}
              isNegative
              helperText="Organizational changes happening"
            />
            <WeightInput
              label="Budget Not Confirmed"
              value={weights.budget_not_confirmed}
              onChange={(v) => handleWeightChange('budget_not_confirmed', v)}
              isNegative
              helperText="No confirmed budget allocation"
            />
            <WeightInput
              label="Competition Preferred"
              value={weights.competition_preferred}
              onChange={(v) => handleWeightChange('competition_preferred', v)}
              isNegative
              helperText="Competitor has advantage"
            />
            <WeightInput
              label="Timeline Unclear"
              value={weights.timeline_unclear}
              onChange={(v) => handleWeightChange('timeline_unclear', v)}
              isNegative
              helperText="No clear decision timeline"
            />
          </WeightCategoryCard>

          {/* Win Results */}
          <WeightCategoryCard
            title="Win Results"
            description="Value proposition clarity"
            icon={CheckCircle2}
            colorClass="blue"
          >
            <WeightInput
              label="Clear Business Results"
              value={weights.clear_business_results}
              onChange={(v) => handleWeightChange('clear_business_results', v)}
              helperText="Customer understands expected outcomes"
            />
            <WeightInput
              label="Quantifiable Value"
              value={weights.quantifiable_value}
              onChange={(v) => handleWeightChange('quantifiable_value', v)}
              helperText="ROI/benefits are measurable"
            />
          </WeightCategoryCard>

          {/* Action Plan */}
          <WeightCategoryCard
            title="Action Plan"
            description="Execution readiness"
            icon={Scale}
            colorClass="amber"
          >
            <WeightInput
              label="Next Steps Defined"
              value={weights.next_steps_defined}
              onChange={(v) => handleWeightChange('next_steps_defined', v)}
              helperText="Clear action items agreed"
            />
            <WeightInput
              label="Mutual Action Plan"
              value={weights.mutual_action_plan}
              onChange={(v) => handleWeightChange('mutual_action_plan', v)}
              helperText="Joint plan with customer"
            />
          </WeightCategoryCard>

          {/* Calculation Settings */}
          <div className="lg:col-span-2">
            <WeightCategoryCard
              title="Calculation Settings"
              description="Control how the final probability is computed"
              icon={Brain}
              colorClass="blue"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <WeightInput
                  label="Max Possible Score"
                  value={weights.max_possible_score}
                  onChange={(v) => handleWeightChange('max_possible_score', v)}
                  min={1}
                  max={200}
                  helperText="Used to scale probability to 0-100%"
                />
                <WeightInput
                  label="Max User Buyers Counted"
                  value={weights.max_user_buyers}
                  onChange={(v) => handleWeightChange('max_user_buyers', v)}
                  min={1}
                  max={10}
                  step={1}
                  helperText="Cap on user buyer contributions"
                />
                <WeightInput
                  label="Max Technical Buyers Counted"
                  value={weights.max_technical_buyers}
                  onChange={(v) => handleWeightChange('max_technical_buyers', v)}
                  min={1}
                  max={10}
                  step={1}
                  helperText="Cap on tech buyer contributions"
                />
              </div>
            </WeightCategoryCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlueSheetConfiguration;
