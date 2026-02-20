"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, Plus, RotateCcw, Save } from "lucide-react";

interface IndustryConfig {
  slug: string;
  name: string;
  vendors: {
    business: string[];
    personal: string[];
    ambiguous: string[];
    patterns: string[];
  };
  seasonality: number[];
  benchmarks: {
    overheadRatio: {
      healthy: number;
      target: [number, number];
      elevated: number;
      critical: number;
    };
  };
  accountMappings: {
    business: string[];
    personal: string[];
    ambiguous: string[];
  };
  debtServicePatterns: string[];
  ownerDrawPatterns: string[];
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function VendorList({
  title,
  vendors,
  onAdd,
  onRemove,
}: {
  title: string;
  vendors: string[];
  onAdd: (vendor: string) => void;
  onRemove: (index: number) => void;
}) {
  const [newVendor, setNewVendor] = useState("");

  function handleAdd() {
    const trimmed = newVendor.trim();
    if (trimmed && !vendors.includes(trimmed)) {
      onAdd(trimmed);
      setNewVendor("");
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {vendors.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {v}
            <button
              onClick={() => onRemove(i)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted"
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newVendor}
          onChange={(e) => setNewVendor(e.target.value)}
          placeholder="Add vendor..."
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="h-8"
        >
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
}

export default function IndustrySettingsPage() {
  const [config, setConfig] = useState<IndustryConfig | null>(null);
  const [defaultConfig, setDefaultConfig] = useState<IndustryConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/industry/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setDefaultConfig(data);
      }
    } catch {
      toast.error("Failed to load industry config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/industry/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const saved = await res.json();
        setConfig(saved);
        setDefaultConfig(saved);
        toast.success("Industry config saved");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (defaultConfig) {
      setConfig({ ...defaultConfig });
      toast.info("Config reset to saved values");
    }
  }

  function updateVendorList(
    category: "business" | "personal" | "ambiguous" | "patterns",
    updater: (list: string[]) => string[]
  ) {
    if (!config) return;
    setConfig({
      ...config,
      vendors: {
        ...config.vendors,
        [category]: updater(config.vendors[category]),
      },
    });
  }

  function updateSeasonality(index: number, value: number) {
    if (!config) return;
    const newSeasonality = [...config.seasonality];
    newSeasonality[index] = value;
    setConfig({ ...config, seasonality: newSeasonality });
  }

  function updateBenchmark(field: string, value: number) {
    if (!config) return;
    const b = { ...config.benchmarks.overheadRatio };
    if (field === "healthy") b.healthy = value;
    else if (field === "targetMin") b.target = [value, b.target[1]];
    else if (field === "targetMax") b.target = [b.target[0], value];
    else if (field === "elevated") {
      b.elevated = value;
      b.critical = value;
    }
    setConfig({
      ...config,
      benchmarks: { ...config.benchmarks, overheadRatio: b },
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading industry config...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">No industry config found.</p>
      </div>
    );
  }

  const maxSeason = Math.max(...config.seasonality);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Industry Configuration</h1>
          <p className="text-muted-foreground">
            {config.name} ({config.slug})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw size={16} className="mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save size={16} className="mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Vendor Lists */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Lists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <VendorList
            title="Business Vendors"
            vendors={config.vendors.business}
            onAdd={(v) => updateVendorList("business", (list) => [...list, v])}
            onRemove={(i) =>
              updateVendorList("business", (list) =>
                list.filter((_, idx) => idx !== i)
              )
            }
          />
          <VendorList
            title="Personal Vendors"
            vendors={config.vendors.personal}
            onAdd={(v) => updateVendorList("personal", (list) => [...list, v])}
            onRemove={(i) =>
              updateVendorList("personal", (list) =>
                list.filter((_, idx) => idx !== i)
              )
            }
          />
          <VendorList
            title="Ambiguous Vendors"
            vendors={config.vendors.ambiguous}
            onAdd={(v) => updateVendorList("ambiguous", (list) => [...list, v])}
            onRemove={(i) =>
              updateVendorList("ambiguous", (list) =>
                list.filter((_, idx) => idx !== i)
              )
            }
          />
          <VendorList
            title="Pattern Keywords"
            vendors={config.vendors.patterns}
            onAdd={(v) => updateVendorList("patterns", (list) => [...list, v])}
            onRemove={(i) =>
              updateVendorList("patterns", (list) =>
                list.filter((_, idx) => idx !== i)
              )
            }
          />
        </CardContent>
      </Card>

      {/* Seasonality */}
      <Card>
        <CardHeader>
          <CardTitle>Seasonality Indices</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Revenue seasonality by month (1.0 = average). Values above 1.0
            indicate higher-than-average months.
          </p>
          <div className="grid grid-cols-12 gap-2">
            {config.seasonality.map((val, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="relative h-24 w-full">
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-primary/70"
                    style={{
                      height: `${(val / (maxSeason || 1)) * 100}%`,
                    }}
                  />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="2"
                  value={val}
                  onChange={(e) =>
                    updateSeasonality(i, parseFloat(e.target.value) || 0)
                  }
                  className="h-7 w-full text-center text-xs px-0.5"
                />
                <span className="text-xs text-muted-foreground">
                  {MONTH_LABELS[i]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overhead Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle>Overhead Ratio Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                Healthy (below)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.benchmarks.overheadRatio.healthy}
                onChange={(e) =>
                  updateBenchmark("healthy", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                {Math.round(config.benchmarks.overheadRatio.healthy * 100)}%
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                Target Min
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.benchmarks.overheadRatio.target[0]}
                onChange={(e) =>
                  updateBenchmark("targetMin", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                {Math.round(config.benchmarks.overheadRatio.target[0] * 100)}%
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                Target Max
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.benchmarks.overheadRatio.target[1]}
                onChange={(e) =>
                  updateBenchmark("targetMax", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                {Math.round(config.benchmarks.overheadRatio.target[1] * 100)}%
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                Elevated / Critical
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.benchmarks.overheadRatio.elevated}
                onChange={(e) =>
                  updateBenchmark("elevated", parseFloat(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                {Math.round(config.benchmarks.overheadRatio.elevated * 100)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
