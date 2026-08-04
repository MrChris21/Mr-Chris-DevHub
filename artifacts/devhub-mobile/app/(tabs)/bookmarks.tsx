import React from 'react';
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { accent } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useListBookmarks } from '@workspace/api-client-react';
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

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const colors = useColors();
  const domain = extractDomain(bookmark.url);

  const handleOpen = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL(bookmark.url);
    } catch {
      // silent
    }
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.faviconPlaceholder, { backgroundColor: accent.blue + '22' }]}>
          <Feather name="globe" size={14} color={accent.blue} />
        </View>
        <View style={styles.titleGroup}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {bookmark.title}
          </Text>
          <Text style={[styles.domain, { color: accent.blue }]} numberOfLines={1}>
            {domain}
          </Text>
        </View>
        <Feather name="external-link" size={14} color={colors.mutedForeground} />
      </View>

      {/* Description */}
      {!!bookmark.description && (
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {bookmark.description}
        </Text>
      )}

      {/* Footer: tags + time */}
      <View style={styles.footer}>
        {bookmark.tags.length > 0 ? (
          <View style={styles.tags}>
            {bookmark.tags.slice(0, 3).map(tag => (
              <View key={tag} style={[styles.tag, { backgroundColor: accent.purple + '1a', borderColor: accent.purple + '44' }]}>
                <Text style={[styles.tagText, { color: accent.purple }]}>{tag}</Text>
              </View>
            ))}
            {bookmark.tags.length > 3 && (
              <Text style={[styles.tagMore, { color: colors.mutedForeground }]}>
                +{bookmark.tags.length - 3}
              </Text>
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

function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Feather name="bookmark" size={48} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bookmarks yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Save links and they'll appear here
      </Text>
    </View>
  );
}

export default function BookmarksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: bookmarks, isLoading, refetch, isRefetching } = useListBookmarks();

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
          scrollEnabled={!!(bookmarks && bookmarks.length > 0)}
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
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  faviconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleGroup: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  domain: { fontSize: 12, marginTop: 2 },
  description: { fontSize: 13, lineHeight: 18 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  tag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '500' },
  tagMore: { fontSize: 11, alignSelf: 'center' },
  time: { fontSize: 11, flexShrink: 0 },

  loadingContainer: { padding: 12, gap: 8 },
  skeleton: { height: 88, borderRadius: 12, borderWidth: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
