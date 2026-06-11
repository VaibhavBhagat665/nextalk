import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppStore } from '../../lib/store';
import { darkTheme, lightTheme } from '../../lib/theme';

interface BadgeProps {
  count: number;
  variant?: 'primary' | 'gold' | 'unread';
}

export function Badge({ count, variant = 'primary' }: BadgeProps) {
  const theme = useAppStore((state) => state.theme);
  const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

  if (count <= 0) return null;

  let backgroundColor = currentTheme.accentBrass;
  let textColor = '#F2EDE7';

  if (variant === 'gold') {
    backgroundColor = currentTheme.accentGold;
  } else if (variant === 'unread') {
    backgroundColor = currentTheme.accentGold;
    textColor = '#1a1400';
  }

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color: textColor }]}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
  },
});
