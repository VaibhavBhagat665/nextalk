import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Animated, { FadeInDown, FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { fetchApi } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { radius } from '../../lib/theme';
import { X, MessageSquare, UserX } from 'lucide-react-native';

interface Profile {
  id: string;
  username: string;
  imageUrl: string | null;
  statusMessage: string | null;
  allowDmsFromNonMembers: boolean;
}

interface Props {
  userId: string | null;
  visible: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ userId, visible, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();
  const colors = useAppStore((s) => s.colors);
  const router = useRouter();

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    setProfile(null);
    
    const loadProfile = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await fetchApi(`/api/users/${userId}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfile(data);
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
  }, [userId, visible]);

  const handleMessage = () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    // Use setTimeout to allow modal to close smoothly before navigating
    setTimeout(() => {
      router.push(`/(main)/chat/${profile.id}`);
    }, 100);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View 
              entering={SlideInDown.duration(300).springify()}
              exiting={SlideOutDown.duration(200)}
              style={[styles.modalContainer, { backgroundColor: colors.bgSecondary, borderColor: colors.borderPrimary }]}
            >
              {/* Header Banner */}
              <View style={styles.banner}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                {/* Avatar */}
                <View style={[styles.avatarWrap, { backgroundColor: colors.bgSecondary }]}>
                  {loading ? (
                    <View style={[styles.avatarSkeleton, { backgroundColor: colors.bgTertiary }]} />
                  ) : (
                    <Avatar src={profile?.imageUrl || undefined} fallback={profile?.username || 'U'} size={80} />
                  )}
                </View>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accentGold} />
                  </View>
                ) : !profile ? (
                  <View style={styles.loadingContainer}>
                    <Text style={{ color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }}>User not found</Text>
                  </View>
                ) : (
                  <View style={styles.infoContainer}>
                    <Text style={[styles.username, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
                      {profile.username}
                    </Text>
                    {profile.statusMessage && (
                      <Text style={[styles.statusMessage, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
                        {profile.statusMessage}
                      </Text>
                    )}

                    <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />

                    {profile.allowDmsFromNonMembers ? (
                      <Button
                        title="Send Message"
                        icon={<MessageSquare size={18} color="#1a1400" />}
                        onPress={handleMessage}
                        variant="primary"
                        size="lg"
                        style={styles.messageBtn}
                      />
                    ) : (
                      <View style={[styles.disabledBtn, { backgroundColor: colors.bgTertiary }]}>
                        <UserX size={18} color={colors.textMuted} />
                        <Text style={[styles.disabledBtnText, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>
                          DMs Disabled
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 40,
  },
  banner: {
    height: 100,
    backgroundColor: 'rgba(212, 162, 60, 0.2)', // Accent gold dim
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    position: 'relative',
  },
  avatarWrap: {
    position: 'absolute',
    top: -40,
    left: 24,
    padding: 4,
    borderRadius: 50,
  },
  avatarSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  infoContainer: {
    marginTop: 50,
  },
  username: {
    fontSize: 24,
    marginBottom: 4,
  },
  statusMessage: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  messageBtn: {
    width: '100%',
    shadowColor: '#D4A23C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  disabledBtnText: {
    fontSize: 16,
  },
});
