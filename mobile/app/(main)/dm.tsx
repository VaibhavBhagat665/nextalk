import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { fetchApi } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Avatar } from '../../components/ui/Avatar';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { radius } from '../../lib/theme';
import { MessageSquare } from 'lucide-react-native';
import { format, isToday, isYesterday } from 'date-fns';

type DMChannel = {
  id: string;
  user: { id: string; username: string; imageUrl?: string; isOnline: boolean };
  lastMessage?: { content: string; createdAt: string };
  unreadCount?: number;
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function DMScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const colors = useAppStore((s) => s.colors);
  const [dms, setDms] = useState<DMChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDMs = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchApi('/api/channels/dm', { headers: { Authorization: `Bearer ${token}` } });
      setDms(data.dms || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadDMs(); }, []);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accentGold} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <FlatList
        data={dms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDMs(); }} tintColor={colors.accentGold} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(80 + index * 50).springify()}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/(main)/chat/${item.id}`); }}
              style={[styles.dmRow, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}
            >
              <Avatar src={item.user.imageUrl} fallback={item.user.username} status={item.user.isOnline ? 'online' : 'offline'} size={50} />
              <View style={styles.dmInfo}>
                <View style={styles.topRow}>
                  <Text style={[styles.name, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]} numberOfLines={1}>{item.user.username}</Text>
                  {item.lastMessage && <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(item.lastMessage.createdAt)}</Text>}
                </View>
                <View style={styles.bottomRow}>
                  <Text style={[styles.preview, { color: colors.textTertiary }]} numberOfLines={1}>{item.lastMessage?.content || 'No messages yet'}</Text>
                  {item.unreadCount ? <Badge count={item.unreadCount} variant="unread" /> : null}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
        ListEmptyComponent={
          <GlassCard variant="gradient" style={styles.empty}>
            <MessageSquare size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-SemiBold' }]}>No Messages</Text>
            <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>Start a conversation with someone.</Text>
          </GlassCard>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  dmRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10 },
  dmInfo: { flex: 1, marginLeft: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, flex: 1, marginRight: 8 },
  time: { fontSize: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  preview: { fontSize: 14, flex: 1, marginRight: 8 },
  empty: { alignItems: 'center', padding: 40, marginTop: 40, gap: 12 },
  emptyTitle: { fontSize: 20 },
  emptyDesc: { fontSize: 15, textAlign: 'center' },
});
