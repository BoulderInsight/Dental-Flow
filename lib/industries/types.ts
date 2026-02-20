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
}
