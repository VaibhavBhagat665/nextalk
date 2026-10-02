/**
 * UserContextMenu Component
 * 
 * Context menu for user actions when right-clicking on avatar/username:
 * - View profile
 * - Send message (DM)
 * - Start voice call
 * - Start video call
 * - Mute user (if permission)
 * - Kick user (if permission)
 */

"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  User,
  MessageSquare,
  Phone,
  Video,
  Volume2,
  VolumeX,
  UserX,
  Shield,
} from "lucide-react";

interface UserContextMenuProps {
  userId: string;
  username: string;
  isCurrentUser?: boolean;
  canModerate?: boolean;
  isMuted?: boolean;
  onViewProfile?: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onVoiceCall?: (userId: string) => void;
  onVideoCall?: (userId: string) => void;
  onMute?: (userId: string) => void;
  onKick?: (userId: string) => void;
  children: React.ReactNode;
}

export default function UserContextMenu({
  userId,
  username,
  isCurrentUser = false,
  canModerate = false,
  isMuted = false,
  onViewProfile,
  onMessage,
  onVoiceCall,
  onVideoCall,
  onMute,
  onKick,
  children,
}: UserContextMenuProps) {
  // Don't show context menu for current user's own actions
  if (isCurrentUser) {
    return <>{children}</>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          onContextMenu={(e) => {
            e.preventDefault();
          }}
          className="user-context-trigger"
        >
          {children}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {onViewProfile && (
          <DropdownMenuItem onClick={() => onViewProfile(userId)}>
            <User size={14} className="mr-2" />
            View Profile
          </DropdownMenuItem>
        )}

        {onMessage && (
          <DropdownMenuItem onClick={() => onMessage(userId)}>
            <MessageSquare size={14} className="mr-2" />
            Send Message
          </DropdownMenuItem>
        )}

        {(onVoiceCall || onVideoCall) && <DropdownMenuSeparator />}

        {onVoiceCall && (
          <DropdownMenuItem onClick={() => onVoiceCall(userId)}>
            <Phone size={14} className="mr-2" />
            Voice Call
          </DropdownMenuItem>
        )}

        {onVideoCall && (
          <DropdownMenuItem onClick={() => onVideoCall(userId)}>
            <Video size={14} className="mr-2" />
            Video Call
          </DropdownMenuItem>
        )}

        {canModerate && (onMute || onKick) && <DropdownMenuSeparator />}

        {canModerate && onMute && (
          <DropdownMenuItem
            onClick={() => onMute(userId)}
            className="text-orange-500 focus:text-orange-500"
          >
            {isMuted ? (
              <>
                <Volume2 size={14} className="mr-2" />
                Unmute {username}
              </>
            ) : (
              <>
                <VolumeX size={14} className="mr-2" />
                Mute {username}
              </>
            )}
          </DropdownMenuItem>
        )}

        {canModerate && onKick && (
          <DropdownMenuItem
            onClick={() => onKick(userId)}
            className="text-red-500 focus:text-red-500"
          >
            <UserX size={14} className="mr-2" />
            Kick {username}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>

      <style jsx>{`
        .user-context-trigger {
          display: contents;
        }
      `}</style>
    </DropdownMenu>
  );
}
