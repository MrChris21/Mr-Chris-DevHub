import { format, formatDistanceToNow, isPast, isToday } from "date-fns";

export function formatDateTime(isoString: string | undefined | null) {
  if (!isoString) return "";
  return format(new Date(isoString), "MMM d, yyyy h:mm a");
}

export function formatTime(isoString: string | undefined | null) {
  if (!isoString) return "";
  return format(new Date(isoString), "h:mm a");
}

export function formatDate(isoString: string | undefined | null) {
  if (!isoString) return "";
  return format(new Date(isoString), "MMM d, yyyy");
}

export function getRelativeTime(isoString: string | undefined | null) {
  if (!isoString) return "";
  return formatDistanceToNow(new Date(isoString), { addSuffix: true });
}

export function isOverdue(isoString: string | undefined | null) {
  if (!isoString) return false;
  return isPast(new Date(isoString));
}
