import React, { useCallback, useEffect, useState } from 'react';
import { Slot, SplashScreen } from 'expo-router';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { tokenCache } from '../lib/tokenCache';
import { useAppStore } from '../lib/store';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Keep the splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

export default function RootLayout() {
  const colors = useAppStore((s) => s.colors);
  const theme = useAppStore((s) => s.theme);

  const [fontsLoaded, fontError] = useFonts({
    'Fredoka-Regular': require('../assets/fonts/Fredoka-Regular.ttf'),
    'Fredoka-Medium': require('../assets/fonts/Fredoka-Medium.ttf'),
    'Fredoka-SemiBold': require('../assets/fonts/Fredoka-SemiBold.ttf'),
    'Fredoka-Bold': require('../assets/fonts/Fredoka-Bold.ttf'),
    'ComicNeue-Regular': require('../assets/fonts/ComicNeue-Regular.ttf'),
    'ComicNeue-Bold': require('../assets/fonts/ComicNeue-Bold.ttf'),
    'ComicNeue-Light': require('../assets/fonts/ComicNeue-Light.ttf'),
  });

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ClerkLoaded>
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <View style={[styles.root, { backgroundColor: colors.bgPrimary }]}>
                <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
                <Slot />
              </View>
            </SafeAreaProvider>
          </QueryClientProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
