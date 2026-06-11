import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../../lib/store';
import { radius } from '../../lib/theme';

interface GlassCardProps extends ViewProps {
  variant?: 'default' | 'strong' | 'gold' | 'gradient';
  glowBorder?: boolean;
  noPadding?: boolean;
}

export function GlassCard({ children, style, variant = 'default', glowBorder = false, noPadding = false, ...props }: GlassCardProps) {
  const colors = useAppStore((s) => s.colors);
  const theme = useAppStore((s) => s.theme);

  const isDark = theme === 'dark';

  const variantStyles: Record<string, { bg: string; border: string }> = {
    default: {
      bg: isDark ? 'rgba(35, 31, 27, 0.75)' : 'rgba(253, 250, 245, 0.80)',
      border: colors.borderPrimary,
    },
    strong: {
      bg: isDark ? 'rgba(35, 31, 27, 0.92)' : 'rgba(253, 250, 245, 0.94)',
      border: colors.borderPrimary,
    },
    gold: {
      bg: isDark ? 'rgba(139, 125, 107, 0.06)' : 'rgba(107, 95, 78, 0.06)',
      border: isDark ? 'rgba(139, 125, 107, 0.18)' : 'rgba(107, 95, 78, 0.18)',
    },
    gradient: {
      bg: 'transparent',
      border: glowBorder ? colors.borderGlow : colors.borderPrimary,
    },
  };

  const { bg, border } = variantStyles[variant];

  if (variant === 'gradient') {
    return (
      <View style={[styles.wrapper, { borderColor: border, borderWidth: 1, borderRadius: radius.lg }, style]} {...props}>
        <LinearGradient
          colors={isDark
            ? ['rgba(35,31,27,0.85)', 'rgba(44,39,34,0.70)']
            : ['rgba(253,250,245,0.90)', 'rgba(237,231,221,0.80)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, !noPadding && styles.padding]}
        >
          {children}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: border },
        glowBorder && { borderColor: colors.borderGlow },
        noPadding && { padding: 0 },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 20,
    overflow: 'hidden',
  },
  wrapper: {
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: radius.lg - 1, // inside border
  },
  padding: {
    padding: 20,
  },
});
