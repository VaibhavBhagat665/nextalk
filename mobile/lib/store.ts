import { create } from 'zustand';
import { ThemeColors, darkTheme, lightTheme } from './theme';

// ── App Store ──
interface AppState {
  // Theme
  theme: 'dark' | 'light' | 'system';
  colors: ThemeColors;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleTheme: () => void;

  // Navigation state
  activeServerId: string | null;
  setActiveServerId: (id: string | null) => void;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;

  // Online users
  onlineUsers: string[];
  setOnlineUsers: (users: string[]) => void;

  // Typing
  typingUsers: Map<string, string[]>; // channelId -> usernames[]
  setTypingUsers: (channelId: string, users: string[]) => void;

  // Unread counts
  unreadCounts: Map<string, number>;
  setUnreadCount: (channelId: string, count: number) => void;
  clearUnreadCount: (channelId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'dark',
  colors: darkTheme,
  setTheme: (theme) => set({ theme, colors: theme === 'light' ? lightTheme : darkTheme }),
  toggleTheme: () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    set({ theme: next, colors: next === 'dark' ? darkTheme : lightTheme });
  },

  activeServerId: null,
  setActiveServerId: (id) => set({ activeServerId: id, activeChannelId: null }),
  activeChannelId: null,
  setActiveChannelId: (id) => set({ activeChannelId: id }),

  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),

  typingUsers: new Map(),
  setTypingUsers: (channelId, users) => {
    const map = new Map(get().typingUsers);
    map.set(channelId, users);
    set({ typingUsers: map });
  },

  unreadCounts: new Map(),
  setUnreadCount: (channelId, count) => {
    const map = new Map(get().unreadCounts);
    map.set(channelId, count);
    set({ unreadCounts: map });
  },
  clearUnreadCount: (channelId) => {
    const map = new Map(get().unreadCounts);
    map.delete(channelId);
    set({ unreadCounts: map });
  },
}));
