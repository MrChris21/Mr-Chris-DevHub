import { format, formatDistanceToNow, isPast, isToday } from "date-fns";

function parseDate(isoString: string | undefined | null): Date | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(isoString: string | undefined | null) {
  const d = parseDate(isoString);
  if (!d) return "";
  try {
    return format(d, "MMM d, yyyy h:mm a");
  } catch {
    return "";
  }
}

export function formatTime(isoString: string | undefined | null) {
  const d = parseDate(isoString);
  if (!d) return "";
  try {
    return format(d, "h:mm a");
  } catch {
    return "";
  }
}

export function formatDate(isoString: string | undefined | null) {
  const d = parseDate(isoString);
  if (!d) return "";
  try {
    return format(d, "MMM d, yyyy");
  } catch {
    return "";
  }
}

export function getRelativeTime(isoString: string | undefined | null) {
  const d = parseDate(isoString);
  if (!d) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

export function isOverdue(isoString: string | undefined | null) {
  const d = parseDate(isoString);
  if (!d) return false;
  try {
    return isPast(d);
  } catch {
    return false;
  }
}

export { isToday };
