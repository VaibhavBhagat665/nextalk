"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

interface OnlineUser {
  userId: string;
  username: string;
  imageUrl: string;
}

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const handlePresenceUpdate = (users: OnlineUser[]) => {
      setOnlineUsers(users);
    };

    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, []);

  return { onlineUsers };
}
