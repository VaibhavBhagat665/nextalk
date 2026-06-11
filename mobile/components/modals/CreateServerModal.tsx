import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchApi } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { radius } from '../../lib/theme';
import {
  X, Plus, Globe, Link2, Loader2, ChevronLeft,
} from 'lucide-react-native';

const SERVER_ICONS = ['🎮', '💻', '🎵', '📚', '🏢', '🚀', '⚡', '🌟', '🎯', '🔥', '💬', '🛠️'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateServerModal({ visible, onClose, onCreated }: Props) {
  const { getToken } = useAuth();
  const router = useRouter();
  const colors = useAppStore((s) => s.colors);
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💬');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setMode('choose');
    setName('');
    setIcon('💬');
    setInviteCode('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      await fetchApi('/api/servers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      await fetchApi(`/api/servers/join/${inviteCode.trim()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join server');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={[styles.sheet, { backgroundColor: colors.bgSecondary, borderColor: colors.borderPrimary }]}>
            {/* Handle Bar */}
            <View style={[styles.handleBar, { backgroundColor: colors.borderPrimary }]} />

            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(40, insets.bottom + 20) }]}>
              {/* ── Choose Mode ── */}
              {mode === 'choose' && (
                <Animated.View entering={FadeIn.duration(250)}>
                  <Text style={[styles.title, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                    Add a Server
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                    Create your own or join an existing one
                  </Text>

                  {/* Create Option */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode('create'); }}
                    style={[styles.modeCard, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}
                  >
                    <View style={[styles.modeIconWrap, { backgroundColor: colors.accentGoldDim }]}>
                      <Plus size={24} color={colors.accentGold} />
                    </View>
                    <View style={styles.modeInfo}>
                      <Text style={[styles.modeTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-SemiBold' }]}>
                        Create a Server
                      </Text>
                      <Text style={[styles.modeDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                        Start fresh with your own channels
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Join Option */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode('join'); }}
                    style={[styles.modeCard, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}
                  >
                    <View style={[styles.modeIconWrap, { backgroundColor: `${colors.accentCyan}15` }]}>
                      <Globe size={24} color={colors.accentCyan} />
                    </View>
                    <View style={styles.modeInfo}>
                      <Text style={[styles.modeTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-SemiBold' }]}>
                        Join a Server
                      </Text>
                      <Text style={[styles.modeDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                        Enter an invite code from a friend
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* ── Create Mode ── */}
              {mode === 'create' && (
                <Animated.View entering={FadeInDown.duration(250)}>
                  <TouchableOpacity onPress={() => setMode('choose')} style={styles.backRow}>
                    <ChevronLeft size={18} color={colors.textMuted} />
                    <Text style={[styles.backText, { color: colors.textMuted, fontFamily: 'ComicNeue-Bold' }]}>Back</Text>
                  </TouchableOpacity>

                  <Text style={[styles.title, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                    Create Server
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                    Give your server a name and icon
                  </Text>

                  {/* Icon Picker */}
                  <View style={styles.iconSection}>
                    <View style={[styles.selectedIcon, { backgroundColor: colors.bgTertiary, borderColor: colors.borderGlow }]}>
                      <Text style={styles.selectedIconText}>{icon}</Text>
                    </View>
                    <View style={styles.iconGrid}>
                      {SERVER_ICONS.map((emoji) => (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => { Haptics.selectionAsync(); setIcon(emoji); }}
                          style={[
                            styles.iconOption,
                            { backgroundColor: colors.bgTertiary },
                            icon === emoji && { borderColor: colors.accentGold, backgroundColor: colors.accentGoldDim },
                          ]}
                        >
                          <Text style={styles.iconEmoji}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Name Input */}
                  <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>
                    SERVER NAME
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.bgTertiary, color: colors.textPrimary, borderColor: colors.borderPrimary, fontFamily: 'ComicNeue-Regular' }]}
                    placeholder="My Awesome Server"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    maxLength={32}
                    autoFocus
                  />

                  {error ? (
                    <View style={[styles.errorBox, { backgroundColor: `${colors.accentRose}12`, borderColor: `${colors.accentRose}25` }]}>
                      <Text style={[styles.errorText, { color: colors.accentRose, fontFamily: 'ComicNeue-Regular' }]}>{error}</Text>
                    </View>
                  ) : null}

                  <Button
                    title={loading ? 'Creating...' : 'Create Server'}
                    icon={loading ? <ActivityIndicator size="small" color="#F2EDE7" /> : <Plus size={16} color="#F2EDE7" />}
                    onPress={handleCreate}
                    isLoading={loading}
                    disabled={!name.trim()}
                    fullWidth
                    size="lg"
                    style={{ marginTop: 20 }}
                  />
                </Animated.View>
              )}

              {/* ── Join Mode ── */}
              {mode === 'join' && (
                <Animated.View entering={FadeInDown.duration(250)}>
                  <TouchableOpacity onPress={() => setMode('choose')} style={styles.backRow}>
                    <ChevronLeft size={18} color={colors.textMuted} />
                    <Text style={[styles.backText, { color: colors.textMuted, fontFamily: 'ComicNeue-Bold' }]}>Back</Text>
                  </TouchableOpacity>

                  <Text style={[styles.title, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                    Join Server
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                    Enter an invite code from a friend
                  </Text>

                  <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>
                    INVITE CODE
                  </Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}>
                    <Link2 size={16} color={colors.textMuted} />
                    <TextInput
                      style={[styles.inputInner, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}
                      placeholder="Paste invite code here..."
                      placeholderTextColor={colors.textMuted}
                      value={inviteCode}
                      onChangeText={setInviteCode}
                      autoFocus
                      autoCapitalize="none"
                    />
                  </View>

                  {error ? (
                    <View style={[styles.errorBox, { backgroundColor: `${colors.accentRose}12`, borderColor: `${colors.accentRose}25` }]}>
                      <Text style={[styles.errorText, { color: colors.accentRose, fontFamily: 'ComicNeue-Regular' }]}>{error}</Text>
                    </View>
                  ) : null}

                  <Button
                    title={loading ? 'Joining...' : 'Join Server'}
                    icon={loading ? <ActivityIndicator size="small" color="#F2EDE7" /> : <Globe size={16} color="#F2EDE7" />}
                    onPress={handleJoin}
                    isLoading={loading}
                    disabled={!inviteCode.trim()}
                    fullWidth
                    size="lg"
                    style={{ marginTop: 20 }}
                  />
                </Animated.View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  keyboardView: { justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    padding: 8,
  },
  content: { padding: 24, paddingTop: 20, paddingBottom: 40 },

  title: { fontSize: 24, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 24, lineHeight: 22 },

  // Mode cards
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 14,
  },
  modeIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: 16, marginBottom: 2 },
  modeDesc: { fontSize: 13 },

  // Back
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 14 },

  // Icon picker
  iconSection: { flexDirection: 'row', gap: 16, marginBottom: 24, alignItems: 'flex-start' },
  selectedIcon: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  selectedIconText: { fontSize: 32 },
  iconGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  iconOption: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent',
  },
  iconEmoji: { fontSize: 20 },

  // Form
  fieldLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 },
  input: {
    borderRadius: 14, borderWidth: 1.5, padding: 14, fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14,
  },
  inputInner: { flex: 1, paddingVertical: 14, fontSize: 16 },

  errorBox: { marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 14 },
});
