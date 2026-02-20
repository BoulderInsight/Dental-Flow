export function isDemoMode(): boolean {
  return !process.env.INTUIT_CLIENT_ID;
}

export function getDemoStatus() {
  return {
    connected: false,
    mode: "demo" as const,
    message: "Running in demo mode — QBO credentials not configured",
  };
}
