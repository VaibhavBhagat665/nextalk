import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Dimensions, TextInput, ActivityIndicator } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../lib/store';
import { Avatar } from '../../components/ui/Avatar';
import { GlassCard } from '../../components/ui/GlassCard';
import { radius } from '../../lib/theme';
import { Moon, Sun, LogOut, Bell, Shield, Globe, Monitor, Laptop, Check, Volume2, BellOff, Eye, Lock, Clock, Calendar, ChevronRight, User as UserIcon } from 'lucide-react-native';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const colors = useAppStore((s) => s.colors);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const [activeTab, setActiveTab] = useState<'account' | 'appearance' | 'notifications' | 'privacy' | 'language'>('account');

  const [notifs, setNotifs] = useState({ desktop: true, sound: true, muteAll: false });
  const [privacy, setPrivacy] = useState({ onlineStatus: true, readReceipts: true, allowDms: true });
  
  const [usernameInput, setUsernameInput] = useState(user?.username || user?.firstName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user || usernameInput === (user.username || user.firstName)) return;
    setIsUpdatingProfile(true);
    try {
      await user.update({ username: usernameInput });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Failed to update username:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSignOut = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const tabs = [
    { id: 'account' as const, label: 'My Account', icon: UserIcon },
    { id: 'appearance' as const, label: 'Appearance', icon: Moon },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'privacy' as const, label: 'Privacy & Security', icon: Shield },
    { id: 'language' as const, label: 'Language & Region', icon: Globe },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.borderPrimary }]}>
        <Avatar src={user?.imageUrl} fallback={user?.username || 'U'} size={60} />
        <View style={styles.headerInfo}>
          <Text style={[styles.profileName, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>
            {user?.username || user?.firstName || 'User'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>
            {user?.emailAddresses[0]?.emailAddress}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={[styles.logoutBtn, { backgroundColor: `${colors.accentRose}15` }]}>
          <LogOut size={16} color={colors.accentRose} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabBar, { borderBottomColor: colors.borderPrimary }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.7}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.id); }}
              style={[
                styles.tabBtn,
                activeTab === tab.id && { backgroundColor: colors.bgTertiary, borderColor: colors.borderPrimary },
              ]}
            >
              <tab.icon size={14} color={activeTab === tab.id ? colors.accentGold : colors.textMuted} />
              <Text style={[
                styles.tabText,
                { color: activeTab === tab.id ? colors.textPrimary : colors.textMuted, fontFamily: 'Fredoka-Medium' },
              ]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Account Tab */}
        {activeTab === 'account' && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>My Account</Text>
            <Text style={[styles.sectionDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Manage your profile details and privacy.</Text>
            
            <View style={[styles.listCard, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}>
              <View style={[styles.listRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
                <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Username</Text>
                <View style={[styles.inputWrap, { borderColor: colors.borderPrimary, backgroundColor: colors.bgTertiary }]}>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, fontFamily: 'ComicNeue-Regular' }]}
                    value={usernameInput}
                    onChangeText={setUsernameInput}
                    placeholder="Enter username"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity 
                    style={[styles.saveBtn, { backgroundColor: usernameInput !== (user?.username || user?.firstName) ? colors.accentGold : colors.bgSecondary }]}
                    disabled={usernameInput === (user?.username || user?.firstName) || isUpdatingProfile}
                    onPress={handleUpdateProfile}
                  >
                    {isUpdatingProfile ? (
                      <ActivityIndicator size="small" color="#1a1400" />
                    ) : (
                      <Text style={[styles.saveBtnText, { color: usernameInput !== (user?.username || user?.firstName) ? '#1a1400' : colors.textMuted }]}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
              
              <View style={styles.listRow}>
                <Shield size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Allow DMs from Anyone</Text>
                  <Text style={[styles.rowDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Receive direct messages from non-members</Text>
                </View>
                <Switch 
                  value={privacy.allowDms} 
                  onValueChange={(v) => { Haptics.selectionAsync(); setPrivacy(p => ({ ...p, allowDms: v })); }} 
                  trackColor={{ true: colors.accentGold }} 
                />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>Theme</Text>
            <Text style={[styles.sectionDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Customize the look and feel of NexTalk.</Text>
            
            <View style={styles.themeGrid}>
              {[
                { id: 'system', label: 'System Sync', icon: Monitor },
                { id: 'light', label: 'Warm Linen', icon: Sun },
                { id: 'dark', label: 'Deep Obsidian', icon: Moon },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  activeOpacity={0.8}
                  onPress={() => { Haptics.selectionAsync(); setTheme(t.id as any); }}
                  style={[
                    styles.themeCard,
                    { backgroundColor: colors.bgSecondary, borderColor: colors.borderPrimary },
                    theme === t.id && { borderColor: colors.accentGold, backgroundColor: colors.accentGoldDim },
                  ]}
                >
                  <t.icon size={24} color={theme === t.id ? colors.accentGold : colors.textMuted} />
                  <Text style={[styles.themeLabel, { color: theme === t.id ? colors.accentGold : colors.textSecondary, fontFamily: 'Fredoka-SemiBold' }]}>{t.label}</Text>
                  {theme === t.id && <Check size={16} color={colors.accentGold} style={{ marginTop: 8 }} />}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>Notifications</Text>
            <Text style={[styles.sectionDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Manage how and when you receive alerts.</Text>

            <View style={[styles.listCard, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}>
              <View style={styles.listRow}>
                <Monitor size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Push Notifications</Text>
                  <Text style={[styles.rowDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Receive alerts on this device</Text>
                </View>
                <Switch value={notifs.desktop} onValueChange={(v) => { Haptics.selectionAsync(); setNotifs(p => ({ ...p, desktop: v })); }} trackColor={{ true: colors.accentGold }} />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
              <View style={styles.listRow}>
                <Volume2 size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Sound Alerts</Text>
                  <Text style={[styles.rowDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Play a sound for messages</Text>
                </View>
                <Switch value={notifs.sound} onValueChange={(v) => { Haptics.selectionAsync(); setNotifs(p => ({ ...p, sound: v })); }} trackColor={{ true: colors.accentGold }} />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
              <View style={styles.listRow}>
                <BellOff size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Mute All</Text>
                  <Text style={[styles.rowDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Pause notifications temporarily</Text>
                </View>
                <Switch value={notifs.muteAll} onValueChange={(v) => { Haptics.selectionAsync(); setNotifs(p => ({ ...p, muteAll: v })); }} trackColor={{ true: colors.accentGold }} />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>Privacy & Security</Text>
            <Text style={[styles.sectionDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Control your visibility and message security.</Text>

            <View style={[styles.listCard, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}>
              <View style={styles.listRow}>
                <Eye size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Show Online Status</Text>
                  <Text style={[styles.rowDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Let others see when active</Text>
                </View>
                <Switch value={privacy.onlineStatus} onValueChange={(v) => { Haptics.selectionAsync(); setPrivacy(p => ({ ...p, onlineStatus: v })); }} trackColor={{ true: colors.accentGold }} />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
              <View style={styles.listRow}>
                <Check size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Read Receipts</Text>
                  <Text style={[styles.rowDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Show when you read a message</Text>
                </View>
                <Switch value={privacy.readReceipts} onValueChange={(v) => { Haptics.selectionAsync(); setPrivacy(p => ({ ...p, readReceipts: v })); }} trackColor={{ true: colors.accentGold }} />
              </View>
            </View>

            <Text style={[styles.subTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>End-to-End Encryption</Text>
            <View style={[styles.listCard, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}>
              <View style={styles.listRow}>
                <Lock size={18} color={colors.accentGold} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Encryption Keys</Text>
                  <Text style={[styles.rowDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Your DMs are secured.</Text>
                </View>
                <TouchableOpacity style={[styles.btnSmall, { backgroundColor: colors.accentGoldDim, borderColor: colors.accentGold }]}>
                  <Text style={{ color: colors.accentGold, fontSize: 12, fontWeight: '700' }}>Export</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Language Tab */}
        {activeTab === 'language' && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: 'Fredoka-Bold' }]}>Language & Region</Text>
            <Text style={[styles.sectionDesc, { color: colors.textTertiary, fontFamily: 'ComicNeue-Regular' }]}>Customize your locale preferences.</Text>

            <View style={[styles.listCard, { backgroundColor: colors.cardBg, borderColor: colors.borderPrimary }]}>
              <TouchableOpacity style={styles.listRow}>
                <Globe size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Display Language</Text>
                </View>
                <Text style={{ color: colors.textMuted, marginRight: 8, fontSize: 14 }}>English (US)</Text>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: colors.borderPrimary }]} />
              <TouchableOpacity style={styles.listRow}>
                <Clock size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: 'ComicNeue-Bold' }]}>Time Format</Text>
                </View>
                <Text style={{ color: colors.textMuted, marginRight: 8, fontSize: 14 }}>12-hour</Text>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 22, letterSpacing: -0.5 },
  profileEmail: { fontSize: 14, marginTop: 2 },
  logoutBtn: { padding: 10, borderRadius: 12 },
  
  tabBar: { borderBottomWidth: 1 },
  tabScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: 'transparent',
  },
  tabText: { fontSize: 13 },
  
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 24, marginBottom: 4 },
  sectionDesc: { fontSize: 14, marginBottom: 24 },
  subTitle: { fontSize: 18, marginTop: 24, marginBottom: 12 },

  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeCard: {
    width: '48%', alignItems: 'center', paddingVertical: 24,
    borderRadius: 16, borderWidth: 1.5,
  },
  themeLabel: { fontSize: 15, marginTop: 12 },

  listCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowLabel: { fontSize: 15, marginBottom: 2 },
  rowDesc: { fontSize: 13 },
  divider: { height: 1, marginHorizontal: 16 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  
  // Account Form
  inputWrap: {
    flexDirection: 'row',
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  saveBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: 'Fredoka-Medium',
  },
});
