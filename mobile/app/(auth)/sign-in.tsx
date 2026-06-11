import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Dimensions } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/GlassCard';
import { useAppStore } from '../../lib/store';
import { spacing, radius } from '../../lib/theme';
import { MessageSquare, ArrowRight, Mail, Lock } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const colors = useAppStore((s) => s.colors);
  const theme = useAppStore((s) => s.theme);

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');

    try {
      const completeSignIn = await signIn.create({ identifier: emailAddress, password });
      if (completeSignIn.status === 'complete') {
        await setActive({ session: completeSignIn.createdSessionId });
        router.replace('/');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]}>
      {/* Background orbs */}
      <View style={styles.orbContainer}>
        <LinearGradient
          colors={[`${colors.accentGold}20`, 'transparent']}
          style={[styles.orb, styles.orbTopRight]}
        />
        <LinearGradient
          colors={[`${colors.accentCyan}15`, 'transparent']}
          style={[styles.orb, styles.orbBottomLeft]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.logoRow}>
            <LinearGradient
              colors={[colors.accentGold, colors.accentBrass]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoIcon}
            >
              <MessageSquare size={26} color="#F2EDE7" />
            </LinearGradient>
          </Animated.View>

          {/* Header */}
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
              Welcome Back
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: 'ComicNeue-Regular' }]}>
              Sign in to continue to NexTalk
            </Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View entering={FadeInUp.delay(300).springify()}>
            <GlassCard variant="gradient" glowBorder style={styles.card}>
              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: `${colors.accentRose}15`, borderColor: `${colors.accentRose}30` }]}>
                  <Text style={[styles.errorText, { color: colors.accentRose, fontFamily: 'ComicNeue-Regular' }]}>{error}</Text>
                </View>
              ) : null}

              <Input
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={emailAddress}
                placeholder="your@email.com"
                onChangeText={setEmailAddress}
                label="Email"
                icon={<Mail size={18} color={colors.textMuted} />}
              />

              <Input
                value={password}
                placeholder="••••••••"
                secureTextEntry
                onChangeText={setPassword}
                label="Password"
                icon={<Lock size={18} color={colors.textMuted} />}
              />

              <Button
                title="Sign In"
                onPress={onSignInPress}
                isLoading={loading}
                size="lg"
                fullWidth
                iconRight={<ArrowRight size={18} color="#F2EDE7" />}
                style={{ marginTop: 8 }}
              />
            </GlassCard>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.footer}>
            <Text style={{ color: colors.textTertiary, fontFamily: 'ComicNeue-Regular', fontSize: 15 }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/sign-up">
              <Text style={{ color: colors.accentGold, fontFamily: 'Fredoka-SemiBold', fontSize: 15 }}>
                Sign Up
              </Text>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  orbContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 300,
  },
  orbTopRight: {
    width: 400,
    height: 400,
    top: -100,
    right: -100,
  },
  orbBottomLeft: {
    width: 350,
    height: 350,
    bottom: -80,
    left: -80,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B7D6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    padding: 28,
  },
  errorBanner: {
    padding: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 18,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
});
