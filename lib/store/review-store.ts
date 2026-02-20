import { create } from "zustand";

interface ReviewFilters {
  category: string | null;
  vendor: string;
  minConfidence: number | null;
  maxConfidence: number | null;
  dateFrom: string;
  dateTo: string;
}

interface ReviewState {
  selectedTransactionId: string | null;
  filters: ReviewFilters;
  sortBy: string;
  sortDir: "asc" | "desc";
  page: number;
  showHelp: boolean;

  // Batch mode
  selectedTransactionIds: string[];
  toggleBatchSelect: (id: string) => void;
  selectAllVisible: (ids: string[]) => void;
  clearBatchSelection: () => void;

  selectTransaction: (id: string | null) => void;
  setFilter: <K extends keyof ReviewFilters>(
    key: K,
    value: ReviewFilters[K]
  ) => void;
  resetFilters: () => void;
  setSort: (sortBy: string, sortDir: "asc" | "desc") => void;
  setPage: (page: number) => void;
  toggleHelp: () => void;
}

const defaultFilters: ReviewFilters = {
  category: null,
  vendor: "",
  minConfidence: null,
  maxConfidence: null,
  dateFrom: "",
  dateTo: "",
};

export const useReviewStore = create<ReviewState>((set) => ({
  selectedTransactionId: null,
  filters: { ...defaultFilters },
  sortBy: "confidence",
  sortDir: "asc",
  page: 1,
  showHelp: false,

  // Batch mode
  selectedTransactionIds: [],
  toggleBatchSelect: (id) =>
    set((state) => ({
      selectedTransactionIds: state.selectedTransactionIds.includes(id)
        ? state.selectedTransactionIds.filter((i) => i !== id)
        : [...state.selectedTransactionIds, id],
    })),
  selectAllVisible: (ids) => set({ selectedTransactionIds: ids }),
  clearBatchSelection: () => set({ selectedTransactionIds: [] }),

  selectTransaction: (id) => set({ selectedTransactionId: id }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 1,
    })),
  resetFilters: () => set({ filters: { ...defaultFilters }, page: 1 }),
  setSort: (sortBy, sortDir) => set({ sortBy, sortDir, page: 1 }),
  setPage: (page) => set({ page }),
  toggleHelp: () => set((state) => ({ showHelp: !state.showHelp })),
}));
