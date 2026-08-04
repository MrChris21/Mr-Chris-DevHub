/**
 * DevHub Mobile — color tokens synced from the sibling web artifact's index.css.
 * Dark theme is the primary experience (matches the web app's "Dark Terminal" aesthetic).
 *
 * HSL → Hex conversions sourced from the web app's :root and .dark CSS blocks.
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#131720',
    tint: '#3b82f6',

    // Surfaces
    background: '#f8fafc',
    foreground: '#131720',
    card: '#ffffff',
    cardForeground: '#131720',

    // Interactive
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#e1e7ef',
    secondaryForeground: '#131720',

    // Subdued
    muted: '#e1e7ef',
    mutedForeground: '#657589',

    // Accent / Focus
    accent: '#3b82f6',
    accentForeground: '#ffffff',

    // Destructive
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders & inputs
    border: '#e1e7ef',
    input: '#e1e7ef',
  },

  dark: {
    // Legacy aliases
    text: '#f8fafc',
    tint: '#3b82f6',

    // Surfaces  — hsl(222,25%,10%), hsl(222,25%,12%)
    background: '#131720',
    foreground: '#f8fafc',
    card: '#171c26',
    cardForeground: '#f8fafc',

    // Interactive
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#222939',
    secondaryForeground: '#f8fafc',

    // Subdued  — hsl(222,25%,18%), hsl(215,20%,65%)
    muted: '#222939',
    mutedForeground: '#94a3b8',

    // Accent / Focus
    accent: '#3b82f6',
    accentForeground: '#ffffff',

    // Destructive
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders & inputs
    border: '#222939',
    input: '#222939',
  },

  /** Border radius in pixels (0.5rem from web app) */
  radius: 8,
};

export default colors;

/** Module accent colors — same in both themes (vibrant, syntax-inspired) */
export const accent = {
  cyan: '#06b6d4',    // Notes
  emerald: '#10b981', // Tasks / done
  amber: '#f59e0b',   // Reminders / medium priority
  purple: '#8b5cf6',  // Prompts / AI
  rose: '#f43f5e',    // High priority / overdue
  blue: '#3b82f6',    // Primary / bookmarks
} as const;
