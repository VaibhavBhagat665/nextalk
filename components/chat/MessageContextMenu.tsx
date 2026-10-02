/**
 * MessageContextMenu Component
 * 
 * Context menu for message actions:
 * - Reply to message
 * - React to message
 * - Edit message (if own message)
 * - Delete message (if own message)
 * - Pin message (if permission)
 * - Copy message link
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
  Reply,
  Smile,
  Edit,
  Trash2,
  Pin,
  Link2,
  Copy,
  MoreVertical,
} from "lucide-react";

interface MessageContextMenuProps {
  messageId: string;
  isOwnMessage: boolean;
  isPinned?: boolean;
  canPin?: boolean;
  onReply?: (messageId: string) => void;
  onReact?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onCopyLink?: (messageId: string) => void;
  children?: React.ReactNode;
  trigger?: "click" | "contextmenu";
}

export default function MessageContextMenu({
  messageId,
  isOwnMessage,
  isPinned = false,
  canPin = false,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onCopyLink,
  children,
  trigger = "contextmenu",
}: MessageContextMenuProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = () => {
    if (onCopyLink) {
      onCopyLink(messageId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // If using contextmenu trigger, wrap children in a div to capture right-click
  const content = trigger === "contextmenu" ? (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      className="message-context-trigger"
    >
      {children}
    </div>
  ) : (
    children
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {content || (
          <button className="context-menu-button">
            <MoreVertical size={16} />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {onReply && (
          <DropdownMenuItem onClick={() => onReply(messageId)}>
            <Reply size={14} className="mr-2" />
            Reply
          </DropdownMenuItem>
        )}

        {onReact && (
          <DropdownMenuItem onClick={() => onReact(messageId)}>
            <Smile size={14} className="mr-2" />
            Add Reaction
          </DropdownMenuItem>
        )}

        {isOwnMessage && onEdit && (
          <DropdownMenuItem onClick={() => onEdit(messageId)}>
            <Edit size={14} className="mr-2" />
            Edit Message
          </DropdownMenuItem>
        )}

        {canPin && onPin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onPin(messageId)}>
              <Pin size={14} className="mr-2" />
              {isPinned ? "Unpin Message" : "Pin Message"}
            </DropdownMenuItem>
          </>
        )}

        {onCopyLink && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCopyLink}>
              {copied ? (
                <>
                  <Copy size={14} className="mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Link2 size={14} className="mr-2" />
                  Copy Message Link
                </>
              )}
            </DropdownMenuItem>
          </>
        )}

        {isOwnMessage && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(messageId)}
              className="text-red-500 focus:text-red-500"
            >
              <Trash2 size={14} className="mr-2" />
              Delete Message
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      <style jsx>{`
        .message-context-trigger {
          display: contents;
        }

        .context-menu-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .context-menu-button:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </DropdownMenu>
  );
}
