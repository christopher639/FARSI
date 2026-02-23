import { useEffect, useMemo, useState } from "react";
import { Database, Columns, Layers, AlertTriangle, Brain, Activity } from "lucide-react";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";

type ModelComparison = {
  name: string;
  f1_macro: number;
  accuracy: number;
};

type DatasetSummary = {
  original_rows: number;
  original_columns: number;
  clean_rows: number;
  clean_columns: number;
  column_names: string[];
  feature_columns: string[];
  numeric_features: string[];
  categorical_features: string[];
  feature_count: number;
  missing_columns: Array<{ column: string; missing_percent: number }>;
  target_distribution: Array<{ label: string; count: number; percent: number }>;
};

type ClassificationMetric = {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
};

type ReportEntry = ClassificationMetric | { value: number };

type BestModel = {
  name: string;
  feature_count: number;
  k_best: number;
  classification_report: Record<string, ReportEntry>;
};

type SamplePrediction = {
  dataset_index: number;
  features: Record<string, string | number | null>;
  actual_crime_type: string;
  predicted_crime_type: string;
};

type CrimeModelSummary = {
  dataset: DatasetSummary;
  models: ModelComparison[];
  best_model: BestModel;
  sample_predictions: SamplePrediction[];
};

const isClassificationMetric = (entry: ReportEntry): entry is ClassificationMetric =>
  (entry as ClassificationMetric).precision !== undefined;

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const CrimeModelPage = () => {
  const [summary, setSummary] = useState<CrimeModelSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/crime_model_summary.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Unable to load model summary (${res.status})`);
        }
        return res.json();
      })
      .then((payload: CrimeModelSummary) => setSummary(payload))
      .catch((err: Error) => setError(err.message));
  }, []);

  const classReportRows = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.best_model.classification_report)
      .filter(([label, entry]) => isClassificationMetric(entry))
      .sort(([, a], [, b]) => b.support - a.support)
      .slice(0, 6);
  }, [summary]);

  const aggregateReportRows = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.best_model.classification_report).filter(
      ([label]) => label === "accuracy" || label.includes("avg")
    );
  }, [summary]);

  if (!summary && !error) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground">Loading crime model metrics...</div>
    );
  }

  if (error) {
    return (
      <div className="panel p-6 text-sm text-destructive">
        Failed to load the notebook summary: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel p-6 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Brain className="w-5 h-5" />
              <span className="text-xs uppercase tracking-[0.2em]">ML Notebook Mirror</span>
            </div>
            <h1 className="text-2xl font-semibold">Crime Type Prediction Explorer</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              The summary below mirrors <code>crime_data_exploration.ipynb</code>, including the Avon & Somerset dataset, the three candidate models
              (Logistic Regression, Linear SVC, Random Forest), and the final evaluation used to save <code>models/crime_type_model.joblib</code>.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/data/crime_model_summary.json" download>
              JSON snapshot
            </a>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Original Rows"
            value={summary.dataset.original_rows.toLocaleString()}
            subtitle="Raw Avon Surrey police log"
            icon={Database}
          />
          <MetricCard
            title="Clean Rows"
            value={summary.dataset.clean_rows.toLocaleString()}
            subtitle="After de-duplication & target filtering"
            icon={Activity}
          />
          <MetricCard
            title="Feature Columns"
            value={`${summary.dataset.feature_count}`}
            subtitle={`${summary.dataset.numeric_features.length} numeric / ${summary.dataset.categorical_features.length} categorical`}
            icon={Layers}
          />
          <MetricCard
            title="Total Columns"
            value={`${summary.dataset.clean_columns}`}
            subtitle="Includes the target label"
            icon={Columns}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Crime Type Distribution</h2>
            <span className="text-xs text-muted-foreground">Top {summary.dataset.target_distribution.length} labels</span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={summary.dataset.target_distribution} margin={{ top: 10, right: 14, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="crimeGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.4} />
                <XAxis dataKey="label" strokeOpacity={0.9} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} reports`} />
                <Bar dataKey="count" fill="url(#crimeGradient)" />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h2 className="text-lg font-semibold">Missing Columns</h2>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {summary.dataset.missing_columns.map((column) => (
              <li key={column.column} className="flex justify-between">
                <span>{column.column}</span>
                <span className="font-semibold">{column.missing_percent}% missing</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Model Comparison</h2>
          <span className="text-xs text-muted-foreground">Cross-validation averages (Stratified 5-fold)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.models.map((model) => (
            <MetricCard
              key={model.name}
              title={model.name}
              value={formatPercent(model.f1_macro)}
              subtitle={`Accuracy ${formatPercent(model.accuracy)}`}
              icon={Brain}
              variant={model.name === summary.best_model.name ? "success" : "default"}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Best Model: {summary.best_model.name}</h3>
              <span className="text-xs text-muted-foreground">
                {summary.best_model.feature_count} engineered features · SelectKBest k={summary.best_model.k_best}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-panel-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 uppercase text-[11px] tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Crime Type</th>
                    <th className="px-3 py-2 text-right">Precision</th>
                    <th className="px-3 py-2 text-right">Recall</th>
                    <th className="px-3 py-2 text-right">F1</th>
                    <th className="px-3 py-2 text-right">Support</th>
                  </tr>
                </thead>
                <tbody>
                  {classReportRows.map(([label, metrics]) => (
                    <tr key={label} className="border-t border-panel-border/70">
                      <td className="px-3 py-2 font-medium">{label}</td>
                      <td className="px-3 py-2 text-right">{metrics.precision.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{metrics.recall.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{metrics.f1_score.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{metrics.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px] text-muted-foreground">
              {aggregateReportRows.map(([label, metric]) => (
                <div key={label} className="rounded-lg border border-panel-border/50 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider">{label}</p>
                  <p className="text-base font-semibold">
                    {isClassificationMetric(metric) ? metric.f1_score.toFixed(2) : (metric.value ?? 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Sample Predictions</h3>
            <div className="overflow-hidden rounded-lg border border-panel-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Location</th>
                    <th className="px-2 py-2 text-left">Actual</th>
                    <th className="px-2 py-2 text-left">Predicted</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sample_predictions.map((entry, index) => (
                    <tr key={entry.dataset_index} className="border-t border-panel-border/70 text-[13px]">
                      <td className="px-2 py-2 font-medium">{index + 1}</td>
                      <td className="px-2 py-2">
                        {entry.features.Location ?? entry.features['LSOA name'] ?? "Unknown"}
                        <div className="text-[11px] text-muted-foreground">
                          {entry.features['Longitude'] ?? ""}
                          {entry.features['Latitude'] ? ` · ${entry.features['Latitude']}` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-2 font-semibold text-foreground">{entry.actual_crime_type}</td>
                      <td className="px-2 py-2 text-success font-semibold">{entry.predicted_crime_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CrimeModelPage;
