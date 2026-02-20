import { create } from "zustand";

interface TransactionsFilters {
  vendor: string;
  category: string | null;
  accountRef: string | null;
  minConfidence: number | null;
  maxConfidence: number | null;
  dateFrom: string;
  dateTo: string;
}

interface TransactionsState {
  filters: TransactionsFilters;
  sortBy: string;
  sortDir: "asc" | "desc";
  page: number;
  expandedId: string | null;

  setFilter: <K extends keyof TransactionsFilters>(
    key: K,
    value: TransactionsFilters[K]
  ) => void;
  resetFilters: () => void;
  setSort: (sortBy: string, sortDir: "asc" | "desc") => void;
  setPage: (page: number) => void;
  toggleExpanded: (id: string) => void;
}

const defaultFilters: TransactionsFilters = {
  vendor: "",
  category: null,
  accountRef: null,
  minConfidence: null,
  maxConfidence: null,
  dateFrom: "",
  dateTo: "",
};

export const useTransactionsStore = create<TransactionsState>((set) => ({
  filters: { ...defaultFilters },
  sortBy: "date",
  sortDir: "desc",
  page: 1,
  expandedId: null,

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      page: 1,
    })),
  resetFilters: () => set({ filters: { ...defaultFilters }, page: 1 }),
  setSort: (sortBy, sortDir) => set({ sortBy, sortDir, page: 1 }),
  setPage: (page) => set({ page }),
  toggleExpanded: (id) =>
    set((state) => ({
      expandedId: state.expandedId === id ? null : id,
    })),
}));
