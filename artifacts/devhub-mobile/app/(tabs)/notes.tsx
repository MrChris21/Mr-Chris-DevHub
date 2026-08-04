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
import { useListNotes } from '@workspace/api-client-react';
import type { Note } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

function NoteCard({ note }: { note: Note }) {
  const colors = useColors();
  const preview = stripMarkdown(note.content);
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top row: title + pin + time */}
      <View style={styles.cardTop}>
        <View style={styles.titleRow}>
          {note.pinned && (
            <Feather name="bookmark" size={13} color={accent.amber} style={styles.pinIcon} />
          )}
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {note.title}
          </Text>
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(note.updatedAt)}</Text>
      </View>

      {/* Preview */}
      {!!preview && (
        <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={2}>
          {preview}
        </Text>
      )}

      {/* Tags */}
      {note.tags.length > 0 && (
        <View style={styles.tags}>
          {note.tags.slice(0, 4).map(tag => (
            <View key={tag} style={[styles.tag, { backgroundColor: accent.cyan + '22', borderColor: accent.cyan + '44' }]}>
              <Text style={[styles.tagText, { color: accent.cyan }]}>{tag}</Text>
            </View>
          ))}
          {note.tags.length > 4 && (
            <Text style={[styles.tagMore, { color: colors.mutedForeground }]}>+{note.tags.length - 4}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="file-text" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notes yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Notes you create will appear here
      </Text>
    </View>
  );
}

export default function NotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: notes, isLoading, refetch, isRefetching } = useListNotes();

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        { borderBottomColor: colors.border, paddingTop: topPadding + 12 },
      ]}>
        <View style={styles.headerLeft}>
          <Feather name="file-text" size={18} color={accent.cyan} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notes</Text>
        </View>
        {!isLoading && !!notes && (
          <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>
            {notes.length}
          </Text>
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
          data={notes ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <NoteCard note={item} />}
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
          scrollEnabled={!!(notes && notes.length > 0)}
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

  listContent: { padding: 12, gap: 8 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pinIcon: { marginRight: 5 },
  title: { fontSize: 15, fontWeight: '600', flex: 1 },
  time: { fontSize: 11, marginTop: 2 },
  preview: { fontSize: 13, lineHeight: 18 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '500' },
  tagMore: { fontSize: 11, alignSelf: 'center' },

  loadingContainer: { padding: 12, gap: 8 },
  skeleton: { height: 90, borderRadius: 12, borderWidth: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
