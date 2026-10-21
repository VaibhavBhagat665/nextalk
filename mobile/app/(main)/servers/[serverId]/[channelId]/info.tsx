import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../../../../../lib/store';

export default function ChannelInfoScreen() {
  const { serverId, channelId } = useLocalSearchParams<{ serverId: string; channelId: string }>();
  const colors = useAppStore((s) => s.colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.center}>
        <Text style={[styles.text, { color: colors.textPrimary, fontFamily: 'Fredoka-SemiBold' }]}>
          Channel Info Screen
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
          Server: {serverId}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: 'ComicNeue-Regular' }]}>
          Channel: {channelId}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 24, marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 8 },
});
