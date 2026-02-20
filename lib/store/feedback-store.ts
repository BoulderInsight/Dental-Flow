import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CorrectionCounts {
  [vendorCategory: string]: number; // key format: "vendor::category"
}

interface FeedbackState {
  corrections: CorrectionCounts;
  recordCorrection: (vendor: string, category: string) => number;
  clearCorrections: () => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      corrections: {},
      recordCorrection: (vendor: string, category: string) => {
        const key = `${vendor.toLowerCase()}::${category}`;
        const current = get().corrections[key] || 0;
        const newCount = current + 1;
        set((state) => ({
          corrections: { ...state.corrections, [key]: newCount },
        }));
        return newCount;
      },
      clearCorrections: () => set({ corrections: {} }),
    }),
    { name: "practicepulse-feedback" }
  )
);
