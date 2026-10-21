import { Stack } from 'expo-router';
import { useAppStore } from '../../../lib/store';

export default function ServersLayout() {
  const colors = useAppStore((s) => s.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bgSecondary,
        },
        headerTitleStyle: {
          fontFamily: 'Fredoka-SemiBold',
          fontSize: 20,
          color: colors.textPrimary,
          letterSpacing: -0.5,
        },
        headerTintColor: colors.textPrimary,
        headerBackTitle: 'Back',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Servers',
        }}
      />
      <Stack.Screen
        name="[serverId]/index"
        options={{
          title: 'Channels',
        }}
      />
      <Stack.Screen
        name="[serverId]/[channelId]/index"
        options={{
          title: 'Chat',
        }}
      />
      <Stack.Screen
        name="[serverId]/[channelId]/info"
        options={{
          title: 'Channel Info',
        }}
      />
      <Stack.Screen
        name="[serverId]/[channelId]/summary"
        options={{
          title: 'AI Summary',
        }}
      />
    </Stack>
  );
}
