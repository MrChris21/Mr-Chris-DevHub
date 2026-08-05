import React from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
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
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
} from '@workspace/api-client-react';
import type { Task } from '@workspace/api-client-react';
import { formatTaskShare, shareContent } from '@/lib/share';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Status = 'todo' | 'in_progress' | 'done';
type Priority = 'low' | 'medium' | 'high';

const STATUS_META: Record<
  Status,
  { label: string; color: string; iconName: keyof typeof Feather.glyphMap; gif: number }
> = {
  todo: {
    label: 'To Do',
    color: '#94a3b8',
    iconName: 'circle',
    gif: require('../../assets/images/to-do-list.gif'),
  },
  in_progress: {
    label: 'In Progress',
    color: '#f59e0b',
    iconName: 'clock',
    gif: require('../../assets/images/workspace.gif'),
  },
  done: {
    label: 'Done',
    color: '#10b981',
    iconName: 'check-circle',
    gif: require('../../assets/images/like.gif'),
  },
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: accent.rose,
  medium: accent.amber,
  low: accent.emerald,
};

function priorityColor(p: string): string {
  return PRIORITY_COLORS[p as Priority] ?? accent.emerald;
}

// ─── TaskCard ────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onToggleDone,
  onEdit,
}: {
  task: Task;
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const colors = useColors();
  const status = STATUS_META[task.status as Status] ?? STATUS_META.todo;
  const pc = priorityColor(task.priority);
  const isDone = task.status === 'done';
  const isInProgress = task.status === 'in_progress';
  const gifStyle = isInProgress ? styles.statusGifLarge : styles.statusGif;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleDone(task);
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit(task);
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.cardTop}>
        <TouchableOpacity onPress={handleToggle} hitSlop={12} style={styles.statusIconBtn}>
          <Image source={status.gif} style={gifStyle} resizeMode="contain" />
        </TouchableOpacity>
        <Text
          style={[
            styles.taskTitle,
            { color: isDone ? colors.mutedForeground : colors.foreground },
            isDone && styles.taskTitleDone,
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            shareContent(formatTaskShare(task));
          }}
          hitSlop={10}
          style={{ padding: 4, marginRight: 4 }}
        >
          <Feather name="share" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={[styles.priorityBadge, { borderColor: pc + '55', backgroundColor: pc + '18' }]}>
          <Text style={[styles.priorityText, { color: pc }]}>{task.priority}</Text>
        </View>
      </View>

      {!!task.description && !isDone && (
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {task.description}
        </Text>
      )}

      {(task.tags?.length ?? 0) > 0 && (
        <View style={styles.tags}>
          {(task.tags ?? []).slice(0, 3).map(tag => (
            <View key={tag} style={[styles.tag, { backgroundColor: accent.emerald + '1a', borderColor: accent.emerald + '44' }]}>
              <Text style={[styles.tagText, { color: accent.emerald }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeaderComp({
  title,
  count,
  color,
  gif,
}: {
  title: string;
  count: number;
  color: string;
  gif: number;
}) {
  const colors = useColors();
  return (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Image source={gif} style={styles.sectionStatusGif} resizeMode="contain" />
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.sectionCount, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="check-square" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tasks yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Tap + to add your first task
      </Text>
    </View>
  );
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────
function TaskEditorModal({
  visible,
  task,
  onClose,
}: {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const { mutate: createTask, isPending: isCreating } = useCreateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        resetAndClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to create task. Please try again.');
      },
    },
  });

  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        resetAndClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to update task. Please try again.');
      },
    },
  });

  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        resetAndClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to delete task. Please try again.');
      },
    },
  });

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<Priority>('medium');
  const [status, setStatus] = React.useState<Status>('todo');
  const [tagsRaw, setTagsRaw] = React.useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus('todo');
    setTagsRaw('');
  };

  const resetAndClose = () => {
    reset();
    onClose();
  };

  React.useEffect(() => {
    if (!visible) return;
    if (task) {
      setTitle(task.title ?? '');
      setDescription(task.description ?? '');
      setPriority((task.priority as Priority) || 'medium');
      setStatus((task.status as Status) || 'todo');
      setTagsRaw((task.tags ?? []).join(', '));
    } else {
      reset();
    }
  }, [visible, task]);

  const isPending = isCreating || isUpdating || isDeleting;

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    const tags = tagsRaw
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      tags,
    };
    if (isEdit) {
      updateTask({ id: task!.id, data });
    } else {
      createTask({ data });
    }
  };

  const handleDelete = () => {
    if (!task) return;
    Alert.alert('Delete task', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTask({ id: task.id }),
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={resetAndClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
            <Text style={[styles.sheetTitle, { color: colors.foreground, marginBottom: 0, flex: 1 }]}>
              {isEdit ? 'Edit Task' : 'New Task'}
            </Text>
            {(isEdit || title.trim()) && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  shareContent(
                    formatTaskShare({
                      title,
                      description,
                      status,
                      priority,
                      dueAt: task?.dueAt,
                      tags: tagsRaw
                        .split(',')
                        .map(t => t.trim())
                        .filter(Boolean),
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
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              autoFocus={!isEdit}
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
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={styles.segmentRow}>
              {(['low', 'medium', 'high'] as Priority[]).map(p => {
                const pc = priorityColor(p);
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.segmentBtn,
                      { borderColor: active ? pc : colors.border, backgroundColor: active ? pc + '22' : colors.background },
                    ]}
                  >
                    <Text style={[styles.segmentText, { color: active ? pc : colors.mutedForeground }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Status</Text>
            <View style={styles.segmentRow}>
              {(['todo', 'in_progress', 'done'] as Status[]).map(s => {
                const meta = STATUS_META[s];
                const active = status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatus(s)}
                    style={[
                      styles.segmentBtn,
                      { borderColor: active ? meta.color : colors.border, backgroundColor: active ? meta.color + '22' : colors.background },
                    ]}
                  >
                    <Text style={[styles.segmentText, { color: active ? meta.color : colors.mutedForeground }]}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Tags</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="work, urgent (comma-separated)"
              placeholderTextColor={colors.mutedForeground}
              value={tagsRaw}
              onChangeText={setTagsRaw}
              autoCapitalize="none"
              returnKeyType="done"
            />
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
              <TouchableOpacity onPress={resetAndClose} style={[styles.btnSecondary, { borderColor: colors.border }]}>
                <Text style={[styles.btnSecondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isPending}
              style={[styles.btnPrimary, { backgroundColor: accent.emerald, opacity: isPending ? 0.6 : 1 }]}
            >
              <Text style={styles.btnPrimaryText}>
                {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}
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
export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: tasks, isLoading, refetch, isRefetching } = useListTasks();
  const [editorTask, setEditorTask] = React.useState<Task | null | undefined>(undefined);

  const topPadding = getHeaderTopPadding(insets.top);
  const { fabBottom, listPaddingBottom } = getTabBarLayout(insets.bottom);
  const modalVisible = editorTask !== undefined;

  const { mutate: updateTask } = useUpdateTask({
    mutation: {
      onMutate: async ({ id, data }) => {
        await queryClient.cancelQueries({ queryKey: getListTasksQueryKey() });
        const prev = queryClient.getQueryData<Task[]>(getListTasksQueryKey());
        queryClient.setQueryData<Task[]>(getListTasksQueryKey(), old =>
          old?.map(t => (t.id === id ? { ...t, ...data } : t)) ?? [],
        );
        return { prev };
      },
      onError: (_err, _vars, context: { prev?: Task[] } | undefined) => {
        if (context?.prev) queryClient.setQueryData(getListTasksQueryKey(), context.prev);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
    },
  });

  const handleToggleDone = (task: Task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    updateTask({ id: task.id, data: { status: nextStatus } });
  };

  const sections = React.useMemo(() => {
    if (!tasks) return [];
    const order: Status[] = ['todo', 'in_progress', 'done'];
    return order
      .map(s => ({ key: s, data: tasks.filter(t => t.status === s) }))
      .filter(s => s.data.length > 0);
  }, [tasks]);

  const totalCount = tasks?.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPadding + 12 }]}>
        <View style={styles.headerLeft}>
          <Feather name="check-square" size={18} color={accent.emerald} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Tasks</Text>
        </View>
        {!isLoading && totalCount > 0 && (
          <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>{totalCount}</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]} />
          ))}
        </View>
      ) : sections.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onToggleDone={handleToggleDone}
              onEdit={t => setEditorTask(t)}
            />
          )}
          renderSectionHeader={({ section }) => {
            const meta = STATUS_META[section.key as Status];
            return (
              <SectionHeaderComp
                title={meta.label}
                count={section.data.length}
                color={meta.color}
                gif={meta.gif}
              />
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
          }
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setEditorTask(null);
        }}
        style={[styles.fab, { backgroundColor: accent.emerald, bottom: fabBottom }]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <TaskEditorModal
        visible={modalVisible}
        task={editorTask ?? null}
        onClose={() => setEditorTask(undefined)}
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
  headerCount: { fontSize: 14, fontWeight: '500' },

  listContent: { padding: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionCount: { fontSize: 12, fontWeight: '700' },

  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusIconBtn: { marginTop: 1 },
  statusGif: { width: 40, height: 40 },
  statusGifLarge: { width: 56, height: 56 },
  sectionStatusGif: { width: 28, height: 28 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  taskTitleDone: { textDecorationLine: 'line-through' },
  description: { fontSize: 13, lineHeight: 18, marginLeft: 28 },

  priorityBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  priorityText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 28 },
  tag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '500' },

  loadingContainer: { padding: 12, gap: 8 },
  skeleton: { height: 72, borderRadius: 12, borderWidth: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
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
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  inputMultiline: { minHeight: 80, paddingTop: 10 },

  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '600' },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cancelLink: { alignItems: 'center', marginTop: 12, paddingVertical: 4 },
  cancelLinkText: { fontSize: 14, fontWeight: '500' },
});
