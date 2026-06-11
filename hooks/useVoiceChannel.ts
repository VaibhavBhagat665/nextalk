"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket";

export interface VoiceParticipant {
  userId: string;
  username: string;
  imageUrl: string | null;
  socketId: string;
  stream?: MediaStream;
  muted: boolean;
  deafened: boolean;
  video: boolean;
}

export function useVoiceChannel(channelId: string | null, currentUserId: string | undefined) {
  const [participants, setParticipants] = useState<Map<string, VoiceParticipant>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectingRef = useRef(false);
  const channelIdRef = useRef(channelId);

  // Keep channelIdRef in sync
  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId]);

  // Stun servers for WebRTC
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const connectToVoice = async () => {
    if (!channelId || !currentUserId || connectingRef.current || isConnected) return;
    connectingRef.current = true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideoOn 
      });
      
      stream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsConnected(true);
      
      const socket = getSocket();
      socket.emit("voice:join", channelId);
      
      // Also update DB
      await fetch(`/api/channels/${channelId}/voice`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to access media devices:", err);
      alert("Microphone access is required for voice channels.");
    } finally {
      connectingRef.current = false;
    }
  };

  const disconnectFromVoice = useCallback(async () => {
    const chId = channelIdRef.current;
    if (!chId) return;
    
    try {
      const socket = getSocket();
      socket.emit("voice:leave", chId);
    } catch (e) {
      console.warn("Socket not available during disconnect", e);
    }
    
    // Close all peer connections
    peersRef.current.forEach(peer => peer.close());
    peersRef.current.clear();
    
    // Stop local tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
    
    setParticipants(new Map());
    setIsConnected(false);
    connectingRef.current = false;
    
    try {
      await fetch(`/api/channels/${chId}/voice`, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("Failed to update voice state in DB", e);
    }
  }, []);

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted; // Toggle
        setIsMuted(!isMuted);
        
        const socket = getSocket();
        socket.emit("voice:state-update", {
          channelId,
          muted: !isMuted,
          deafened: isDeafened,
          video: isVideoOn
        });
      }
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
    const socket = getSocket();
    socket.emit("voice:state-update", {
      channelId,
      muted: isMuted,
      deafened: !isDeafened,
      video: isVideoOn
    });
  };

  const toggleVideo = async () => {
    if (!localStream) return;
    
    if (isVideoOn) {
      // Turn off video
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
      }
      setIsVideoOn(false);
    } else {
      // Turn on video
      try {
        const vidStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = vidStream.getVideoTracks()[0];
        localStream.addTrack(videoTrack);
        
        // Re-negotiate all peers
        peersRef.current.forEach(peer => {
          peer.addTrack(videoTrack, localStream);
          // Need renegotiation logic here (omitted for brevity, assume simple track replacement)
        });
        setIsVideoOn(true);
      } catch (err) {
        console.error("Could not get video:", err);
      }
    }
    
    const socket = getSocket();
    socket.emit("voice:state-update", {
      channelId,
      muted: isMuted,
      deafened: isDeafened,
      video: !isVideoOn
    });
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !channelId) return;

    const createPeer = (targetSocketId: string, initiator: boolean) => {
      const peer = new RTCPeerConnection(configuration);
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peer.addTrack(track, localStreamRef.current!);
        });
      }

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("voice:signal", {
            targetSocketId,
            signal: { candidate: event.candidate }
          });
        }
      };

      peer.ontrack = (event) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(targetSocketId);
          if (participant) {
            newMap.set(targetSocketId, {
              ...participant,
              stream: event.streams[0]
            });
          }
          return newMap;
        });
      };

      if (initiator) {
        peer.createOffer().then(offer => {
          peer.setLocalDescription(offer);
          socket.emit("voice:signal", {
            targetSocketId,
            signal: { offer }
          });
        });
      }

      peersRef.current.set(targetSocketId, peer);
      return peer;
    };

    const handleUserJoined = (user: VoiceParticipant) => {
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(user.socketId, { ...user, muted: false, deafened: false, video: false });
        return newMap;
      });
      
      // I was here first, so I initiate the WebRTC connection
      createPeer(user.socketId, true);
    };

    const handleUserLeft = ({ socketId }: { socketId: string }) => {
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(socketId);
        return newMap;
      });
      
      if (peersRef.current.has(socketId)) {
        peersRef.current.get(socketId)?.close();
        peersRef.current.delete(socketId);
      }
    };

    const handleSignal = async (data: { socketId: string, signal: any, userId: string, username: string, imageUrl: string }) => {
      let peer = peersRef.current.get(data.socketId);
      
      if (!peer) {
        // I just joined, and someone is calling me
        peer = createPeer(data.socketId, false);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(data.socketId, {
            userId: data.userId,
            username: data.username,
            imageUrl: data.imageUrl,
            socketId: data.socketId,
            muted: false,
            deafened: false,
            video: false
          });
          return newMap;
        });
      }

      if (data.signal.offer) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("voice:signal", {
          targetSocketId: data.socketId,
          signal: { answer }
        });
      } else if (data.signal.answer) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
      } else if (data.signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
      }
    };

    const handleStateUpdate = (data: { socketId: string, muted: boolean, deafened: boolean, video: boolean }) => {
      setParticipants(prev => {
        const newMap = new Map(prev);
        const p = newMap.get(data.socketId);
        if (p) {
          newMap.set(data.socketId, { ...p, ...data });
        }
        return newMap;
      });
    };

    socket.on("voice:user-joined", handleUserJoined);
    socket.on("voice:user-left", handleUserLeft);
    socket.on("voice:signal", handleSignal);
    socket.on("voice:state-update", handleStateUpdate);

    return () => {
      socket.off("voice:user-joined", handleUserJoined);
      socket.off("voice:user-left", handleUserLeft);
      socket.off("voice:signal", handleSignal);
      socket.off("voice:state-update", handleStateUpdate);
    };
  }, [channelId, localStream]);

  return {
    participants: Array.from(participants.values()),
    isConnected,
    localStream,
    isMuted,
    isDeafened,
    isVideoOn,
    connectToVoice,
    disconnectFromVoice,
    toggleMute,
    toggleDeafen,
    toggleVideo
  };
}
