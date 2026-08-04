import React from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { accent } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import { useListReminders } from '@workspace/api-client-react';
import type { Reminder } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { syncReminderNotifications } from '@/lib/notifications';

function formatDue(dateStr: string): { label: string; overdue: boolean; today: boolean } {
  const date = new Date(dateStr);
  const diff = date.getTime() - Date.now();
  const overdue = diff < 0;
  if (overdue) {
    const hoursAgo = Math.abs(diff) / 3_600_000;
    const label = hoursAgo < 24
      ? `Overdue ${Math.floor(hoursAgo)}h ago`
      : `Overdue ${Math.floor(hoursAgo / 24)}d ago`;
    return { label, overdue: true, today: false };
  }
  const h = diff / 3_600_000;
  if (h < 1) return { label: 'Due in < 1h', overdue: false, today: true };
  if (h < 24) {
    const today = new Date().toDateString() === date.toDateString();
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { label: today ? `Today ${timeStr}` : `${Math.floor(h)}h`, overdue: false, today };
  }
  const d = Math.floor(h / 24);
  if (d === 1) {
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { label: `Tomorrow ${timeStr}`, overdue: false, today: false };
  }
  return {
    label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    overdue: false,
    today: false,
  };
}

function ReminderCard({ reminder }: { reminder: Reminder }) {
  const colors = useColors();
  const { label, overdue, today } = formatDue(reminder.dueAt);

  const borderAccent = reminder.done
    ? colors.border
    : overdue
    ? accent.rose
    : today
    ? accent.amber
    : colors.border;

  const dotColor = reminder.done
    ? accent.emerald
    : overdue
    ? accent.rose
    : today
    ? accent.amber
    : colors.mutedForeground;

  const dueColor = reminder.done
    ? accent.emerald
    : overdue
    ? accent.rose
    : today
    ? accent.amber
    : colors.mutedForeground;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: borderAccent,
          opacity: reminder.done ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.cardMain}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              { color: colors.foreground },
              reminder.done && styles.titleDone,
            ]}
            numberOfLines={2}
          >
            {reminder.title}
          </Text>
          {!!reminder.description && (
            <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
              {reminder.description}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.dueRow, { borderTopColor: colors.border }]}>
        <Feather
          name={reminder.done ? 'check-circle' : 'clock'}
          size={12}
          color={dueColor}
        />
        <Text style={[styles.dueLabel, { color: dueColor }]}>
          {reminder.done ? 'Completed' : label}
        </Text>
      </View>
    </View>
  );
}

function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="bell" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No reminders</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Reminders you create will appear here
      </Text>
    </View>
  );
}

export default function RemindersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: reminders, isLoading, refetch, isRefetching } = useListReminders();

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  // Sync local notifications whenever the reminder list refreshes.
  React.useEffect(() => {
    if (reminders) {
      syncReminderNotifications(reminders).catch(console.warn);
    }
  }, [reminders]);

  // Sort: pending first (by dueAt asc), then done
  const sorted = React.useMemo(() => {
    if (!reminders) return [];
    const pending = reminders.filter(r => !r.done).sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );
    const done = reminders.filter(r => r.done).sort(
      (a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()
    );
    return [...pending, ...done];
  }, [reminders]);

  const pendingCount = sorted.filter(r => !r.done).length;
  const overdueCount = sorted.filter(r => !r.done && new Date(r.dueAt).getTime() < Date.now()).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPadding + 12 }]}>
        <View style={styles.headerLeft}>
          <Feather name="bell" size={18} color={accent.amber} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reminders</Text>
        </View>
        {!isLoading && pendingCount > 0 && (
          <View style={styles.headerMeta}>
            {overdueCount > 0 && (
              <View style={[styles.overdueBadge, { backgroundColor: accent.rose + '22' }]}>
                <Text style={[styles.overdueText, { color: accent.rose }]}>{overdueCount} overdue</Text>
              </View>
            )}
            <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]} />
          ))}
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <ReminderCard reminder={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 },
          ]}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(sorted && sorted.length > 0)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCount: { fontSize: 14, fontWeight: '500' },
  overdueBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  overdueText: { fontSize: 11, fontWeight: '600' },

  listContent: { padding: 12, gap: 8 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  content: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  titleDone: { textDecorationLine: 'line-through' },
  description: { fontSize: 13, lineHeight: 18 },

  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  dueLabel: { fontSize: 12, fontWeight: '500' },

  loadingContainer: { padding: 12, gap: 8 },
  skeleton: { height: 80, borderRadius: 12, borderWidth: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
