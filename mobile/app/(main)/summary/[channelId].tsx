import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { fetchApi } from '../../../lib/api';
import { useAppStore } from '../../../lib/store';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';
import { radius } from '../../../lib/theme';
import { Sparkles, CheckCircle, ListChecks, MessageCircle, RefreshCw } from 'lucide-react-native';

export default function SummaryScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { getToken } = useAuth();
  const colors = useAppStore((s) => s.colors);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchSummary = async () => {
    if (!channelId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchApi(`/api/ai/summary?channelId=${channelId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSummary(data.summary || null);
    } catch {} finally { setLoading(false); }
  };

  const generateSummary = async () => {
    if (!channelId) return;
    setGenerating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchApi('/api/ai/summarize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      });
      setSummary(data.summary || null);
    } catch {} finally { setGenerating(false); }
  };

  useEffect(() => { fetchSummary(); }, [channelId]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accentGold} /></View>;
  }

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: colors.bgPrimary }]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <LinearGradient colors={[colors.accentGold, colors.accentBrass]} style={styles.headerIcon}>
            <Sparkles size={28} color="#F2EDE7" />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>AI Summary</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
            Powered by Llama 3.1
          </Text>
        </Animated.View>

        {/* Generate Button */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Button
            title={generating ? 'Generating...' : summary ? 'Regenerate Summary' : 'Generate Summary'}
            icon={<RefreshCw size={16} color="#F2EDE7" />}
            onPress={generateSummary}
            isLoading={generating}
            fullWidth
            size="lg"
            style={{ marginBottom: 24 }}
          />
        </Animated.View>

        {summary && (
          <>
            {/* Overview */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <GlassCard variant="gold" style={styles.card}>
                <View style={styles.cardHeader}>
                  <MessageCircle size={16} color={colors.accentGold} />
                  <Text style={[styles.cardLabel, { color: colors.accentGold, fontFamily: 'Fredoka-Medium' }]}>OVERVIEW</Text>
                </View>
                <Text style={[styles.summaryText, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}>
                  {summary.content || summary.summary || 'No summary available.'}
                </Text>
              </GlassCard>
            </Animated.View>

            {/* Action Items */}
            {summary.actionItems?.length > 0 && (
              <Animated.View entering={FadeInDown.delay(400).springify()}>
                <GlassCard variant="default" style={styles.card}>
                  <View style={styles.cardHeader}>
                    <ListChecks size={16} color={colors.accentCyan} />
                    <Text style={[styles.cardLabel, { color: colors.accentCyan, fontFamily: 'Fredoka-Medium' }]}>ACTION ITEMS</Text>
                  </View>
                  {summary.actionItems.map((item: string, i: number) => (
                    <View key={i} style={styles.actionRow}>
                      <CheckCircle size={18} color={colors.accentEmerald} />
                      <Text style={[styles.actionText, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}>{item}</Text>
                    </View>
                  ))}
                </GlassCard>
              </Animated.View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  headerIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#8B7D6B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  title: { fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  card: { padding: 24, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardLabel: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  summaryText: { fontSize: 16, lineHeight: 24 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  actionText: { fontSize: 16, lineHeight: 22, flex: 1 },
});
