import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { fetchApi } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { Avatar } from '../../../components/ui/Avatar';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';
import { radius } from '../../../lib/theme';
import {
  User as UserIcon, Users, Sparkles, Mail, Shield, Crown,
  CheckCircle, ListChecks, MessageCircle, RefreshCw, Brain,
} from 'lucide-react-native';

type Member = {
  id: string;
  username: string;
  imageUrl: string | null;
  role: string;
};

type ChannelInfo = {
  id: string;
  name: string;
  description: string | null;
  members: Member[];
  messageCount: number;
};

export default function ChannelInfoScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const colors = useAppStore((s) => s.colors);

  const [activeTab, setActiveTab] = useState<'profile' | 'members' | 'ai'>('profile');
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // AI state
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token || !channelId) return;
        const data = await fetchApi(`/api/channels/${channelId}/info`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setChannelInfo(data);
      } catch (err) {
        console.error('Failed to load channel info:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [channelId]);

  const generateSummary = async () => {
    if (!channelId) return;
    setAiLoading(true);
    try {
      const token = await getToken();
      const data = await fetchApi('/api/ai/summary', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, forceRefresh: true }),
      });
      setAiSummary(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setAiSummary({ summary: 'Failed to generate summary. Try again.' });
    } finally {
      setAiLoading(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: UserIcon },
    { id: 'members' as const, label: 'Members', icon: Users },
    { id: 'ai' as const, label: 'AI', icon: Sparkles },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accentGold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.borderPrimary }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.7}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.id); }}
            style={[
              styles.tab,
              activeTab === tab.id && { backgroundColor: colors.bgElevated },
            ]}
          >
            <tab.icon
              size={16}
              color={activeTab === tab.id ? colors.accentGold : colors.textMuted}
            />
            <Text style={[
              styles.tabLabel,
              { color: activeTab === tab.id ? colors.textPrimary : colors.textMuted, fontFamily: 'Fredoka-Medium' },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Profile Tab ── */}
        {activeTab === 'profile' && (
          <Animated.View entering={FadeIn.duration(200)}>
            <GlassCard variant="gradient" glowBorder style={styles.profileCard}>
              <Avatar src={user?.imageUrl} fallback={user?.username || 'U'} size={72} borderGlow />
              <Text style={[styles.profileName, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={[styles.profileHandle, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                @{user?.username}
              </Text>

              <View style={styles.profileDetails}>
                <View style={[styles.detailRow, { backgroundColor: colors.bgTertiary }]}>
                  <Mail size={14} color={colors.textMuted} />
                  <Text style={[styles.detailText, { color: colors.textSecondary, fontFamily: 'ComicNeue-Regular' }]}>
                    {user?.emailAddresses?.[0]?.emailAddress}
                  </Text>
                </View>
                <View style={[styles.detailRow, { backgroundColor: colors.bgTertiary }]}>
                  <Shield size={14} color={colors.textMuted} />
                  <Text style={[styles.detailText, { color: colors.textSecondary, fontFamily: 'ComicNeue-Regular' }]}>
                    Member
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Roles */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Crown size={13} color={colors.textMuted} />
                <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>
                  SERVER ROLES
                </Text>
              </View>
              <View style={styles.roleList}>
                <View style={[styles.roleBadge, { backgroundColor: colors.accentGoldDim, borderColor: colors.accentGold }]}>
                  <View style={[styles.roleDot, { backgroundColor: colors.accentGold }]} />
                  <Text style={[styles.roleText, { color: colors.accentGold, fontFamily: 'ComicNeue-Bold' }]}>Admin</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}>
                  <View style={[styles.roleDot, { backgroundColor: colors.accentGold }]} />
                  <Text style={[styles.roleText, { color: colors.textSecondary, fontFamily: 'ComicNeue-Bold' }]}>Member</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Members Tab ── */}
        {activeTab === 'members' && (
          <Animated.View entering={FadeIn.duration(200)}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={13} color={colors.textMuted} />
                <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>
                  CHANNEL MEMBERS — {channelInfo?.members?.length || 0}
                </Text>
              </View>

              {channelInfo?.members?.map((member, index) => (
                <Animated.View key={member.id} entering={FadeInDown.delay(index * 50).springify()}>
                  <View style={[styles.memberRow, { borderColor: colors.borderPrimary }]}>
                    <Avatar src={member.imageUrl} fallback={member.username} size={38} />
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>
                        {member.username}
                      </Text>
                      {member.role === 'admin' && (
                        <View style={[styles.adminTag, { backgroundColor: colors.accentGoldDim }]}>
                          <Text style={[styles.adminTagText, { color: colors.accentGold }]}>ADMIN</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Animated.View>
              )) || (
                <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
                  No members info available
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── AI Tab ── */}
        {activeTab === 'ai' && (
          <Animated.View entering={FadeIn.duration(200)}>
            {/* AI Header */}
            <View style={styles.aiHeader}>
              <LinearGradient colors={[colors.accentGold, colors.accentBrass]} style={styles.aiIconWrap}>
                <Sparkles size={24} color="#F2EDE7" />
              </LinearGradient>
              <Text style={[styles.aiTitle, { color: colors.accentGold, fontFamily: 'Fredoka-SemiBold' }]}>
                AI Co-Pilot
              </Text>
            </View>

            <Button
              title={aiLoading ? 'Analyzing...' : aiSummary ? 'Regenerate' : 'Generate Summary'}
              icon={<RefreshCw size={16} color="#F2EDE7" />}
              onPress={generateSummary}
              isLoading={aiLoading}
              fullWidth
              size="lg"
              style={{ marginBottom: 20 }}
            />

            {!aiSummary && !aiLoading && (
              <GlassCard variant="default" style={styles.aiEmpty}>
                <Brain size={36} color={colors.textMuted} />
                <Text style={[styles.aiEmptyTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-SemiBold' }]}>
                  AI Co-Pilot Ready
                </Text>
                <Text style={[styles.aiEmptyDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                  Generate a summary to analyze this conversation. AI will extract key topics, action items, and insights.
                </Text>
              </GlassCard>
            )}

            {aiSummary && (
              <>
                {/* Summary */}
                <GlassCard variant="gold" style={styles.aiCard}>
                  <View style={styles.aiCardHeader}>
                    <MessageCircle size={16} color={colors.accentGold} />
                    <Text style={[styles.aiCardLabel, { color: colors.accentGold, fontFamily: 'Fredoka-Medium' }]}>
                      OVERVIEW
                    </Text>
                  </View>
                  <Text style={[styles.aiText, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}>
                    {aiSummary.summary || 'No summary available.'}
                  </Text>
                </GlassCard>

                {/* Action Items */}
                {aiSummary.actionItems?.length > 0 && (
                  <GlassCard variant="default" style={styles.aiCard}>
                    <View style={styles.aiCardHeader}>
                      <ListChecks size={16} color={colors.accentCyan} />
                      <Text style={[styles.aiCardLabel, { color: colors.accentCyan, fontFamily: 'Fredoka-Medium' }]}>
                        ACTION ITEMS
                      </Text>
                    </View>
                    {aiSummary.actionItems.map((item: string, i: number) => (
                      <View key={i} style={styles.actionRow}>
                        <CheckCircle size={18} color={colors.accentEmerald} />
                        <Text style={[styles.actionText, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}>
                          {item}
                        </Text>
                      </View>
                    ))}
                  </GlassCard>
                )}

                {/* Key Topics */}
                {aiSummary.keyTopics?.length > 0 && (
                  <GlassCard variant="default" style={styles.aiCard}>
                    <View style={styles.aiCardHeader}>
                      <Brain size={16} color={colors.accentPurple} />
                      <Text style={[styles.aiCardLabel, { color: colors.accentPurple, fontFamily: 'Fredoka-Medium' }]}>
                        KEY TOPICS
                      </Text>
                    </View>
                    <View style={styles.topicsWrap}>
                      {aiSummary.keyTopics.map((topic: string, i: number) => {
                        const tagColors = [colors.accentGold, colors.accentCyan, colors.accentEmerald, colors.accentPurple, colors.accentRose];
                        const tagColor = tagColors[i % tagColors.length];
                        return (
                          <View key={i} style={[styles.topicTag, { backgroundColor: `${tagColor}15`, borderColor: `${tagColor}30` }]}>
                            <Text style={[styles.topicText, { color: tagColor, fontFamily: 'ComicNeue-Bold' }]}>
                              {topic}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </GlassCard>
                )}
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabBar: {
    flexDirection: 'row', padding: 8, gap: 4,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  tabLabel: { fontSize: 13 },

  scrollContent: { padding: 20, paddingBottom: 40 },

  // Profile
  profileCard: { alignItems: 'center', padding: 28, marginBottom: 24 },
  profileName: { fontSize: 20, letterSpacing: -0.3, marginTop: 14 },
  profileHandle: { fontSize: 14, marginTop: 2 },
  profileDetails: { width: '100%', gap: 8, marginTop: 20 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10,
  },
  detailText: { fontSize: 13 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14, paddingHorizontal: 4,
  },
  sectionLabel: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },

  // Roles
  roleList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1,
  },
  roleDot: { width: 7, height: 7, borderRadius: 4 },
  roleText: { fontSize: 13 },

  // Members
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.sm, marginBottom: 2,
  },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15 },
  adminTag: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
  adminTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  emptyText: { textAlign: 'center', padding: 32, fontSize: 14 },

  // AI
  aiHeader: { alignItems: 'center', marginBottom: 20, gap: 10 },
  aiIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8B7D6B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  aiTitle: { fontSize: 16 },
  aiCard: { padding: 20, marginBottom: 16 },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  aiCardLabel: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  aiText: { fontSize: 15, lineHeight: 23 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  actionText: { fontSize: 15, lineHeight: 22, flex: 1 },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicTag: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  topicText: { fontSize: 12 },
  aiEmpty: { alignItems: 'center', padding: 32, gap: 12 },
  aiEmptyTitle: { fontSize: 18 },
  aiEmptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
