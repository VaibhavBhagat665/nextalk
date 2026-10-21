import { Stack } from 'expo-router';
import { useAppStore } from '../../../lib/store';

export default function ProfileLayout() {
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
          title: 'Profile',
        }}
      />
    </Stack>
  );
}
