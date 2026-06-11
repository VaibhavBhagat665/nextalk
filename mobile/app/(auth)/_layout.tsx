import { Stack } from 'expo-router';
import { useAppStore } from '../../lib/store';
import { darkTheme, lightTheme } from '../../lib/theme';

export default function AuthLayout() {
  const theme = useAppStore((state) => state.theme);
  const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: currentTheme.bgPrimary },
      }}
    />
  );
}
