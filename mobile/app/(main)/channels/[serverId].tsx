import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { fetchApi } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { GlassCard } from '../../../components/ui/GlassCard';
import OnlineUsersList from '../../../components/OnlineUsersList';
import CreateChannelModal from '../../../components/modals/CreateChannelModal';
import { radius } from '../../../lib/theme';
import {
  Hash, Volume2, ChevronRight, Lock, Search, Plus, Copy, Check,
} from 'lucide-react-native';

type Channel = { id: string; name: string; type: 'text' | 'voice'; isPrivate: boolean };

export default function ChannelsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const colors = useAppStore((s) => s.colors);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('Server');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadChannels = async () => {
    if (!serverId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchApi(`/api/servers/${serverId}`, { headers: { Authorization: `Bearer ${token}` } });
      // API returns server object at root level with channels nested
      setChannels(data.channels || []);
      setServerName(data.name || 'Server');
      setInviteCode(data.inviteCode || null);
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadChannels(); }, [serverId]);

  const filtered = useMemo(() =>
    channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [channels, searchQuery]
  );
  const textChannels = filtered.filter((c) => c.type === 'text');
  const voiceChannels = filtered.filter((c) => c.type === 'voice');

  const onChannelPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(main)/chat/${id}`);
  };

  const copyInvite = async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to copy invite code');
    }
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accentGold} /></View>;
  }

  const renderChannel = (item: Channel, index: number) => (
    <Animated.View key={item.id} entering={FadeInDown.delay(100 + index * 50).springify()}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onChannelPress(item.id)}
        style={[styles.channelRow, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}
      >
        <View style={[
          styles.channelIcon,
          { backgroundColor: item.type === 'text' ? colors.accentGoldDim : `${colors.accentCyan}15` },
        ]}>
          {item.type === 'text' ? <Hash size={16} color={colors.accentGold} /> : <Volume2 size={16} color={colors.accentCyan} />}
        </View>
        <Text style={[styles.channelName, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>{item.name}</Text>
        {item.isPrivate && <Lock size={14} color={colors.textMuted} style={{ marginRight: 6 }} />}
        <ChevronRight size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadChannels(); }} tintColor={colors.accentGold} />}
        renderItem={() => (
          <View style={styles.content}>
            <Animated.View entering={FadeInDown.delay(50).springify()}>
              <GlassCard variant="gold" style={styles.headerCard}>
                <Text style={[styles.serverTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>{serverName}</Text>
                <Text style={[styles.serverSub, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                  {channels.length} channel{channels.length !== 1 ? 's' : ''}
                </Text>
                {inviteCode && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={copyInvite}
                    style={[styles.inviteBtn, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}
                  >
                    {copied ? <Check size={14} color={colors.accentEmerald} /> : <Copy size={14} color={colors.textMuted} />}
                    <Text style={[styles.inviteText, { color: copied ? colors.accentEmerald : colors.textSecondary, fontFamily: 'ComicNeue-Bold' }]}>
                      {copied ? 'Copied!' : 'Copy Invite Code'}
                    </Text>
                  </TouchableOpacity>
                )}
              </GlassCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <View style={[styles.searchWrap, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}>
                <Search size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}
                  placeholder="Search channels..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </Animated.View>

            {textChannels.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Hash size={12} color={colors.textMuted} />
                  <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>TEXT CHANNELS</Text>
                  <Text style={[styles.sectionCount, { color: colors.textMuted, backgroundColor: colors.bgTertiary }]}>{textChannels.length}</Text>
                </View>
                {textChannels.map((c, i) => renderChannel(c, i))}
              </>
            )}

            {voiceChannels.length > 0 && (
              <>
                <View style={[styles.sectionRow, { marginTop: 24 }]}>
                  <Volume2 size={12} color={colors.textMuted} />
                  <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>VOICE CHANNELS</Text>
                  <Text style={[styles.sectionCount, { color: colors.textMuted, backgroundColor: colors.bgTertiary }]}>{voiceChannels.length}</Text>
                </View>
                {voiceChannels.map((c, i) => renderChannel(c, i + textChannels.length))}
              </>
            )}

            {channels.length === 0 && (
              <GlassCard variant="gradient" style={styles.emptyCard}>
                <Hash size={40} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                  No channels in this server yet.
                </Text>
              </GlassCard>
            )}

            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateChannel(true); }}
                style={[styles.createBtn, { borderColor: colors.borderPrimary }]}
              >
                <Plus size={16} color={colors.textMuted} />
                <Text style={[styles.createBtnText, { color: colors.textMuted, fontFamily: 'ComicNeue-Bold' }]}>Create Channel</Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={[styles.onlineSection, { borderTopColor: colors.borderSecondary }]}>
              <OnlineUsersList maxHeight={180} />
            </View>
          </View>
        )}
      />
      <CreateChannelModal
        visible={showCreateChannel}
        serverId={serverId || ''}
        onClose={() => setShowCreateChannel(false)}
        onCreated={loadChannels}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  headerCard: { padding: 20, marginBottom: 16, alignItems: 'center' },
  serverTitle: { fontSize: 24, letterSpacing: -0.5 },
  serverSub: { fontSize: 14, marginTop: 4 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1,
  },
  inviteText: { fontSize: 14 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5,
    marginBottom: 20,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10, marginLeft: 4,
  },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', flex: 1 },
  sectionCount: {
    fontSize: 10, fontWeight: '700',
    paddingVertical: 1, paddingHorizontal: 8, borderRadius: 999,
  },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: radius.md, borderWidth: 1, marginBottom: 8,
  },
  channelIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  channelName: { flex: 1, fontSize: 16 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, marginTop: 16,
    borderRadius: 14, borderWidth: 2, borderStyle: 'dashed',
  },
  createBtnText: { fontSize: 14 },
  onlineSection: { marginTop: 28, paddingTop: 20, borderTopWidth: 1 },
  emptyCard: { alignItems: 'center', padding: 40, marginTop: 24, gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
