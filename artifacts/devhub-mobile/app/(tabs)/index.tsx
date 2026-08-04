import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { accent } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import type { DashboardSummary, Note, Reminder, Task } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const h = diff / 3_600_000;
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDue(dateStr: string): { label: string; overdue: boolean } {
  const date = new Date(dateStr);
  const diff = date.getTime() - Date.now();
  if (diff < 0) return { label: 'Overdue', overdue: true };
  const h = diff / 3_600_000;
  if (h < 1) return { label: 'Due soon', overdue: false };
  if (h < 24) return { label: `in ${Math.floor(h)}h`, overdue: false };
  const d = Math.floor(h / 24);
  if (d === 1) return { label: 'Tomorrow', overdue: false };
  return { label: `in ${d}d`, overdue: false };
}

function priorityColor(p: string): string {
  if (p === 'high') return accent.rose;
  if (p === 'medium') return accent.amber;
  return accent.emerald;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  iconName: keyof typeof Feather.glyphMap;
  color: string;
}

function StatCard({ label, value, iconName, color }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Feather name={iconName} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  iconName: keyof typeof Feather.glyphMap;
  color: string;
}
function SectionHeader({ title, iconName, color }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Feather name={iconName} size={14} color={color} />
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
    </View>
  );
}

function NoteRow({ note }: { note: Note }) {
  const colors = useColors();
  return (
    <View style={[styles.listRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.listRowContent}>
        <View style={styles.listRowTop}>
          {note.pinned && <Feather name="bookmark" size={12} color={accent.amber} style={styles.pinnedIcon} />}
          <Text style={[styles.listRowTitle, { color: colors.foreground }]} numberOfLines={1}>
            {note.title}
          </Text>
        </View>
        {!!note.content && (
          <Text style={[styles.listRowSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {note.content.replace(/#{1,6}\s|```[\s\S]*?```|\*\*|__|\n/g, ' ').trim()}
          </Text>
        )}
      </View>
      <Text style={[styles.listRowMeta, { color: colors.mutedForeground }]}>{timeAgo(note.updatedAt)}</Text>
    </View>
  );
}

function TaskRow({ task }: { task: Task }) {
  const colors = useColors();
  const pc = priorityColor(task.priority);
  return (
    <View style={[styles.listRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.priorityDot, { backgroundColor: pc }]} />
      <View style={styles.listRowContent}>
        <Text style={[styles.listRowTitle, { color: colors.foreground }]} numberOfLines={1}>
          {task.title}
        </Text>
        {!!task.description && (
          <Text style={[styles.listRowSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {task.description}
          </Text>
        )}
      </View>
      <Text style={[styles.priorityBadge, { color: pc, borderColor: pc + '44' }]}>
        {task.priority}
      </Text>
    </View>
  );
}

function ReminderRow({ reminder }: { reminder: Reminder }) {
  const colors = useColors();
  const { label, overdue } = formatDue(reminder.dueAt);
  const labelColor = overdue ? accent.rose : accent.amber;
  return (
    <View style={[styles.listRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="bell" size={14} color={labelColor} style={{ marginRight: 10 }} />
      <View style={styles.listRowContent}>
        <Text style={[styles.listRowTitle, { color: colors.foreground }]} numberOfLines={1}>
          {reminder.title}
        </Text>
      </View>
      <Text style={[styles.listRowMeta, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useGetDashboardSummary();

  const counts = data?.counts;
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPadding + 16, paddingBottom: Platform.OS === 'web' ? 34 : 20 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.heroSection}>
        <Text style={[styles.heroTitle, { color: colors.primary }]}>DevHub</Text>
        <Text style={[styles.heroDate, { color: colors.mutedForeground }]}>{todayLabel}</Text>
      </View>

      {/* Stats */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard label="Notes" value={counts?.notes ?? 0} iconName="file-text" color={accent.cyan} />
          <StatCard label="Tasks" value={counts?.tasks ?? 0} iconName="check-square" color={accent.emerald} />
          <StatCard label="Reminders" value={counts?.reminders ?? 0} iconName="bell" color={accent.amber} />
          <StatCard label="Bookmarks" value={counts?.bookmarks ?? 0} iconName="bookmark" color={accent.purple} />
        </View>
      )}

      {/* Today's Meetings */}
      {!isLoading && (data?.todayMeetings?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <SectionHeader title="TODAY'S MEETINGS" iconName="video" color={accent.purple} />
          {data!.todayMeetings.map(m => (
            <View key={m.id} style={[styles.meetingCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: accent.purple }]}>
              <Text style={[styles.meetingTitle, { color: colors.foreground }]}>{m.title}</Text>
              <Text style={[styles.meetingTime, { color: colors.mutedForeground }]}>
                {formatTime(m.startAt)}{m.endAt ? ` – ${formatTime(m.endAt)}` : ''}
              </Text>
              {!!m.meetLink && (
                <Text style={[styles.meetingLink, { color: colors.primary }]} numberOfLines={1}>
                  {m.meetLink}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Upcoming Reminders */}
      {!isLoading && (data?.upcomingReminders?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <SectionHeader title="UPCOMING REMINDERS" iconName="bell" color={accent.amber} />
          {data!.upcomingReminders.map(r => <ReminderRow key={r.id} reminder={r} />)}
        </View>
      )}

      {/* Pending Tasks */}
      {!isLoading && (data?.pendingTasks?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <SectionHeader title="PENDING TASKS" iconName="check-square" color={accent.emerald} />
          {data!.pendingTasks.slice(0, 4).map(t => <TaskRow key={t.id} task={t} />)}
        </View>
      )}

      {/* Recent Notes */}
      {!isLoading && (data?.recentNotes?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <SectionHeader title="RECENT NOTES" iconName="file-text" color={accent.cyan} />
          {data!.recentNotes.slice(0, 3).map(n => <NoteRow key={n.id} note={n} />)}
        </View>
      )}

      {!isLoading && !data && (
        <View style={styles.emptyState}>
          <Feather name="database" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Could not load data</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Pull down to retry</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  loader: { marginTop: 40 },

  // Hero
  heroSection: { marginBottom: 24 },
  heroTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  heroDate: { fontSize: 14, marginTop: 2 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },

  // List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  listRowContent: { flex: 1, marginRight: 8 },
  listRowTop: { flexDirection: 'row', alignItems: 'center' },
  pinnedIcon: { marginRight: 4 },
  listRowTitle: { fontSize: 14, fontWeight: '500', flex: 1 },
  listRowSubtitle: { fontSize: 12, marginTop: 2 },
  listRowMeta: { fontSize: 11 },

  // Priority
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  priorityBadge: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  // Meetings
  meetingCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 6,
    gap: 3,
  },
  meetingTitle: { fontSize: 14, fontWeight: '600' },
  meetingTime: { fontSize: 12 },
  meetingLink: { fontSize: 12, marginTop: 2 },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14 },
});
