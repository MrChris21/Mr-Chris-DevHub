/**
 * Native share helpers for DevHub Mobile.
 * Uses React Native Share sheet → WhatsApp, Messages, Email, etc.
 */

import { Platform, Share } from 'react-native';
import type {
  Note,
  Reminder,
  Meeting,
  Task,
  Prompt,
  Snippet,
  Bookmark,
} from '@workspace/api-client-react';

export type SharePayload = {
  title: string;
  text: string;
  url?: string;
};

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function tagsLine(tags?: string[] | null): string {
  if (!tags?.length) return '';
  return `Tags: ${tags.join(', ')}`;
}

function joinBlocks(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join('\n');
}

export function formatNoteShare(note: Pick<Note, 'title' | 'content' | 'tags'>): SharePayload {
  const title = note.title?.trim() || 'Untitled Note';
  return {
    title,
    text: joinBlocks(
      title,
      '─'.repeat(Math.min(title.length, 40)),
      note.content?.trim() || undefined,
      tagsLine(note.tags),
      '',
      'Shared from Mr. Chris DevHub',
    ),
  };
}

export function formatReminderShare(
  r: Pick<Reminder, 'title' | 'description' | 'dueAt' | 'done'>,
): SharePayload {
  const title = r.title?.trim() || 'Reminder';
  return {
    title,
    text: joinBlocks(
      `⏰ Reminder: ${title}`,
      r.description?.trim() || undefined,
      r.dueAt ? `Due: ${formatWhen(r.dueAt)}` : undefined,
      `Status: ${r.done ? 'Completed' : 'Pending'}`,
      '',
      'Shared from Mr. Chris DevHub',
    ),
  };
}

export function formatMeetingShare(
  m: Pick<Meeting, 'title' | 'description' | 'startAt' | 'endAt' | 'meetLink'>,
): SharePayload {
  const title = m.title?.trim() || 'Meeting';
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
      '',
      'Shared from Mr. Chris DevHub',
    ),
    url: m.meetLink?.trim() || undefined,
  };
}

export function formatTaskShare(
  t: Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueAt' | 'tags'>,
): SharePayload {
  const title = t.title?.trim() || 'Task';
  const statusLabel =
    t.status === 'in_progress' ? 'In Progress' : t.status === 'done' ? 'Done' : 'To Do';
  return {
    title,
    text: joinBlocks(
      `✅ Task: ${title}`,
      t.description?.trim() || undefined,
      `Status: ${statusLabel}`,
      t.priority ? `Priority: ${t.priority}` : undefined,
      t.dueAt ? `Due: ${formatWhen(t.dueAt)}` : undefined,
      tagsLine(t.tags),
      '',
      'Shared from Mr. Chris DevHub',
    ),
  };
}

export function formatPromptShare(
  p: Pick<Prompt, 'title' | 'content' | 'model' | 'tags'>,
): SharePayload {
  const title = p.title?.trim() || 'AI Prompt';
  return {
    title,
    text: joinBlocks(
      `✨ Prompt: ${title}`,
      p.model ? `Model: ${p.model}` : undefined,
      '',
      p.content?.trim() || undefined,
      tagsLine(p.tags),
      '',
      'Shared from Mr. Chris DevHub',
    ),
  };
}

export function formatSnippetShare(
  s: Pick<Snippet, 'title' | 'code' | 'language' | 'description' | 'tags'>,
): SharePayload {
  const title = s.title?.trim() || 'Code Snippet';
  const lang = s.language || 'text';
  return {
    title,
    text: joinBlocks(
      `💻 Snippet: ${title}`,
      s.description?.trim() || undefined,
      `Language: ${lang}`,
      '',
      '```' + lang,
      s.code?.trim() || '',
      '```',
      tagsLine(s.tags),
      '',
      'Shared from Mr. Chris DevHub',
    ),
  };
}

export function formatBookmarkShare(
  b: Pick<Bookmark, 'title' | 'url' | 'description' | 'tags'>,
): SharePayload {
  const title = b.title?.trim() || 'Bookmark';
  return {
    title,
    text: joinBlocks(
      `🔖 ${title}`,
      b.description?.trim() || undefined,
      b.url,
      tagsLine(b.tags),
      '',
      'Shared from Mr. Chris DevHub',
    ),
    url: b.url,
  };
}

/**
 * Opens the native share sheet (WhatsApp, Messages, Mail, …).
 * Returns true if shared (or sheet opened), false if cancelled/failed.
 */
export async function shareContent(payload: SharePayload): Promise<boolean> {
  const title = payload.title.trim() || 'Shared from DevHub';
  const message =
    payload.url && !payload.text.includes(payload.url)
      ? `${payload.text}\n${payload.url}`
      : payload.text;

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? {
            // iOS: `url` opens as a separate attachment when present.
            message: payload.url ? payload.text : message,
            url: payload.url,
            title,
          }
        : {
            message,
            title,
          },
    );

    if (result.action === Share.sharedAction) return true;
    // dismissedAction or unknown — treat as cancelled, not failure
    return false;
  } catch {
    return false;
  }
}
