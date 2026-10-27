import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format Indian Rupee currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Mask phone numbers for hospital privacy standards (e.g., +91 98460 •••••)
 */
export function maskPhoneNumber(phone: string, reveal: boolean = false): string {
  if (!phone) return "—";
  if (reveal) return phone;
  // If Indian mobile format (+91 9846012345 or 9846012345)
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.length >= 10) {
    const prefix = cleaned.slice(0, -5);
    return `${prefix} •••••`;
  }
  return phone.slice(0, 3) + " •••••";
}

/**
 * Format call duration in minutes & seconds
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

/**
 * Format date time in Indian Standard Time (IST) readable format
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Format relative time (e.g., 5 mins ago)
 */
export function formatRelativeTime(
  isoString: string,
  baseTime: string | Date = "2026-10-27T11:00:00+05:30"
): string {
  try {
    const date = new Date(isoString);
    const now = typeof baseTime === "string" ? new Date(baseTime) : baseTime;
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  } catch {
    return isoString;
  }
}
