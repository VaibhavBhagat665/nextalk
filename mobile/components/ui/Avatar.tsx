import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../../lib/store';

interface AvatarProps {
  src?: string | null;
  fallback?: string;
  size?: number;
  status?: 'online' | 'offline' | 'dnd';
  borderGlow?: boolean;
  style?: any;
}

export function Avatar({ src, fallback, size = 42, status, borderGlow, style }: AvatarProps) {
  const colors = useAppStore((s) => s.colors);

  const statusColors = {
    online: colors.statusOnline,
    offline: colors.statusOffline,
    dnd: colors.statusDnd,
  };

  const statusSize = Math.max(10, size * 0.28);

  return (
    <View style={[{ width: size, height: size, position: 'relative' }, style]}>
      {borderGlow ? (
        <LinearGradient
          colors={[colors.accentGold, colors.accentBrass]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.glowRing, { borderRadius: size / 2, padding: 2 }]}
        >
          {renderInner()}
        </LinearGradient>
      ) : (
        renderInner()
      )}

      {status && (
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: statusColors[status],
              borderColor: colors.bgSecondary,
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              borderWidth: 2.5,
              bottom: 0,
              right: 0,
            },
            status === 'online' && styles.statusGlow,
          ]}
        />
      )}
    </View>
  );

  function renderInner() {
    if (src) {
      return (
        <Image
          source={{ uri: src }}
          style={[
            styles.image,
            {
              width: borderGlow ? size - 4 : size,
              height: borderGlow ? size - 4 : size,
              borderRadius: size / 2,
            },
          ]}
        />
      );
    }

    return (
      <LinearGradient
        colors={[colors.bgTertiary, colors.bgElevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.fallbackContainer,
          {
            width: borderGlow ? size - 4 : size,
            height: borderGlow ? size - 4 : size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.fallbackText,
            {
              color: colors.textSecondary,
              fontSize: size * 0.38,
              fontFamily: 'Fredoka-SemiBold',
            },
          ]}
        >
          {fallback?.charAt(0).toUpperCase() || '?'}
        </Text>
      </LinearGradient>
    );
  }
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  glowRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontWeight: '600',
  },
  statusDot: {
    position: 'absolute',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statusGlow: {
    shadowColor: '#7DBF96',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
});
