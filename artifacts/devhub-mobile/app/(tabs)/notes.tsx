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
  useListNotes,
  useCreateNote,
  useUpdateNote,
  getListNotesQueryKey,
} from '@workspace/api-client-react';
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

// ─── NoteCard ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onPress }: { note: Note; onPress: (note: Note) => void }) {
  const colors = useColors();
  const preview = stripMarkdown(note.content);
  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(note); }}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Top row: title + pin + time */}
      <View style={styles.cardTop}>
        <View style={styles.titleRow}>
          {note.pinned && <Feather name="bookmark" size={13} color={accent.amber} style={styles.pinIcon} />}
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{note.title}</Text>
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(note.updatedAt)}</Text>
      </View>

      {/* Preview */}
      {!!preview && (
        <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={2}>{preview}</Text>
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
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="file-text" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notes yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Tap + to write your first note</Text>
    </View>
  );
}

// ─── Note editor modal ────────────────────────────────────────────────────────
interface NoteModalProps {
  visible: boolean;
  note: Note | null; // null = create mode
  onClose: () => void;
}

function NoteEditorModal({ visible, note, onClose }: NoteModalProps) {
  const colors = useColors();
  const queryClient = useQueryClient();

  const isEdit = !!note;

  const { mutate: createNote, isPending: isCreating } = useCreateNote({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }); onClose(); },
      onError: () => { Alert.alert('Error', 'Failed to save note. Please try again.'); },
    },
  });

  const { mutate: updateNote, isPending: isUpdating } = useUpdateNote({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() }); onClose(); },
      onError: () => { Alert.alert('Error', 'Failed to update note. Please try again.'); },
    },
  });

  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [pinned, setPinned] = React.useState(false);

  // Populate when editing
  React.useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? '');
      setContent(note?.content ?? '');
      setPinned(note?.pinned ?? false);
    }
  }, [visible, note]);

  const reset = () => { setTitle(''); setContent(''); setPinned(false); };
  const handleClose = () => { reset(); onClose(); };
  const isPending = isCreating || isUpdating;

  const handleSubmit = () => {
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a note title.'); return; }
    if (isEdit) {
      updateNote({ id: note!.id, data: { title: title.trim(), content, pinned } });
    } else {
      createNote({ data: { title: title.trim(), content, pinned } });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <View style={[styles.sheet, styles.sheetTall, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{isEdit ? 'Edit Note' : 'New Note'}</Text>
            <TouchableOpacity
              onPress={() => setPinned(p => !p)}
              style={[styles.pinBtn, { borderColor: pinned ? accent.amber : colors.border, backgroundColor: pinned ? accent.amber + '22' : 'transparent' }]}
            >
              <Feather name="bookmark" size={14} color={pinned ? accent.amber : colors.mutedForeground} />
              <Text style={[styles.pinText, { color: pinned ? accent.amber : colors.mutedForeground }]}>Pin</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <TextInput
            style={[styles.titleInput, { borderBottomColor: colors.border, color: colors.foreground }]}
            placeholder="Title"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            autoFocus={!isEdit}
            returnKeyType="next"
            maxLength={120}
          />

          {/* Content editor */}
          <TextInput
            style={[styles.contentInput, { color: colors.foreground }]}
            placeholder="Write in markdown…"
            placeholderTextColor={colors.mutedForeground}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          {/* Actions */}
          <View style={styles.sheetActions}>
            <TouchableOpacity onPress={handleClose} style={[styles.btnSecondary, { borderColor: colors.border }]}>
              <Text style={[styles.btnSecondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isPending}
              style={[styles.btnPrimary, { backgroundColor: accent.cyan, opacity: isPending ? 0.6 : 1 }]}
            >
              <Text style={styles.btnPrimaryText}>{isPending ? 'Saving…' : isEdit ? 'Update' : 'Save Note'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: notes, isLoading, refetch, isRefetching } = useListNotes();
  const [modalNote, setModalNote] = React.useState<Note | null | undefined>(undefined); // undefined = closed

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const modalVisible = modalNote !== undefined;

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalNote(null); // null = create mode
  };

  const openEdit = (note: Note) => setModalNote(note);

  const handleModalClose = () => setModalNote(undefined);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPadding + 12 }]}>
        <View style={styles.headerLeft}>
          <Feather name="file-text" size={18} color={accent.cyan} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notes</Text>
        </View>
        {!isLoading && !!notes && (
          <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>{notes.length}</Text>
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
          renderItem={({ item }) => <NoteCard note={item} onPress={openEdit} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 }]}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(notes && notes.length > 0)}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={openCreate}
        style={[styles.fab, { backgroundColor: accent.cyan, bottom: (Platform.OS === 'web' ? 24 : insets.bottom + 24) }]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <NoteEditorModal visible={modalVisible} note={modalNote ?? null} onClose={handleModalClose} />
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
  headerCount: { fontSize: 14, fontWeight: '500' },

  listContent: { padding: 12, gap: 8 },

  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
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
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
  },
  sheetTall: { maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  pinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pinText: { fontSize: 12, fontWeight: '600' },

  titleInput: {
    fontSize: 18, fontWeight: '600', paddingVertical: 10,
    borderBottomWidth: 1, marginBottom: 12,
  },
  contentInput: {
    flex: 1, fontSize: 14, lineHeight: 22, minHeight: 160,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
