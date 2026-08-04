import React from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { accent } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useListReminders,
  useCreateReminder,
  useUpdateReminder,
  getListRemindersQueryKey,
} from '@workspace/api-client-react';
import type { Reminder } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { syncReminderNotifications } from '@/lib/notifications';

function formatDue(dateStr: string): { label: string; overdue: boolean; today: boolean } {
  const date = new Date(dateStr);
  const diff = date.getTime() - Date.now();
  const overdue = diff < 0;
  if (overdue) {
    const hoursAgo = Math.abs(diff) / 3_600_000;
    const label = hoursAgo < 24 ? `Overdue ${Math.floor(hoursAgo)}h ago` : `Overdue ${Math.floor(hoursAgo / 24)}d ago`;
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

// ─── ReminderCard ─────────────────────────────────────────────────────────────
function ReminderCard({ reminder, onToggle }: { reminder: Reminder; onToggle: (reminder: Reminder) => void }) {
  const colors = useColors();
  const { label, overdue, today } = formatDue(reminder.dueAt);

  const borderAccent = reminder.done ? colors.border : overdue ? accent.rose : today ? accent.amber : colors.border;
  const dotColor = reminder.done ? accent.emerald : overdue ? accent.rose : today ? accent.amber : colors.mutedForeground;
  const dueColor = reminder.done ? accent.emerald : overdue ? accent.rose : today ? accent.amber : colors.mutedForeground;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(reminder);
  };

  return (
    <TouchableOpacity
      onPress={handleToggle}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: borderAccent, opacity: reminder.done ? 0.6 : 1 }]}
    >
      <View style={styles.cardMain}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground }, reminder.done && styles.titleDone]} numberOfLines={2}>
            {reminder.title}
          </Text>
          {!!reminder.description && (
            <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
              {reminder.description}
            </Text>
          )}
        </View>
        {/* Tap hint */}
        <Feather name={reminder.done ? 'check-circle' : 'circle'} size={18} color={dotColor} style={{ marginTop: 2 }} />
      </View>
      <View style={[styles.dueRow, { borderTopColor: colors.border }]}>
        <Feather name={reminder.done ? 'check-circle' : 'clock'} size={12} color={dueColor} />
        <Text style={[styles.dueLabel, { color: dueColor }]}>{reminder.done ? 'Completed' : label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="bell" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No reminders</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Tap + to set a reminder</Text>
    </View>
  );
}

// ─── Quick due-date helpers ───────────────────────────────────────────────────
function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function todayISO(): string {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

function nextWeekISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

const DUE_PRESETS = [
  { label: 'Today 6pm', getValue: todayISO },
  { label: 'Tomorrow 9am', getValue: tomorrowISO },
  { label: 'Next week', getValue: nextWeekISO },
] as const;

// ─── Create modal ─────────────────────────────────────────────────────────────
function CreateReminderModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { mutate: createReminder, isPending } = useCreateReminder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        onClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to create reminder. Please try again.');
      },
    },
  });

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueAt, setDueAt] = React.useState(tomorrowISO);
  const [selectedPreset, setSelectedPreset] = React.useState<number>(1); // Tomorrow

  const reset = () => {
    setTitle('');
    setDescription('');
    const tomorrow = tomorrowISO();
    setDueAt(tomorrow);
    setSelectedPreset(1);
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePreset = (idx: number) => {
    setSelectedPreset(idx);
    setDueAt(DUE_PRESETS[idx].getValue());
  };

  const handleSubmit = () => {
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a reminder title.'); return; }
    createReminder({ data: { title: title.trim(), description: description.trim() || undefined, dueAt } });
  };

  const dueDate = new Date(dueAt);
  const dueDateDisplay = dueDate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Reminder</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="What do you need to remember?"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Optional details…"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Due</Text>
            <View style={styles.presetsRow}>
              {DUE_PRESETS.map((preset, idx) => {
                const active = selectedPreset === idx;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    onPress={() => handlePreset(idx)}
                    style={[
                      styles.presetBtn,
                      { borderColor: active ? accent.amber : colors.border, backgroundColor: active ? accent.amber + '22' : colors.background },
                    ]}
                  >
                    <Text style={[styles.presetText, { color: active ? accent.amber : colors.mutedForeground }]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.duePill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="clock" size={13} color={accent.amber} />
              <Text style={[styles.duePillText, { color: colors.foreground }]}>{dueDateDisplay}</Text>
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity onPress={handleClose} style={[styles.btnSecondary, { borderColor: colors.border }]}>
              <Text style={[styles.btnSecondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isPending}
              style={[styles.btnPrimary, { backgroundColor: accent.amber, opacity: isPending ? 0.6 : 1 }]}
            >
              <Text style={styles.btnPrimaryText}>{isPending ? 'Saving…' : 'Add Reminder'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RemindersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: reminders, isLoading, refetch, isRefetching } = useListReminders();
  const [showCreate, setShowCreate] = React.useState(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  // Sync local notifications whenever the reminder list refreshes (task #8).
  React.useEffect(() => {
    if (reminders) {
      syncReminderNotifications(reminders).catch(console.warn);
    }
  }, [reminders]);

  const { mutate: updateReminder } = useUpdateReminder({
    mutation: {
      onMutate: async ({ id, data }) => {
        await queryClient.cancelQueries({ queryKey: getListRemindersQueryKey() });
        const prev = queryClient.getQueryData<Reminder[]>(getListRemindersQueryKey());
        queryClient.setQueryData<Reminder[]>(getListRemindersQueryKey(), old =>
          old?.map(r => r.id === id ? { ...r, ...data } : r) ?? []
        );
        return { prev };
      },
      onError: (_err, _vars, context: { prev?: Reminder[] } | undefined) => {
        if (context?.prev) queryClient.setQueryData(getListRemindersQueryKey(), context.prev);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
      },
    },
  });

  const handleToggle = (reminder: Reminder) => {
    updateReminder({ id: reminder.id, data: { done: !reminder.done } });
  };

  const sorted = React.useMemo(() => {
    if (!reminders) return [];
    const pending = reminders.filter(r => !r.done).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const done = reminders.filter(r => r.done).sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());
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
          renderItem={({ item }) => <ReminderCard reminder={item} onToggle={handleToggle} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 }]}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(sorted && sorted.length > 0)}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreate(true); }}
        style={[styles.fab, { backgroundColor: accent.amber, bottom: (Platform.OS === 'web' ? 24 : insets.bottom + 24) }]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <CreateReminderModal visible={showCreate} onClose={() => setShowCreate(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCount: { fontSize: 14, fontWeight: '500' },
  overdueBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  overdueText: { fontSize: 11, fontWeight: '600' },

  listContent: { padding: 12, gap: 8 },

  card: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  content: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  titleDone: { textDecorationLine: 'line-through' },
  description: { fontSize: 13, lineHeight: 18 },

  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1 },
  dueLabel: { fontSize: 12, fontWeight: '500' },

  loadingContainer: { padding: 12, gap: 8 },
  skeleton: { height: 80, borderRadius: 12, borderWidth: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

  fab: {
    position: 'absolute', right: 20, width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },

  // Modal / sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, maxHeight: '85%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },

  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  inputMultiline: { minHeight: 64, paddingTop: 10 },

  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  presetBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  presetText: { fontSize: 11, fontWeight: '600' },
  duePill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  duePillText: { fontSize: 13, fontWeight: '500' },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
