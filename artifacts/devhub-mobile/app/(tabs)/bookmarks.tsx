import React from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
  useListBookmarks,
  useCreateBookmark,
  getListBookmarksQueryKey,
} from '@workspace/api-client-react';
import type { Bookmark } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── BookmarkCard ─────────────────────────────────────────────────────────────
function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const colors = useColors();
  const domain = extractDomain(bookmark.url);

  const handleOpen = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await Linking.openURL(bookmark.url); } catch { /* silent */ }
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.faviconPlaceholder, { backgroundColor: accent.blue + '22' }]}>
          <Feather name="globe" size={14} color={accent.blue} />
        </View>
        <View style={styles.titleGroup}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{bookmark.title}</Text>
          <Text style={[styles.domain, { color: accent.blue }]} numberOfLines={1}>{domain}</Text>
        </View>
        <Feather name="external-link" size={14} color={colors.mutedForeground} />
      </View>

      {/* Description */}
      {!!bookmark.description && (
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>{bookmark.description}</Text>
      )}

      {/* Footer: tags + time */}
      <View style={styles.footer}>
        {bookmark.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {bookmark.tags.slice(0, 3).map(tag => (
              <View key={tag} style={[styles.tag, { backgroundColor: accent.purple + '1a', borderColor: accent.purple + '44' }]}>
                <Text style={[styles.tagText, { color: accent.purple }]}>{tag}</Text>
              </View>
            ))}
            {bookmark.tags.length > 3 && (
              <Text style={[styles.tagMore, { color: colors.mutedForeground }]}>+{bookmark.tags.length - 3}</Text>
            )}
          </View>
        ) : (
          <View />
        )}
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(bookmark.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="bookmark" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bookmarks yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Tap + to save a link</Text>
    </View>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────
function CreateBookmarkModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { mutate: createBookmark, isPending } = useCreateBookmark({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBookmarksQueryKey() });
        onClose();
      },
      onError: () => {
        Alert.alert('Error', 'Failed to save bookmark. Please try again.');
      },
    },
  });

  const [url, setUrl] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [tagsRaw, setTagsRaw] = React.useState('');

  const reset = () => { setUrl(''); setTitle(''); setDescription(''); setTagsRaw(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = () => {
    const trimmedUrl = url.trim();
    const trimmedTitle = title.trim();

    if (!trimmedUrl) { Alert.alert('URL required', 'Please enter a URL.'); return; }
    if (!trimmedTitle) { Alert.alert('Title required', 'Please enter a title for this bookmark.'); return; }

    // Basic URL validation
    try { new URL(trimmedUrl); } catch {
      Alert.alert('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
      return;
    }

    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    createBookmark({ data: { url: trimmedUrl, title: trimmedTitle, description: description.trim() || undefined, tags } });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Save Bookmark</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* URL */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>URL *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="https://example.com"
              placeholderTextColor={colors.mutedForeground}
              value={url}
              onChangeText={setUrl}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />

            {/* Title */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Page or resource title"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />

            {/* Description */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Why are you saving this? (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              returnKeyType="next"
            />

            {/* Tags */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Tags</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="react, tools, reference (comma-separated)"
              placeholderTextColor={colors.mutedForeground}
              value={tagsRaw}
              onChangeText={setTagsRaw}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity onPress={handleClose} style={[styles.btnSecondary, { borderColor: colors.border }]}>
              <Text style={[styles.btnSecondaryText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isPending}
              style={[styles.btnPrimary, { backgroundColor: accent.purple, opacity: isPending ? 0.6 : 1 }]}
            >
              <Text style={styles.btnPrimaryText}>{isPending ? 'Saving…' : 'Save Bookmark'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookmarksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: bookmarks, isLoading, refetch, isRefetching } = useListBookmarks();
  const [showCreate, setShowCreate] = React.useState(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPadding + 12 }]}>
        <View style={styles.headerLeft}>
          <Feather name="bookmark" size={18} color={accent.purple} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Bookmarks</Text>
        </View>
        {!isLoading && !!bookmarks && (
          <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>{bookmarks.length}</Text>
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
          data={bookmarks ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <BookmarkCard bookmark={item} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 80 }]}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(bookmarks && bookmarks.length > 0)}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreate(true); }}
        style={[styles.fab, { backgroundColor: accent.purple, bottom: (Platform.OS === 'web' ? 24 : insets.bottom + 24) }]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <CreateBookmarkModal visible={showCreate} onClose={() => setShowCreate(false)} />
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

  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  faviconPlaceholder: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleGroup: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  domain: { fontSize: 12, marginTop: 2 },
  description: { fontSize: 13, lineHeight: 18 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '500' },
  tagMore: { fontSize: 11, alignSelf: 'center' },
  time: { fontSize: 11, flexShrink: 0 },

  loadingContainer: { padding: 12, gap: 8 },
  skeleton: { height: 88, borderRadius: 12, borderWidth: 1 },

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

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnSecondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  btnPrimary: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
