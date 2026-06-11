import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Avatar } from '../../components/ui/Avatar';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { fetchApi } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { spacing, radius } from '../../lib/theme';
import { Plus, ChevronRight, Hash, Users, Crown, Link2 } from 'lucide-react-native';
import CreateServerModal from '../../components/modals/CreateServerModal';

type Server = {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  _count?: { members: number; channels: number };
};

export default function ServersScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const colors = useAppStore((s) => s.colors);
  const setActiveServerId = useAppStore((s) => s.setActiveServerId);

  const loadServers = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchApi('/api/servers', { headers: { Authorization: `Bearer ${token}` } });
      setServers(data.servers || []);
    } catch (err) {
      console.error('Failed to load servers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => { loadServers(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadServers();
  };

  const onServerPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveServerId(id);
    router.push(`/(main)/channels/${id}`);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accentGold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <FlatList
        data={servers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentGold}
            colors={[colors.accentGold]}
          />
        }
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <GlassCard variant="gold" style={styles.statCard}>
                <Users size={20} color={colors.accentGold} />
                <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                  {servers.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                  Servers
                </Text>
              </GlassCard>
              <GlassCard variant="gold" style={styles.statCard}>
                <Hash size={20} color={colors.accentCyan} />
                <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                  {servers.reduce((a, s) => a + (s._count?.channels || 0), 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                  Channels
                </Text>
              </GlassCard>
              <GlassCard variant="gold" style={styles.statCard}>
                <Crown size={20} color={colors.accentAmber} />
                <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                  {servers.reduce((a, s) => a + (s._count?.members || 0), 0)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                  Members
                </Text>
              </GlassCard>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: 'Fredoka-Medium' }]}>
                YOUR SERVERS
              </Text>
            </View>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(200 + index * 60).springify()}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onServerPress(item.id)}
              style={[styles.serverCard, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}
            >
              {/* Server Icon */}
              <View style={[styles.serverIconWrap, { backgroundColor: colors.accentGoldDim }]}>
                {item.icon ? (
                  <Text style={styles.serverEmoji}>{item.icon}</Text>
                ) : (
                  <Text style={[styles.serverLetter, { color: colors.accentGold, fontFamily: 'Fredoka-Bold' }]}>
                    {item.name[0].toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.serverInfo}>
                <Text style={[styles.serverName, { color: colors.textPrimary, fontFamily: 'Fredoka-SemiBold' }]}>
                  {item.name}
                </Text>
                <View style={styles.serverMeta}>
                  {item._count && (
                    <>
                      <View style={styles.metaItem}>
                        <Users size={12} color={colors.textMuted} />
                        <Text style={[styles.metaText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
                          {item._count.members}
                        </Text>
                      </View>
                      <View style={[styles.metaDot, { backgroundColor: colors.borderPrimary }]} />
                      <View style={styles.metaItem}>
                        <Hash size={12} color={colors.textMuted} />
                        <Text style={[styles.metaText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
                          {item._count.channels}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}
        ListEmptyComponent={
          <GlassCard variant="gradient" style={styles.emptyCard}>
            <Users size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-SemiBold' }]}>
              No Servers Yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
              Create a server or join one with an invite code to get started.
            </Text>
            <Button
              title="Add a Server"
              icon={<Plus size={16} color="#F2EDE7" />}
              onPress={() => setShowCreateModal(true)}
              size="lg"
              style={{ marginTop: 12 }}
            />
          </GlassCard>
        }
      />

      {/* FAB — Floating Action Button */}
      {servers.length > 0 && (
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.fabWrap}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCreateModal(true); }}
            style={{ borderRadius: 28, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={[colors.accentGold, colors.accentBrass]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fab}
            >
              <Plus size={24} color="#F2EDE7" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Create/Join Server Modal */}
      <CreateServerModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadServers}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    gap: 4,
  },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 11 },
  sectionHeader: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 12,
  },
  serverIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  serverEmoji: { fontSize: 24 },
  serverLetter: { fontSize: 20 },
  serverInfo: { flex: 1, marginLeft: 14 },
  serverName: { fontSize: 17, marginBottom: 4 },
  serverMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13 },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  emptyCard: { alignItems: 'center', padding: 40, marginTop: 40, gap: 12 },
  emptyTitle: { fontSize: 20 },
  emptyDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // FAB
  fabWrap: {
    position: 'absolute', bottom: 24, right: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
});
