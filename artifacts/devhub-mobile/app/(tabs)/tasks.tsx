import React from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { accent } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import { useListTasks } from '@workspace/api-client-react';
import type { Task } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Status = 'todo' | 'in_progress' | 'done';

const STATUS_META: Record<Status, { label: string; color: string; iconName: keyof typeof Feather.glyphMap }> = {
  todo: { label: 'To Do', color: '#94a3b8', iconName: 'circle' },
  in_progress: { label: 'In Progress', color: '#f59e0b', iconName: 'clock' },
  done: { label: 'Done', color: '#10b981', iconName: 'check-circle' },
};

function priorityColor(p: string): string {
  if (p === 'high') return accent.rose;
  if (p === 'medium') return accent.amber;
  return accent.emerald;
}

function TaskCard({ task }: { task: Task }) {
  const colors = useColors();
  const status = STATUS_META[task.status as Status] ?? STATUS_META.todo;
  const pc = priorityColor(task.priority);
  const isDone = task.status === 'done';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <Feather name={status.iconName} size={16} color={status.color} style={styles.statusIcon} />
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
    </View>
  );
}

function SectionHeaderComp({ title, count, color }: { title: string; count: number; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.sectionCount, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="check-square" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tasks yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Your tasks will appear here
      </Text>
    </View>
  );
}

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: tasks, isLoading, refetch, isRefetching } = useListTasks();

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const sections = React.useMemo(() => {
    if (!tasks) return [];
    const order: Status[] = ['todo', 'in_progress', 'done'];
    return order
      .map(s => ({
        key: s,
        data: tasks.filter(t => t.status === s),
      }))
      .filter(s => s.data.length > 0);
  }, [tasks]);

  const totalCount = tasks?.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        { borderBottomColor: colors.border, paddingTop: topPadding + 12 },
      ]}>
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
          renderItem={({ item }) => <TaskCard task={item} />}
          renderSectionHeader={({ section }) => {
            const meta = STATUS_META[section.key as Status];
            return (
              <SectionHeaderComp
                title={meta.label}
                count={section.data.length}
                color={meta.color}
              />
            );
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          stickySectionHeadersEnabled={true}
          showsVerticalScrollIndicator={false}
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
  headerCount: { fontSize: 14, fontWeight: '500' },

  listContent: { padding: 12 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 10,
    gap: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionCount: { fontSize: 12, fontWeight: '700' },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusIcon: { marginTop: 1 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  taskTitleDone: { textDecorationLine: 'line-through' },
  description: { fontSize: 13, lineHeight: 18, marginLeft: 26 },

  priorityBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  priorityText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 26 },
  tag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '500' },

  loadingContainer: { padding: 12, gap: 8 },
  skeleton: { height: 72, borderRadius: 12, borderWidth: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
