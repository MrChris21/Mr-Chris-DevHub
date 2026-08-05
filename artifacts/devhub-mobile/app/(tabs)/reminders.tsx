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
import { getHeaderTopPadding, getTabBarLayout } from '@/constants/layout';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useListReminders,
  useCreateReminder,
  useUpdateReminder,
  useDeleteReminder,
  getListRemindersQueryKey,
} from '@workspace/api-client-react';
import type { Reminder } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { syncReminderNotifications } from '@/lib/notifications';
import { formatReminderShare, shareContent } from '@/lib/share';

function formatDue(dateStr: string): { label: string; overdue: boolean; today: boolean } {
  const date = new Date(dateStr);
  const diff = date.getTime() - Date.now();
  const overdue = diff < 0;
  if (overdue) {
    const hoursAgo = Math.abs(diff) / 3_600_000;
    const label =
      hoursAgo < 24
        ? `Overdue ${Math.floor(hoursAgo)}h ago`
        : `Overdue ${Math.floor(hoursAgo / 24)}d ago`;
    return { label, overdue: true, today: false };
  }
  const h = diff / 3_600_000;
  if (h < 1) return { label: 'Due in < 1h', overdue: false, today: true };
  if (h < 24) {
    const today = new Date().toDateString() === date.toDateString();
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return { label: today ? `Today ${timeStr}` : `${Math.floor(h)}h`, overdue: false, today };
  }
  const d = Math.floor(h / 24);
  if (d === 1) {
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return { label: `Tomorrow ${timeStr}`, overdue: false, today: false };
  }
  return {
    label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    overdue: false,
    today: false,
  };
}

// ─── ReminderCard ─────────────────────────────────────────────────────────────
function ReminderCard({
  reminder,
  onToggle,
  onEdit,
}: {
  reminder: Reminder;
  onToggle: (reminder: Reminder) => void;
  onEdit: (reminder: Reminder) => void;
}) {
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

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(reminder);
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit(reminder);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: borderAccent,
          opacity: reminder.done ? 0.6 : pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.cardMain}>
        <TouchableOpacity onPress={handleToggle} hitSlop={10}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        </TouchableOpacity>
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
        <TouchableOpacity onPress={handleToggle} hitSlop={10}>
          <Feather
            name={reminder.done ? 'check-circle' : 'circle'}
            size={18}
            color={dotColor}
            style={{ marginTop: 2 }}
          />
        </TouchableOpacity>
      </View>
      <View style={[styles.dueRow, { borderTopColor: colors.border }]}>
        <Feather name={reminder.done ? 'check-circle' : 'clock'} size={12} color={dueColor} />
        <Text style={[styles.dueLabel, { color: dueColor }]}>
          {reminder.done ? 'Completed' : label}
        </Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            shareContent(formatReminderShare(reminder));
          }}
          hitSlop={10}
          style={{ marginLeft: 'auto', padding: 2 }}
        >
          <Feather name="share" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Feather name="edit-2" size={12} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="bell" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No reminders</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Tap + to set a reminder
      </Text>
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

// ─── Create / Edit modal ──────────────────────────────────────────────────────
function ReminderEditorModal({
  visible,
  reminder,
  onClose,
}: {
  visible: boolean;
  reminder: Reminder | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const isEdit = !!reminder;

  const { mutate: createReminder, isPending: isCreating } = useCreateReminder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        resetAndClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to create reminder. Please try again.');
      },
    },
  });

  const { mutate: updateReminder, isPending: isUpdating } = useUpdateReminder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        resetAndClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to update reminder. Please try again.');
      },
    },
  });

  const { mutate: deleteReminder, isPending: isDeleting } = useDeleteReminder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
        resetAndClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to delete reminder. Please try again.');
      },
    },
  });

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueAt, setDueAt] = React.useState(tomorrowISO);
  const [selectedPreset, setSelectedPreset] = React.useState<number | null>(1);
  const [done, setDone] = React.useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
    setDueAt(tomorrowISO());
    setSelectedPreset(1);
    setDone(false);
  };

  const resetAndClose = () => {
    reset();
    onClose();
  };

  React.useEffect(() => {
    if (!visible) return;
    if (reminder) {
      setTitle(reminder.title ?? '');
      setDescription(reminder.description ?? '');
      setDueAt(reminder.dueAt);
      setDone(!!reminder.done);
      setSelectedPreset(null);
    } else {
      reset();
    }
  }, [visible, reminder]);

  const isPending = isCreating || isUpdating || isDeleting;

  const handlePreset = (idx: number) => {
    setSelectedPreset(idx);
    setDueAt(DUE_PRESETS[idx].getValue());
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a reminder title.');
      return;
    }
    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      Alert.alert('Invalid date', 'Please pick a valid due time.');
      return;
    }
    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt,
      ...(isEdit ? { done } : {}),
    };
    if (isEdit) {
      updateReminder({ id: reminder!.id, data });
    } else {
      createReminder({ data });
    }
  };

  const handleDelete = () => {
    if (!reminder) return;
    Alert.alert('Delete reminder', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteReminder({ id: reminder.id }),
      },
    ]);
  };

  const dueDate = new Date(dueAt);
  const dueDateDisplay = Number.isNaN(dueDate.getTime())
    ? 'Invalid date'
    : dueDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={resetAndClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
            <Text style={[styles.sheetTitle, { color: colors.foreground, marginBottom: 0, flex: 1 }]}>
              {isEdit ? 'Edit Reminder' : 'New Reminder'}
            </Text>
            {(isEdit || title.trim()) && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  shareContent(
                    formatReminderShare({
                      title,
                      description,
                      dueAt,
                      done,
                    }),
                  );
                }}
                hitSlop={8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Feather name="share" size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mutedForeground }}>Share</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="What do you need to remember?"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              autoFocus={!isEdit}
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputMultiline,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
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
                      {
                        borderColor: active ? accent.amber : colors.border,
                        backgroundColor: active ? accent.amber + '22' : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        { color: active ? accent.amber : colors.mutedForeground },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View
              style={[
                styles.duePill,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Feather name="clock" size={13} color={accent.amber} />
              <Text style={[styles.duePillText, { color: colors.foreground }]}>{dueDateDisplay}</Text>
            </View>

            {isEdit && (
              <TouchableOpacity
                onPress={() => setDone(d => !d)}
                style={[
                  styles.doneToggle,
                  {
                    borderColor: done ? accent.emerald : colors.border,
                    backgroundColor: done ? accent.emerald + '18' : colors.background,
                  },
                ]}
              >
                <Feather
                  name={done ? 'check-circle' : 'circle'}
                  size={16}
                  color={done ? accent.emerald : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.doneToggleText,
                    { color: done ? accent.emerald : colors.mutedForeground },
                  ]}
                >
                  Mark as completed
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.sheetActions}>
            {isEdit ? (
              <TouchableOpacity
                onPress={handleDelete}
                disabled={isPending}
                style={[styles.btnSecondary, { borderColor: accent.rose + '66' }]}
              >
                <Text style={[styles.btnSecondaryText, { color: accent.rose }]}>Delete</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={resetAndClose}
                style={[styles.btnSecondary, { borderColor: colors.border }]}
              >
                <Text style={[styles.btnSecondaryText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isPending}
              style={[
                styles.btnPrimary,
                { backgroundColor: accent.amber, opacity: isPending ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.btnPrimaryText}>
                {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Reminder'}
              </Text>
            </TouchableOpacity>
          </View>
          {isEdit && (
            <TouchableOpacity onPress={resetAndClose} style={styles.cancelLink}>
              <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          )}
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
  const [editorReminder, setEditorReminder] = React.useState<Reminder | null | undefined>(undefined);

  const topPadding = getHeaderTopPadding(insets.top);
  const { fabBottom, listPaddingBottom } = getTabBarLayout(insets.bottom);
  const modalVisible = editorReminder !== undefined;

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
          old?.map(r => (r.id === id ? { ...r, ...data } : r)) ?? [],
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
    const pending = reminders
      .filter(r => !r.done)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const done = reminders
      .filter(r => r.done)
      .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());
    return [...pending, ...done];
  }, [reminders]);

  const pendingCount = sorted.filter(r => !r.done).length;
  const overdueCount = sorted.filter(
    r => !r.done && new Date(r.dueAt).getTime() < Date.now(),
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPadding + 12 }]}>
        <View style={styles.headerLeft}>
          <Feather name="bell" size={18} color={accent.amber} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reminders</Text>
        </View>
        {!isLoading && pendingCount > 0 && (
          <View style={styles.headerMeta}>
            {overdueCount > 0 && (
              <View style={[styles.overdueBadge, { backgroundColor: accent.rose + '22' }]}>
                <Text style={[styles.overdueText, { color: accent.rose }]}>
                  {overdueCount} overdue
                </Text>
              </View>
            )}
            <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>
              {pendingCount}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[styles.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]}
            />
          ))}
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onToggle={handleToggle}
              onEdit={r => setEditorReminder(r)}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
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

      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setEditorReminder(null);
        }}
        style={[styles.fab, { backgroundColor: accent.amber, bottom: fabBottom }]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <ReminderEditorModal
        visible={modalVisible}
        reminder={editorReminder ?? null}
        onClose={() => setEditorReminder(undefined)}
      />
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

  card: { borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
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

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

  fab: {
    position: 'absolute',
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '88%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 64, paddingTop: 10 },

  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  presetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetText: { fontSize: 11, fontWeight: '600' },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  duePillText: { fontSize: 13, fontWeight: '500' },

  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  doneToggleText: { fontSize: 14, fontWeight: '600' },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cancelLink: { alignItems: 'center', marginTop: 12, paddingVertical: 4 },
  cancelLinkText: { fontSize: 14, fontWeight: '500' },
});
