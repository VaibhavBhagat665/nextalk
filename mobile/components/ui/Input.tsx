import React, { useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useAppStore } from '../../lib/store';
import { radius, spacing } from '../../lib/theme';
import { Eye, EyeOff } from 'lucide-react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function Input({ label, error, icon, rightIcon, style, secureTextEntry, onFocus, onBlur, ...props }: InputProps) {
  const colors = useAppStore((s) => s.colors);
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animated border glow
  const borderProgress = useSharedValue(0);
  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: borderProgress.value > 0
      ? `rgba(139, 125, 107, ${0.14 + borderProgress.value * 0.36})`
      : colors.borderPrimary,
    transform: [{ scale: withSpring(borderProgress.value > 0 ? 1.0 : 1.0) }],
  }));

  const handleFocus = (e: any) => {
    setFocused(true);
    borderProgress.value = withTiming(1, { duration: 200 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setFocused(false);
    borderProgress.value = withTiming(0, { duration: 200 });
    onBlur?.(e);
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: focused ? colors.accentGold : colors.textSecondary, fontFamily: 'Fredoka-Medium' }]}>
          {label}
        </Text>
      )}
      <AnimatedView
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBg,
            borderColor: error ? colors.accentRose : colors.borderPrimary,
          },
          animatedBorder,
          error && { borderColor: colors.accentRose },
        ]}
      >
        {icon && <View style={styles.iconLeft}>{icon}</View>}
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !showPassword}
          style={[
            styles.input,
            { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' },
            icon ? { paddingLeft: 0 } : undefined,
            style,
          ]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
            {showPassword ? (
              <EyeOff size={18} color={colors.textMuted} />
            ) : (
              <Eye size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </AnimatedView>
      {error && (
        <Text style={[styles.error, { color: colors.accentRose, fontFamily: 'ComicNeue-Regular' }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  iconLeft: {
    paddingLeft: 14,
  },
  iconRight: {
    paddingRight: 14,
  },
  eyeButton: {
    padding: 14,
  },
  error: {
    fontSize: 12,
    marginTop: 6,
  },
});
