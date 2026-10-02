/**
 * UserProfilePopover Component
 * 
 * Displays user profile information in a popover when clicking on avatar/username.
 * Shows:
 * - Banner (if exists)
 * - Avatar
 * - Username
 * - Bio/Status message
 * - Roles (if any)
 * - Mutual servers
 * - Quick action buttons (Message, Call)
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";
import { MessageSquare, Phone, Video, Shield, Users, Loader2 } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface UserProfile {
  id: string;
  username: string;
  imageUrl: string | null;
  statusMessage: string | null;
  allowDmsFromNonMembers: boolean;
  x25519PublicKey: string | null;
  roles?: string[];
  mutualServers?: { id: string; name: string }[];
}

interface UserProfilePopoverProps {
  userId: string;
  username: string;
  imageUrl?: string | null;
  isCurrentUser?: boolean;
  onMessage?: (userId: string) => void;
  onVoiceCall?: (userId: string) => void;
  onVideoCall?: (userId: string) => void;
  onViewFullProfile?: (userId: string) => void;
  children: React.ReactNode;
}

export default function UserProfilePopover({
  userId,
  username,
  imageUrl,
  isCurrentUser = false,
  onMessage,
  onVoiceCall,
  onVideoCall,
  onViewFullProfile,
  children,
}: UserProfilePopoverProps) {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // Fetch full profile data when popover opens
  React.useEffect(() => {
    if (open && !profile && !loading) {
      setLoading(true);
      fetch(`/api/users/${userId}/profile`)
        .then((res) => res.json())
        .then((data) => {
          setProfile(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch profile:", error);
          setLoading(false);
        });
    }
  }, [open, userId, profile, loading]);

  const handleMessage = () => {
    setOpen(false);
    if (onMessage) {
      onMessage(userId);
    } else {
      router.push(`/dm/${userId}`);
    }
  };

  const handleVoiceCall = () => {
    setOpen(false);
    if (onVoiceCall) {
      onVoiceCall(userId);
    }
  };

  const handleVideoCall = () => {
    setOpen(false);
    if (onVideoCall) {
      onVideoCall(userId);
    }
  };

  const handleViewFull = () => {
    setOpen(false);
    if (onViewFullProfile) {
      onViewFullProfile(userId);
    }
  };

  // Don't show popover for current user
  if (isCurrentUser) {
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        {/* Banner */}
        <div className="banner" />

        {/* Profile Content */}
        <div className="profile-content">
          {/* Avatar */}
          <div className="avatar-wrapper">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={username}
                className="avatar-image"
              />
            ) : (
              <div className="avatar-fallback">
                {getInitials(username)}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="user-info">
            <h3 className="username">{username}</h3>
            {loading ? (
              <div className="loading-state">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading...</span>
              </div>
            ) : profile?.statusMessage ? (
              <p className="status-message">{profile.statusMessage}</p>
            ) : null}
          </div>

          {/* Divider */}
          <div className="divider" />

          {/* About Section */}
          {profile && (
            <div className="about-section">
              <div className="about-label">About</div>
              {profile.statusMessage ? (
                <p className="about-text">{profile.statusMessage}</p>
              ) : (
                <p className="about-text empty">No bio set</p>
              )}
            </div>
          )}

          {/* Roles Section */}
          {profile && profile.roles && profile.roles.length > 0 && (
            <div className="roles-section">
              <div className="about-label">Roles</div>
              <div className="roles-list">
                {profile.roles.map((role, idx) => (
                  <div key={idx} className="role-badge">
                    <Shield size={11} />
                    <span>{role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mutual Servers Section */}
          {profile && profile.mutualServers && profile.mutualServers.length > 0 && (
            <div className="mutual-servers-section">
              <div className="about-label">
                <Users size={11} className="inline mr-1" />
                {profile.mutualServers.length} Mutual Server{profile.mutualServers.length !== 1 ? 's' : ''}
              </div>
              <div className="servers-list">
                {profile.mutualServers.slice(0, 3).map((server) => (
                  <div key={server.id} className="server-item">
                    {server.name}
                  </div>
                ))}
                {profile.mutualServers.length > 3 && (
                  <div className="server-item more">
                    +{profile.mutualServers.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="actions">
            {profile?.allowDmsFromNonMembers !== false && onMessage && (
              <button onClick={handleMessage} className="action-button primary">
                <MessageSquare size={16} />
                <span>Message</span>
              </button>
            )}

            {onVoiceCall && (
              <button onClick={handleVoiceCall} className="action-button">
                <Phone size={16} />
              </button>
            )}

            {onVideoCall && (
              <button onClick={handleVideoCall} className="action-button">
                <Video size={16} />
              </button>
            )}
          </div>

          {/* View Full Profile Link */}
          {onViewFullProfile && (
            <button onClick={handleViewFull} className="view-full-link">
              View Full Profile
            </button>
          )}
        </div>

        <style jsx>{`
          .banner {
            height: 60px;
            background: linear-gradient(135deg, rgba(212, 162, 60, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
            border-radius: 8px 8px 0 0;
          }

          .profile-content {
            padding: 12px 16px 16px;
            position: relative;
          }

          .avatar-wrapper {
            position: absolute;
            top: -30px;
            left: 16px;
            width: 64px;
            height: 64px;
            border: 4px solid var(--bg-elevated);
            border-radius: 50%;
            background: var(--bg-elevated);
          }

          .avatar-image {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
          }

          .avatar-fallback {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: linear-gradient(135deg, #d4a23c 0%, #fceb9e 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 700;
            color: #1a1400;
          }

          .user-info {
            margin-top: 40px;
            margin-bottom: 12px;
          }

          .username {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0 0 4px 0;
            letter-spacing: -0.02em;
          }

          .status-message {
            font-size: 13px;
            color: var(--text-secondary);
            margin: 0;
            line-height: 1.4;
          }

          .loading-state {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--text-muted);
          }

          .divider {
            height: 1px;
            background: var(--border-primary);
            margin: 12px 0;
          }

          .about-section {
            margin-bottom: 12px;
          }

          .about-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-tertiary);
            margin-bottom: 6px;
          }

          .about-text {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin: 0;
          }

          .about-text.empty {
            color: var(--text-muted);
            font-style: italic;
          }

          .roles-section {
            margin-bottom: 12px;
          }

          .roles-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .role-badge {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: var(--accent-gold-dim);
            border: 1px solid rgba(212, 162, 60, 0.2);
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            color: var(--accent-gold);
          }

          .mutual-servers-section {
            margin-bottom: 12px;
          }

          .servers-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .server-item {
            padding: 6px 10px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-primary);
            border-radius: 6px;
            font-size: 12px;
            color: var(--text-secondary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .server-item.more {
            color: var(--text-muted);
            font-style: italic;
            text-align: center;
          }

          .actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
          }

          .action-button {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .action-button:hover {
            background: var(--bg-hover);
            border-color: var(--accent-gold);
            color: var(--text-primary);
          }

          .action-button.primary {
            background: var(--accent-gold);
            border-color: var(--accent-gold);
            color: #1a1400;
          }

          .action-button.primary:hover {
            background: #c59537;
            border-color: #c59537;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(212, 162, 60, 0.3);
          }

          .view-full-link {
            width: 100%;
            padding: 8px;
            margin-top: 8px;
            background: none;
            border: none;
            color: var(--accent-gold);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            border-radius: 6px;
            transition: all 0.2s ease;
          }

          .view-full-link:hover {
            background: var(--accent-gold-dim);
            color: var(--accent-gold);
          }
        `}</style>
      </PopoverContent>
    </Popover>
  );
}
