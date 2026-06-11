import {
  Hash,
  Code,
  Music,
  Gamepad2,
  Megaphone,
  Briefcase,
  Palette,
  BookOpen,
  Rocket,
  Shield,
  Heart,
  Zap,
  Globe,
  Camera,
  Coffee,
  Film,
  type LucideIcon,
} from "lucide-react";

export interface ChannelIconOption {
  id: string;
  icon: LucideIcon;
  label: string;
}

/**
 * Curated set of channel icons — no emojis, all Lucide.
 */
export const CHANNEL_ICONS: ChannelIconOption[] = [
  { id: "#", icon: Hash, label: "Default" },
  { id: "code", icon: Code, label: "Code" },
  { id: "music", icon: Music, label: "Music" },
  { id: "gaming", icon: Gamepad2, label: "Gaming" },
  { id: "announcements", icon: Megaphone, label: "Announcements" },
  { id: "work", icon: Briefcase, label: "Work" },
  { id: "design", icon: Palette, label: "Design" },
  { id: "learning", icon: BookOpen, label: "Learning" },
  { id: "projects", icon: Rocket, label: "Projects" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "social", icon: Heart, label: "Social" },
  { id: "random", icon: Zap, label: "Random" },
  { id: "global", icon: Globe, label: "Global" },
  { id: "media", icon: Camera, label: "Media" },
  { id: "lounge", icon: Coffee, label: "Lounge" },
  { id: "entertainment", icon: Film, label: "Entertainment" },
];

/**
 * Lookup map for quick icon resolution by ID.
 */
const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CHANNEL_ICONS.map((opt) => [opt.id, opt.icon])
);

/**
 * Returns the Lucide icon component for a given channel icon ID.
 * Falls back to Hash if the icon ID is unknown.
 */
export function getChannelIcon(iconId: string): LucideIcon {
  return ICON_MAP[iconId] || Hash;
}
