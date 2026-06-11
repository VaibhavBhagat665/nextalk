import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useAppStore } from '../../lib/store';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { MessageSquare, Users, Settings, Sparkles } from 'lucide-react-native';

export default function MainLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useAppStore((s) => s.colors);

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accentGold} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.borderPrimary,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: colors.accentGold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: 'Fredoka-Medium',
          fontSize: 11,
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: colors.bgSecondary,
          elevation: 0,
          shadowColor: 'transparent',
          borderBottomColor: colors.borderPrimary,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          fontFamily: 'Fredoka-SemiBold',
          fontSize: 20,
          color: colors.textPrimary,
          letterSpacing: -0.5,
        },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Tabs.Screen
        name="servers"
        options={{
          title: 'Servers',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dm"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
      {/* Hidden screens — not in tab bar */}
      <Tabs.Screen name="channels/[serverId]" options={{ href: null, headerShown: true }} />
      <Tabs.Screen name="chat/[channelId]" options={{ href: null, headerShown: true }} />
      <Tabs.Screen name="summary/[channelId]" options={{ href: null, headerShown: true, title: 'AI Summary' }} />
      <Tabs.Screen name="info/[channelId]" options={{ href: null, headerShown: true, title: 'Channel Info' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
