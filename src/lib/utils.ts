import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  return `${month}mo ago`;
}

export function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

export const SOURCE_LABEL: Record<string, string> = {
  job_board: "Job board",
  product_hunt: "Product Hunt",
  directory: "Directory",
  github: "GitHub",
};
