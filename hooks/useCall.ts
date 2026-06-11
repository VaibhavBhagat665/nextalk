"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getSocket } from "@/lib/socket";

interface CallState {
  status: "idle" | "calling" | "ringing" | "connecting" | "active" | "ended";
  type: "voice" | "video";
  remoteUser: { userId: string; username: string; imageUrl: string } | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  duration: number;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useCall(currentUserId: string | null | undefined) {
  const [callState, setCallState] = useState<CallState>({
    status: "idle",
    type: "voice",
    remoteUser: null,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoOff: false,
    duration: 0,
  });

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const targetUserRef = useRef<string | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup media streams
  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    peerConnection.current?.close();
    peerConnection.current = null;
    if (durationInterval.current) clearInterval(durationInterval.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    targetUserRef.current = null;
  }, []);

  // Reset to idle
  const resetCall = useCallback(() => {
    cleanupMedia();
    setCallState({
      status: "idle",
      type: "voice",
      remoteUser: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoOff: false,
      duration: 0,
    });
  }, [cleanupMedia]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && targetUserRef.current) {
        const socket = getSocket();
        socket.emit("call:ice-candidate", {
          targetUserId: targetUserRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      remoteStreamRef.current = stream;
      setCallState((prev) => ({ ...prev, remoteStream: stream }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        setCallState((prev) => ({ ...prev, status: "active" }));
        // Start duration timer
        durationInterval.current = setInterval(() => {
          setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
        }, 1000);
      }
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        resetCall();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [resetCall]);

  // Get user media
  const getMedia = useCallback(async (type: "voice" | "video") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("Failed to get media:", err);
      return null;
    }
  }, []);

  // Initiate a call
  const initiateCall = useCallback(
    async (targetUser: { userId: string; username: string; imageUrl: string }, type: "voice" | "video") => {
      const socket = getSocket();
      if (!socket?.connected || !currentUserId) return;

      targetUserRef.current = targetUser.userId;

      // Get local media
      const stream = await getMedia(type);
      if (!stream) return;

      // Create peer connection and add tracks
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      setCallState({
        status: "calling",
        type,
        remoteUser: targetUser,
        localStream: stream,
        remoteStream: null,
        isMuted: false,
        isVideoOff: false,
        duration: 0,
      });

      // Set timeout for 30 seconds
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        resetCall();
        socket.emit("call:reject", { targetUserId: targetUser.userId }); // Notify other side it timed out
      }, 30000);

      // Signal the other user
      socket.emit("call:initiate", {
        targetUserId: targetUser.userId,
        type,
      });

      // Log the call
      fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calleeId: targetUser.userId, type }),
      }).catch(console.error);
    },
    [currentUserId, getMedia, createPeerConnection]
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    const socket = getSocket();
    if (!callState.remoteUser) return;

    targetUserRef.current = callState.remoteUser.userId;

    const stream = await getMedia(callState.type);
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    setCallState((prev) => ({
      ...prev,
      status: "connecting",
      localStream: stream,
    }));

    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);

    socket.emit("call:accept", {
      targetUserId: callState.remoteUser.userId,
    });
  }, [callState.remoteUser, callState.type, getMedia, createPeerConnection]);

  // Decline incoming call
  const declineCall = useCallback(() => {
    const socket = getSocket();
    if (callState.remoteUser) {
      socket.emit("call:reject", {
        targetUserId: callState.remoteUser.userId,
      });
    }
    resetCall();
  }, [callState.remoteUser, resetCall]);

  // End active call
  const endCall = useCallback(() => {
    const socket = getSocket();
    if (targetUserRef.current) {
      socket.emit("call:end", {
        targetUserId: targetUserRef.current,
      });
    }
    resetCall();
  }, [resetCall]);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setCallState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));
      
      const socket = getSocket();
      if (targetUserRef.current) {
        socket.emit("call:toggle-media", {
          targetUserId: targetUserRef.current,
          type: "mic",
          enabled: audioTrack.enabled,
        });
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCallState((prev) => ({ ...prev, isVideoOff: !videoTrack.enabled }));
      
      const socket = getSocket();
      if (targetUserRef.current) {
        socket.emit("call:toggle-media", {
          targetUserId: targetUserRef.current,
          type: "video",
          enabled: videoTrack.enabled,
        });
      }
    }
  }, []);

  // Listen for socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Incoming call
    const handleIncoming = (data: {
      callerId: string;
      callerUsername: string;
      callerImageUrl: string;
      type: "voice" | "video";
    }) => {
      if (callState.status !== "idle") return; // Already in a call

      setCallState({
        status: "ringing",
        type: data.type,
        remoteUser: {
          userId: data.callerId,
          username: data.callerUsername,
          imageUrl: data.callerImageUrl,
        },
        localStream: null,
        remoteStream: null,
        isMuted: false,
        isVideoOff: false,
        duration: 0,
      });
    };

    // Call accepted — create offer
    const handleAccepted = async () => {
      const pc = peerConnection.current;
      if (!pc) return;

      setCallState((prev) => ({ ...prev, status: "connecting" }));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:offer", {
        targetUserId: targetUserRef.current,
        offer,
      });
    };

    // Receive offer — create answer
    const handleOffer = async (data: { senderId: string; offer: RTCSessionDescriptionInit }) => {
      const pc = peerConnection.current;
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", {
        targetUserId: data.senderId,
        answer,
      });
    };

    // Receive answer
    const handleAnswer = async (data: { senderId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnection.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    };

    // ICE candidate
    const handleIceCandidate = async (data: { senderId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnection.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    };

    // Call rejected
    const handleRejected = () => {
      resetCall();
    };

    // Call ended by remote
    const handleEnded = () => {
      resetCall();
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
    };
  }, [callState.status, resetCall]);

  return {
    callState,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMic,
    toggleVideo,
  };
}
