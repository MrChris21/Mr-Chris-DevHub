import type {
  Note,
  Reminder,
  Meeting,
  Task,
  Prompt,
  Snippet,
  Bookmark,
} from "@workspace/api-client-react";
import { toast } from "sonner";

export type SharePayload = {
  /** Short title for the share sheet / email subject */
  title: string;
  /** Full body text sent to WhatsApp, Messenger, etc. */
  text: string;
  /** Optional URL (bookmarks, meeting links) */
  url?: string;
};

function formatWhen(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tagsLine(tags?: string[] | null): string {
  if (!tags?.length) return "";
  return `Tags: ${tags.join(", ")}`;
}

function joinBlocks(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join("\n");
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatNoteShare(note: Pick<Note, "title" | "content" | "tags">): SharePayload {
  const title = note.title?.trim() || "Untitled Note";
  return {
    title,
    text: joinBlocks(
      title,
      "─".repeat(Math.min(title.length, 40)),
      note.content?.trim() || undefined,
      tagsLine(note.tags),
      "",
      "Shared from Mr. Chris DevHub",
    ),
  };
}

export function formatReminderShare(
  r: Pick<Reminder, "title" | "description" | "dueAt" | "done">,
): SharePayload {
  const title = r.title?.trim() || "Reminder";
  return {
    title,
    text: joinBlocks(
      `⏰ Reminder: ${title}`,
      r.description?.trim() || undefined,
      r.dueAt ? `Due: ${formatWhen(r.dueAt)}` : undefined,
      `Status: ${r.done ? "Completed" : "Pending"}`,
      "",
      "Shared from Mr. Chris DevHub",
    ),
  };
}

export function formatMeetingShare(
  m: Pick<Meeting, "title" | "description" | "startAt" | "endAt" | "meetLink">,
): SharePayload {
  const title = m.title?.trim() || "Meeting";
  const when = m.endAt
    ? `${formatWhen(m.startAt)} – ${formatWhen(m.endAt)}`
    : formatWhen(m.startAt);
  return {
    title,
    text: joinBlocks(
      `📅 Meeting: ${title}`,
      m.description?.trim() || undefined,
      when ? `When: ${when}` : undefined,
      m.meetLink ? `Join: ${m.meetLink}` : undefined,
      "",
      "Shared from Mr. Chris DevHub",
    ),
    url: m.meetLink?.trim() || undefined,
  };
}

export function formatTaskShare(
  t: Pick<Task, "title" | "description" | "status" | "priority" | "dueAt" | "tags">,
): SharePayload {
  const title = t.title?.trim() || "Task";
  const statusLabel =
    t.status === "in_progress" ? "In Progress" : t.status === "done" ? "Done" : "To Do";
  return {
    title,
    text: joinBlocks(
      `✅ Task: ${title}`,
      t.description?.trim() || undefined,
      `Status: ${statusLabel}`,
      t.priority ? `Priority: ${t.priority}` : undefined,
      t.dueAt ? `Due: ${formatWhen(t.dueAt)}` : undefined,
      tagsLine(t.tags),
      "",
      "Shared from Mr. Chris DevHub",
    ),
  };
}

export function formatPromptShare(
  p: Pick<Prompt, "title" | "content" | "model" | "tags">,
): SharePayload {
  const title = p.title?.trim() || "AI Prompt";
  return {
    title,
    text: joinBlocks(
      `✨ Prompt: ${title}`,
      p.model ? `Model: ${p.model}` : undefined,
      "",
      p.content?.trim() || undefined,
      tagsLine(p.tags),
      "",
      "Shared from Mr. Chris DevHub",
    ),
  };
}

export function formatSnippetShare(
  s: Pick<Snippet, "title" | "code" | "language" | "description" | "tags">,
): SharePayload {
  const title = s.title?.trim() || "Code Snippet";
  const lang = s.language || "text";
  return {
    title,
    text: joinBlocks(
      `💻 Snippet: ${title}`,
      s.description?.trim() || undefined,
      `Language: ${lang}`,
      "",
      "```" + lang,
      s.code?.trim() || "",
      "```",
      tagsLine(s.tags),
      "",
      "Shared from Mr. Chris DevHub",
    ),
  };
}

export function formatBookmarkShare(
  b: Pick<Bookmark, "title" | "url" | "description" | "tags">,
): SharePayload {
  const title = b.title?.trim() || "Bookmark";
  return {
    title,
    text: joinBlocks(
      `🔖 ${title}`,
      b.description?.trim() || undefined,
      b.url,
      tagsLine(b.tags),
      "",
      "Shared from Mr. Chris DevHub",
    ),
    url: b.url,
  };
}

// ─── Share action ─────────────────────────────────────────────────────────────

export function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Opens the system share sheet (WhatsApp, Email, Messenger, etc.) when
 * available. Falls back to copying the message to the clipboard.
 *
 * Returns: 'shared' | 'copied' | 'cancelled' | 'failed'
 */
export async function shareContent(
  payload: SharePayload,
): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const title = payload.title.trim() || "Shared from DevHub";
  // Prefer a single combined message for messaging apps that ignore `title`.
  const text = payload.text.trim();
  const url = payload.url?.trim();

  // navigator.share: some platforms choke if both text and url duplicate the link.
  const shareData: ShareData = { title, text };
  if (url && !text.includes(url)) {
    shareData.url = url;
  }

  try {
    if (canUseNativeShare()) {
      // canShare is optional — older browsers may not have it.
      const can =
        typeof navigator.canShare !== "function" || navigator.canShare(shareData);
      if (can) {
        await navigator.share(shareData);
        return "shared";
      }
    }
  } catch (err) {
    // User dismissed the sheet — not an error.
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    // Fall through to clipboard.
  }

  try {
    const clipboardText = url && !text.includes(url) ? `${text}\n${url}` : text;
    await navigator.clipboard.writeText(clipboardText);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Convenience wrapper: share + toast feedback. */
export async function shareWithFeedback(payload: SharePayload): Promise<void> {
  const result = await shareContent(payload);
  if (result === "shared") {
    toast.success("Shared");
  } else if (result === "copied") {
    toast.success("Copied to clipboard — paste into WhatsApp, email, or anywhere");
  } else if (result === "failed") {
    toast.error("Could not share. Try copying manually.");
  }
  // cancelled → silent
}
