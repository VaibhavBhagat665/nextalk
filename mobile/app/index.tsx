import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';
import { useAppStore } from '../lib/store';
import { darkTheme, lightTheme } from '../lib/theme';

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const theme = useAppStore((state) => state.theme);
  const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: currentTheme.bgPrimary }}>
        <ActivityIndicator size="large" color={currentTheme.accentGold} />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(main)/servers" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
