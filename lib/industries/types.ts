export interface IndustryConfig {
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
  valuationMultipliers?: {
    revenueMultiple: { low: number; mid: number; high: number };
    ebitdaMultiple: { low: number; mid: number; high: number };
    sdeMultiple: { low: number; mid: number; high: number };
  };
  taxDefaults?: {
    section179Limit: number;
    bonusDepreciationRate: number;
    estimatedTaxQuarters: string[];
  };
}
