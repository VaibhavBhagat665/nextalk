import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppStore } from '../lib/store';
import { socketService } from '../lib/socket';
import { Avatar } from './ui/Avatar';
import { radius } from '../lib/theme';
import { Users } from 'lucide-react-native';
import UserProfileModal from './modals/UserProfileModal';

type OnlineUser = {
  userId: string;
  username: string;
  imageUrl?: string | null;
};

interface Props {
  currentUserId?: string;
  maxHeight?: number;
}

export default function OnlineUsersList({ currentUserId, maxHeight = 200 }: Props) {
  const colors = useAppStore((s) => s.colors);
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handlePresence = (users: OnlineUser[]) => {
      setOnlineUsers(users.filter(u => u.userId !== currentUserId));
    };

    socket.on('presence:update', handlePresence);
    socket.emit('presence:request');

    return () => {
      socket.off('presence:update', handlePresence);
    };
  }, [currentUserId]);

  const handleUserPress = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUserId(userId);
  };

  if (onlineUsers.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
          No one else online
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { maxHeight }]}>
        <View style={styles.header}>
          <Users size={12} color={colors.textMuted} />
          <Text style={[styles.headerText, { color: colors.textMuted, fontFamily: 'Fredoka-Medium' }]}>
            ONLINE — {onlineUsers.length}
          </Text>
        </View>
        {onlineUsers.map((user, index) => (
          <Animated.View key={user.userId} entering={FadeInDown.delay(index * 40).springify()}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleUserPress(user.userId)}
              style={[styles.userRow, { borderColor: colors.borderPrimary }]}
            >
              <View style={styles.avatarWrap}>
                <Avatar src={user.imageUrl} fallback={user.username} size={32} />
                <View style={[styles.onlineDot, { backgroundColor: colors.statusOnline, borderColor: colors.bgSecondary }]} />
              </View>
              <Text
                style={[styles.username, { color: colors.textSecondary, fontFamily: 'ComicNeue-Bold' }]}
                numberOfLines={1}
              >
                {user.username}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
      <UserProfileModal 
        userId={selectedUserId} 
        visible={!!selectedUserId} 
        onClose={() => setSelectedUserId(null)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 4, paddingBottom: 10,
  },
  headerText: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8, paddingHorizontal: 8,
    borderRadius: radius.sm,
    marginBottom: 2,
  },
  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: -1, right: -1,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2.5,
  },
  username: { fontSize: 14, flex: 1 },
  emptyWrap: { paddingVertical: 12, alignItems: 'center' },
  emptyText: { fontSize: 13 },
});
