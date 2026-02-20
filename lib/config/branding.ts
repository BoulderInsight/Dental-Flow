// Single source of truth for app branding
export const APP_NAME = "PracticePulse";
export const APP_TAGLINE = "Your Personal CFO";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function getExportFilename(type: string, date: string): string {
  return `${APP_NAME.toLowerCase()}-${type}-${date}`;
}
