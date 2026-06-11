import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Switch, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { fetchApi } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Button } from '../ui/Button';
import { radius } from '../../lib/theme';
import { X, Hash, Volume2, Lock, Plus } from 'lucide-react-native';

interface Props {
  visible: boolean;
  serverId: string;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateChannelModal({ visible, serverId, onClose, onCreated }: Props) {
  const { getToken } = useAuth();
  const colors = useAppStore((s) => s.colors);

  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice'>('text');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setType('text');
    setIsPrivate(false);
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
      await fetchApi('/api/channels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim().toLowerCase().replace(/\s+/g, '-'),
          type,
          isPrivate,
          serverId,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated?.();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
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
            <View style={[styles.handleBar, { backgroundColor: colors.borderPrimary }]} />

            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              <Animated.View entering={FadeInDown.duration(250)}>
                <Text style={[styles.title, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                  Create Channel
                </Text>
                <Text style={[styles.subtitle, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                  Add a new channel to this server
                </Text>

                {/* Channel Type */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>
                  CHANNEL TYPE
                </Text>
                <View style={styles.typeRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { Haptics.selectionAsync(); setType('text'); }}
                    style={[
                      styles.typeCard,
                      { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary },
                      type === 'text' && { borderColor: colors.accentGold, backgroundColor: colors.accentGoldDim },
                    ]}
                  >
                    <Hash size={22} color={type === 'text' ? colors.accentGold : colors.textMuted} />
                    <Text style={[styles.typeLabel, { color: type === 'text' ? colors.accentGold : colors.textSecondary, fontFamily: 'Fredoka-SemiBold' }]}>
                      Text
                    </Text>
                    <Text style={[styles.typeDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                      Send messages
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { Haptics.selectionAsync(); setType('voice'); }}
                    style={[
                      styles.typeCard,
                      { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary },
                      type === 'voice' && { borderColor: colors.accentCyan, backgroundColor: `${colors.accentCyan}12` },
                    ]}
                  >
                    <Volume2 size={22} color={type === 'voice' ? colors.accentCyan : colors.textMuted} />
                    <Text style={[styles.typeLabel, { color: type === 'voice' ? colors.accentCyan : colors.textSecondary, fontFamily: 'Fredoka-SemiBold' }]}>
                      Voice
                    </Text>
                    <Text style={[styles.typeDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                      Talk live
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Channel Name */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: 'Fredoka-Medium', marginTop: 20 }]}>
                  CHANNEL NAME
                </Text>
                <View style={[styles.nameInput, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}>
                  {type === 'text' ? (
                    <Hash size={16} color={colors.textMuted} />
                  ) : (
                    <Volume2 size={16} color={colors.textMuted} />
                  )}
                  <TextInput
                    style={[styles.inputInner, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}
                    placeholder="new-channel"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    maxLength={32}
                    autoFocus
                    autoCapitalize="none"
                  />
                </View>

                {/* Private Toggle */}
                <View style={[styles.toggleRow, { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary }]}>
                  <View style={[styles.toggleIconWrap, { backgroundColor: `${colors.accentPurple}15` }]}>
                    <Lock size={16} color={colors.accentPurple} />
                  </View>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>
                      Private Channel
                    </Text>
                    <Text style={[styles.toggleDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                      Only invited members can see it
                    </Text>
                  </View>
                  <Switch
                    value={isPrivate}
                    onValueChange={(v) => { Haptics.selectionAsync(); setIsPrivate(v); }}
                    trackColor={{ false: colors.bgElevated, true: colors.accentGold }}
                    thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                  />
                </View>

                {error ? (
                  <View style={[styles.errorBox, { backgroundColor: `${colors.accentRose}12`, borderColor: `${colors.accentRose}25` }]}>
                    <Text style={[styles.errorText, { color: colors.accentRose, fontFamily: 'ComicNeue-Regular' }]}>{error}</Text>
                  </View>
                ) : null}

                <Button
                  title={loading ? 'Creating...' : 'Create Channel'}
                  icon={loading ? <ActivityIndicator size="small" color="#F2EDE7" /> : <Plus size={16} color="#F2EDE7" />}
                  onPress={handleCreate}
                  isLoading={loading}
                  disabled={!name.trim()}
                  fullWidth
                  size="lg"
                  style={{ marginTop: 24 }}
                />
              </Animated.View>
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
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8,
  },
  content: { padding: 24, paddingTop: 20, paddingBottom: 40 },

  title: { fontSize: 24, letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 24, lineHeight: 22 },

  fieldLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 },

  typeRow: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1, alignItems: 'center', padding: 20, gap: 6,
    borderRadius: 16, borderWidth: 1.5,
  },
  typeLabel: { fontSize: 15, marginTop: 4 },
  typeDesc: { fontSize: 12 },

  nameInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14,
  },
  inputInner: { flex: 1, paddingVertical: 14, fontSize: 16 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 20,
  },
  toggleIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, marginBottom: 2 },
  toggleDesc: { fontSize: 12 },

  errorBox: { marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { fontSize: 14 },
});
