import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../lib/store';
import { radius, spacing, typography } from '../../lib/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'gold' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  isLoading,
  fullWidth,
  style,
  disabled,
  onPress,
  ...props
}: ButtonProps) {
  const colors = useAppStore((s) => s.colors);
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17 },
    xl: { paddingVertical: 20, paddingHorizontal: 36, fontSize: 18 },
  };

  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const s = sizeStyles[size];

  // Primary and Gold use gradient backgrounds
  if (variant === 'primary' || variant === 'gold') {
    const gradientColors = isDark
      ? (['#8B7D6B', '#A6967E'] as const)
      : (['#6B5F4E', '#8B7D6B'] as const);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled || isLoading}
        onPress={handlePress}
        style={[
          { opacity: disabled || isLoading ? 0.5 : 1, borderRadius: radius.sm, overflow: 'hidden' },
          fullWidth && { width: '100%' },
          style,
        ]}
        {...props}
      >
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.inner,
            { paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="#F2EDE7" size="small" />
          ) : (
            <View style={styles.row}>
              {icon && <View style={styles.iconLeft}>{icon}</View>}
              <Text style={[styles.text, { fontSize: s.fontSize, color: '#F2EDE7', fontFamily: 'Fredoka-SemiBold' }]}>
                {title}
              </Text>
              {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Ghost, Outline, Danger
  let backgroundColor = 'transparent';
  let textColor = colors.textPrimary;
  let borderColor = 'transparent';
  let borderWidth = 0;

  switch (variant) {
    case 'ghost':
      textColor = colors.textSecondary;
      break;
    case 'outline':
      borderColor = colors.borderPrimary;
      borderWidth = 1.5;
      break;
    case 'danger':
      backgroundColor = 'rgba(196, 138, 138, 0.12)';
      textColor = colors.accentRose;
      borderColor = 'rgba(196, 138, 138, 0.2)';
      borderWidth = 1;
      break;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || isLoading}
      onPress={handlePress}
      style={[
        styles.inner,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          opacity: disabled || isLoading ? 0.5 : 1,
          borderRadius: radius.sm,
        },
        fullWidth && { width: '100%' },
        style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.text, { fontSize: s.fontSize, color: textColor, fontFamily: 'ComicNeue-Bold' }]}>
            {title}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
