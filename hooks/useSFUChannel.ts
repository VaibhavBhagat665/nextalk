/**
 * SFU Voice Channel Hook
 * 
 * Implements SFU-based voice/video calling using mediasoup.
 * Replaces mesh WebRTC topology with centralized media routing through SFU.
 * 
 * Task 20.2: Implement SFU connection flow
 * Requirements: 3.4, 3.5
 * Validates: Property 6 (SFU Media Routing), Property 7 (Consumer Symmetry)
 * 
 * Architecture:
 * - Device: Load router RTP capabilities
 * - Transports: Create send/receive transports
 * - Producers: Produce local audio/video tracks
 * - Consumers: Consume remote tracks from other participants
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { MediasoupClient } from "@/lib/mediasoup-client";
import { getIceServers } from "@/lib/turn-config";
import type { Producer, Consumer, Transport } from "mediasoup-client/lib/types";

export interface SFUParticipant {
  userId: string;
  username: string;
  imageUrl: string | null;
  socketId: string;
  producers: Map<string, { id: string; kind: "audio" | "video" }>;
  consumers: Map<string, Consumer>;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isVisible?: boolean; // Track if participant video is visible on screen
  audioLevel?: number; // Audio level for speaking detection
}

export interface UseSFUChannelReturn {
  // State
  participants: SFUParticipant[];
  isConnected: boolean;
  isConnecting: boolean;
  localStream: MediaStream | null;
  
  // Controls
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;
  
  // Actions
  connectToSFU: () => Promise<void>;
  disconnectFromSFU: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => Promise<void>;
  setParticipantVisible: (userId: string, visible: boolean) => void;
  
  // Errors
  error: string | null;
}

export function useSFUChannel(
  channelId: string | null,
  currentUserId: string | undefined
): UseSFUChannelReturn {
  // State
  const [participants, setParticipants] = useState<Map<string, SFUParticipant>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Media controls
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  
  // Refs
  const mediasoupClient = useRef<MediasoupClient | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const audioProducerRef = useRef<Producer | null>(null);
  const videoProducerRef = useRef<Producer | null>(null);
  const connectingRef = useRef(false);
  
  /**
   * Connect to SFU room
   */
  const connectToSFU = useCallback(async () => {
    if (!channelId || !currentUserId || connectingRef.current || isConnected) {
      return;
    }
    
    connectingRef.current = true;
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log("🎬 Connecting to SFU channel:", channelId);
      
      // 1. Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false, // Start with audio only
      });
      
      stream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // 2. Initialize mediasoup client
      const client = new MediasoupClient();
      mediasoupClient.current = client;
      
      // Set up event handlers
      client.on("error", (err) => {
        console.error("❌ MediasoupClient error:", err);
        setError(err.message);
      });
      
      client.on("transportConnected", (transportId) => {
        console.log("✅ Transport connected:", transportId);
      });
      
      client.on("producerCreated", (producer) => {
        console.log("✅ Producer created:", producer.kind, producer.id);
      });
      
      client.on("consumerCreated", (consumer) => {
        console.log("✅ Consumer created:", consumer.kind, consumer.id);
        // Consumer will be added to participant in handleNewProducer
      });
      
      // 3. Join SFU room
      const socket = getSocket();
      
      const joinResult = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Join timeout")), 10000);
        
        socket.emit("sfu:join", { roomId: channelId }, (response: any) => {
          clearTimeout(timeout);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });
      
      roomIdRef.current = channelId;
      
      // 4. Load device with router RTP capabilities
      await client.loadDevice(joinResult.rtpCapabilities);
      
      // 5. Create send transport
      const sendTransportParams = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Create transport timeout")), 10000);
        
        socket.emit(
          "sfu:createTransport",
          { roomId: channelId, direction: "send" },
          (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          }
        );
      });
      
      // Add TURN servers to transport configuration
      const iceServers = getIceServers();
      sendTransportParams.iceServers = iceServers;
      
      const sendTransport = await client.createSendTransport(sendTransportParams);
      sendTransportRef.current = sendTransport;
      
      // Connect send transport
      sendTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await new Promise<void>((resolve, reject) => {
            socket.emit(
              "sfu:connectTransport",
              {
                roomId: channelId,
                transportId: sendTransport.id,
                dtlsParameters,
              },
              (response: any) => {
                if (response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve();
                }
              }
            );
          });
          callback();
        } catch (err: any) {
          errback(err);
        }
      });
      
      // Handle produce event
      sendTransport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const producerId = await new Promise<string>((resolve, reject) => {
            socket.emit(
              "sfu:produce",
              {
                roomId: channelId,
                transportId: sendTransport.id,
                kind,
                rtpParameters,
              },
              (response: any) => {
                if (response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve(response.producerId);
                }
              }
            );
          });
          callback({ id: producerId });
        } catch (err: any) {
          errback(err);
        }
      });
      
      // 6. Create receive transport
      const recvTransportParams = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Create transport timeout")), 10000);
        
        socket.emit(
          "sfu:createTransport",
          { roomId: channelId, direction: "recv" },
          (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          }
        );
      });
      
      // Add TURN servers to transport configuration
      recvTransportParams.iceServers = iceServers;
      
      const recvTransport = await client.createRecvTransport(recvTransportParams);
      recvTransportRef.current = recvTransport;
      
      // Connect receive transport
      recvTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await new Promise<void>((resolve, reject) => {
            socket.emit(
              "sfu:connectTransport",
              {
                roomId: channelId,
                transportId: recvTransport.id,
                dtlsParameters,
              },
              (response: any) => {
                if (response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve();
                }
              }
            );
          });
          callback();
        } catch (err: any) {
          errback(err);
        }
      });
      
      // 7. Produce local audio track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioProducer = await client.produce({ 
          track: audioTrack,
          appData: { source: 'microphone' }
        });
        audioProducerRef.current = audioProducer;
      }
      
      // 8. Consume existing participants
      if (joinResult.participants && joinResult.participants.length > 0) {
        console.log(`📡 Consuming ${joinResult.participants.length} existing participants`);
        
        for (const participant of joinResult.participants) {
          // Add participant to state
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(participant.userId, {
              userId: participant.userId,
              username: participant.username,
              imageUrl: null,
              socketId: participant.socketId,
              producers: new Map(
                participant.producers.map((p: any) => [p.id, { id: p.id, kind: p.kind }])
              ),
              consumers: new Map(),
              audioEnabled: true,
              videoEnabled: false,
            });
            return newMap;
          });
          
          // Consume each producer
          for (const producer of participant.producers) {
            await consumeProducer(client, socket, channelId, producer.id, participant.userId);
          }
        }
      }
      
      setIsConnected(true);
      console.log("✅ Successfully connected to SFU");
      
    } catch (err: any) {
      console.error("❌ Failed to connect to SFU:", err);
      setError(err.message || "Failed to connect to SFU");
      
      // Cleanup on error
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      
      if (mediasoupClient.current) {
        mediasoupClient.current.close();
        mediasoupClient.current = null;
      }
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, [channelId, currentUserId, isMuted, isConnected]);
  
  /**
   * Helper: Consume a producer from another participant
   */
  const consumeProducer = async (
    client: MediasoupClient,
    socket: any,
    roomId: string,
    producerId: string,
    participantUserId: string
  ) => {
    try {
      const consumerParams = await new Promise<any>((resolve, reject) => {
        socket.emit(
          "sfu:consume",
          {
            roomId,
            producerId,
            rtpCapabilities: client.rtpCapabilities,
          },
          (response: any) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          }
        );
      });
      
      const consumer = await client.consume(consumerParams);
      
      // Add consumer to participant
      setParticipants(prev => {
        const newMap = new Map(prev);
        const participant = newMap.get(participantUserId);
        if (participant) {
          participant.consumers.set(consumer.id, consumer);
        }
        return newMap;
      });
      
      return consumer;
    } catch (err: any) {
      console.error(`❌ Failed to consume producer ${producerId}:`, err);
    }
  };
  
  /**
   * Disconnect from SFU room
   */
  const disconnectFromSFU = useCallback(async () => {
    if (!roomIdRef.current) return;
    
    console.log("🛑 Disconnecting from SFU");
    
    try {
      const socket = getSocket();
      socket.emit("sfu:leave", { roomId: roomIdRef.current });
    } catch (err) {
      console.warn("Socket not available during disconnect", err);
    }
    
    // Close mediasoup client (closes all transports, producers, consumers)
    if (mediasoupClient.current) {
      mediasoupClient.current.close();
      mediasoupClient.current = null;
    }
    
    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    
    // Reset state
    setParticipants(new Map());
    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    roomIdRef.current = null;
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    audioProducerRef.current = null;
    videoProducerRef.current = null;
    connectingRef.current = false;
    
    console.log("✅ Disconnected from SFU");
  }, []);
  
  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (!audioProducerRef.current) return;
    
    const newMuted = !isMuted;
    
    if (newMuted) {
      audioProducerRef.current.pause();
    } else {
      audioProducerRef.current.resume();
    }
    
    setIsMuted(newMuted);
    console.log(`🎤 Audio ${newMuted ? "muted" : "unmuted"}`);
  }, [isMuted]);
  
  /**
   * Toggle deafen (stop receiving audio)
   */
  const toggleDeafen = useCallback(() => {
    const newDeafened = !isDeafened;
    
    // Pause/resume all audio consumers
    participants.forEach(participant => {
      participant.consumers.forEach(consumer => {
        if (consumer.kind === "audio") {
          if (newDeafened) {
            consumer.pause();
          } else {
            consumer.resume();
          }
        }
      });
    });
    
    setIsDeafened(newDeafened);
    console.log(`🔇 Audio ${newDeafened ? "deafened" : "undeafened"}`);
  }, [isDeafened, participants]);
  
  /**
   * Toggle video
   * Task 21.1: Enable simulcast for video production
   */
  const toggleVideo = useCallback(async () => {
    if (!mediasoupClient.current || !sendTransportRef.current) return;
    
    const newVideoOn = !isVideoOn;
    
    if (newVideoOn) {
      // Turn on video
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        }
        
        // Produce video track with simulcast enabled
        // Configure 3 spatial layers: low (320x180), mid (640x360), high (1280x720)
        const videoProducer = await mediasoupClient.current.produce({ 
          track: videoTrack,
          // @ts-ignore - encodings is valid but not in types
          encodings: [
            // Low quality layer (spatial layer 0)
            {
              rid: 'low',
              scaleResolutionDownBy: 4,
              maxBitrate: 150_000, // 150 kbps
              scalabilityMode: 'S1T3', // Single spatial layer, 3 temporal layers
            },
            // Medium quality layer (spatial layer 1)
            {
              rid: 'medium',
              scaleResolutionDownBy: 2,
              maxBitrate: 500_000, // 500 kbps
              scalabilityMode: 'S1T3',
            },
            // High quality layer (spatial layer 2)
            {
              rid: 'high',
              scaleResolutionDownBy: 1,
              maxBitrate: 1_500_000, // 1.5 Mbps
              scalabilityMode: 'S1T3',
            },
          ],
          // Codec preferences (VP8 for better simulcast support)
          codecOptions: {
            videoGoogleStartBitrate: 1000
          },
          appData: { source: 'camera', simulcast: true }
        });
        videoProducerRef.current = videoProducer;
        
        console.log("📹 Video turned on with simulcast (3 layers)");
        console.log("  - Low: 320x180 @ 150kbps");
        console.log("  - Mid: 640x360 @ 500kbps");
        console.log("  - High: 1280x720 @ 1.5Mbps");
        
        setIsVideoOn(true);
      } catch (err: any) {
        console.error("❌ Failed to turn on video:", err);
        setError("Failed to access camera");
      }
    } else {
      // Turn off video
      if (videoProducerRef.current) {
        const socket = getSocket();
        socket.emit("sfu:closeProducer", {
          roomId: roomIdRef.current,
          producerId: videoProducerRef.current.id,
        });
        
        mediasoupClient.current.closeProducer(videoProducerRef.current.id);
        videoProducerRef.current = null;
        
        // Stop video track
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.stop();
            localStreamRef.current.removeTrack(videoTrack);
          }
        }
        
        setIsVideoOn(false);
        console.log("📹 Video turned off");
      }
    }
  }, [isVideoOn]);
  
  /**
   * Set participant visibility (for adaptive quality)
   * Task 21.2: Pause off-screen video consumers
   */
  const setParticipantVisible = useCallback((userId: string, visible: boolean) => {
    setParticipants(prev => {
      const newMap = new Map(prev);
      const participant = newMap.get(userId);
      
      if (participant) {
        participant.isVisible = visible;
        
        // Pause/resume video consumers based on visibility
        participant.consumers.forEach(consumer => {
          if (consumer.kind === 'video') {
            if (visible && consumer.paused) {
              consumer.resume();
              console.log(`▶️  Resumed video consumer for ${participant.username} (now visible)`);
            } else if (!visible && !consumer.paused) {
              consumer.pause();
              console.log(`⏸️  Paused video consumer for ${participant.username} (now off-screen)`);
            }
          }
        });
      }
      
      return newMap;
    });
  }, []);
  
  /**
   * Adaptive quality management
   * Task 21.2: Switch simulcast layers based on bandwidth and visibility
   */
  useEffect(() => {
    if (!isConnected || participants.length === 0) return;
    
    const adaptiveQualityInterval = setInterval(() => {
      participants.forEach(participant => {
        participant.consumers.forEach(consumer => {
          if (consumer.kind === 'video' && !consumer.paused) {
            // Get consumer stats to estimate bandwidth
            consumer.getStats().then(stats => {
              // Find the inbound-rtp stats
              let bytesReceived = 0;
              let packetsLost = 0;
              
              stats.forEach(report => {
                if (report.type === 'inbound-rtp') {
                  bytesReceived = report.bytesReceived || 0;
                  packetsLost = report.packetsLost || 0;
                }
              });
              
              // Estimate quality based on packet loss and visibility
              const packetLossRate = packetsLost / (packetsLost + (bytesReceived / 1200)); // Rough estimate
              const isVisible = participant.isVisible !== false; // Default to visible
              
              // Determine optimal spatial layer
              let targetLayer = 2; // High quality by default
              
              if (!isVisible) {
                // Off-screen: use low quality
                targetLayer = 0;
              } else if (packetLossRate > 0.05) {
                // High packet loss: drop to medium
                targetLayer = 1;
              } else if (packetLossRate > 0.10) {
                // Very high packet loss: drop to low
                targetLayer = 0;
              } else if (participants.length > 6) {
                // Many participants: use medium to conserve bandwidth
                targetLayer = 1;
              }
              
              // Set preferred layers (spatialLayer, temporalLayer)
              const socket = getSocket();
              socket.emit("sfu:setConsumerLayers", {
                roomId: roomIdRef.current,
                consumerId: consumer.id,
                spatialLayer: targetLayer,
                temporalLayer: 2, // Max temporal layer
              });
            }).catch(err => {
              console.warn("Failed to get consumer stats:", err);
            });
          }
        });
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(adaptiveQualityInterval);
  }, [isConnected, participants]);
  
  /**
   * Audio level detection for speaking indicators
   * Task 21.2: Use AudioLevelObserver for speaking detection
   */
  useEffect(() => {
    if (!isConnected || !localStreamRef.current) return;
    
    // Create AudioContext for local audio level detection
    const audioContext = new AudioContext();
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    
    if (!audioTrack) return;
    
    const mediaStream = new MediaStream([audioTrack]);
    const source = audioContext.createMediaStreamSource(mediaStream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkAudioLevel = () => {
      if (!isConnected) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = average / 255;
      
      // You can emit this to server or use locally for UI indicators
      // For now, just log when speaking detected
      if (normalizedLevel > 0.1 && !isMuted) {
        // Speaking detected (could show indicator in UI)
      }
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
    
    return () => {
      source.disconnect();
      audioContext.close();
    };
  }, [isConnected, isMuted]);
  
  /**
   * Handle Socket.io events for SFU signaling
   */
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !channelId) return;
    
    // Handle new participant joining
    const handleParticipantJoined = (data: { userId: string; username: string; socketId: string }) => {
      console.log("👤 Participant joined:", data.username);
      
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(data.userId, {
          userId: data.userId,
          username: data.username,
          imageUrl: null,
          socketId: data.socketId,
          producers: new Map(),
          consumers: new Map(),
          audioEnabled: true,
          videoEnabled: false,
        });
        return newMap;
      });
    };
    
    // Handle participant leaving
    const handleParticipantLeft = (data: { userId: string }) => {
      console.log("👋 Participant left:", data.userId);
      
      setParticipants(prev => {
        const newMap = new Map(prev);
        const participant = newMap.get(data.userId);
        
        // Close all consumers for this participant
        if (participant) {
          participant.consumers.forEach(consumer => {
            mediasoupClient.current?.closeConsumer(consumer.id);
          });
        }
        
        newMap.delete(data.userId);
        return newMap;
      });
    };
    
    // Handle new producer from another participant
    const handleNewProducer = async (data: {
      producerId: string;
      userId: string;
      username: string;
      kind: "audio" | "video";
    }) => {
      console.log(`📡 New producer: ${data.kind} from ${data.username}`);
      
      // Update participant's producer list
      setParticipants(prev => {
        const newMap = new Map(prev);
        let participant = newMap.get(data.userId);
        
        if (!participant) {
          // Participant not in map yet, create entry
          participant = {
            userId: data.userId,
            username: data.username,
            imageUrl: null,
            socketId: "",
            producers: new Map(),
            consumers: new Map(),
            audioEnabled: data.kind === "audio",
            videoEnabled: data.kind === "video",
          };
          newMap.set(data.userId, participant);
        }
        
        participant.producers.set(data.producerId, { id: data.producerId, kind: data.kind });
        return newMap;
      });
      
      // Consume the new producer
      if (mediasoupClient.current && roomIdRef.current) {
        await consumeProducer(
          mediasoupClient.current,
          socket,
          roomIdRef.current,
          data.producerId,
          data.userId
        );
      }
    };
    
    // Handle producer closed
    const handleProducerClosed = (data: { producerId: string; userId: string }) => {
      console.log(`🚫 Producer closed: ${data.producerId}`);
      
      setParticipants(prev => {
        const newMap = new Map(prev);
        const participant = newMap.get(data.userId);
        
        if (participant) {
          participant.producers.delete(data.producerId);
          
          // Find and close corresponding consumer
          const consumerToClose = Array.from(participant.consumers.entries()).find(
            ([_, consumer]) => consumer.producerId === data.producerId
          );
          
          if (consumerToClose) {
            const [consumerId] = consumerToClose;
            mediasoupClient.current?.closeConsumer(consumerId);
            participant.consumers.delete(consumerId);
          }
        }
        
        return newMap;
      });
    };
    
    socket.on("sfu:participant-joined", handleParticipantJoined);
    socket.on("sfu:participant-left", handleParticipantLeft);
    socket.on("sfu:new-producer", handleNewProducer);
    socket.on("sfu:producer-closed", handleProducerClosed);
    
    return () => {
      socket.off("sfu:participant-joined", handleParticipantJoined);
      socket.off("sfu:participant-left", handleParticipantLeft);
      socket.off("sfu:new-producer", handleNewProducer);
      socket.off("sfu:producer-closed", handleProducerClosed);
    };
  }, [channelId]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnectFromSFU();
      }
    };
  }, [isConnected, disconnectFromSFU]);
  
  return {
    participants: Array.from(participants.values()),
    isConnected,
    isConnecting,
    localStream,
    isMuted,
    isDeafened,
    isVideoOn,
    connectToSFU,
    disconnectFromSFU,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    setParticipantVisible,
    error,
  };
}
