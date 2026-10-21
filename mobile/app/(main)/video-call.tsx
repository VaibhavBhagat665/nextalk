/**
 * Video Call Screen - React Native
 * 
 * Video call screen using mediasoup SFU for group video calls.
 * Connects to the same mediasoup server as the web app.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Camera, Users } from 'lucide-react-native';
import { RTCView, MediaStream } from 'react-native-webrtc';
import { MediasoupClientRN } from '@/lib/mediasoup-client-rn';
import { socketService } from '@/lib/socket';
import type { RtpCapabilities } from 'mediasoup-client/lib/types';

const { width } = Dimensions.get('window');

interface Participant {
  userId: string;
  username: string;
  stream?: MediaStream;
  audioProducerId?: string;
  videoProducerId?: string;
  isMuted: boolean;
  isVideoOff: boolean;
}

export default function VideoCallScreen() {
  const params = useLocalSearchParams<{ channelId: string; channelName: string }>();
  const router = useRouter();

  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const mediasoupClientRef = useRef<MediasoupClientRN | null>(null);
  const roomIdRef = useRef<string | null>(null);

  /**
   * Initialize mediasoup client and join video channel
   */
  const joinVideoChannel = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        throw new Error('Socket not connected');
      }

      // Create mediasoup client
      const client = new MediasoupClientRN();
      mediasoupClientRef.current = client;

      // Request to join video channel
      socket.emit('video:join', { channelId: params.channelId }, async (response: any) => {
        try {
          if (response.error) {
            throw new Error(response.error);
          }

          const { roomId, routerRtpCapabilities } = response;
          roomIdRef.current = roomId;

          // Load device with router capabilities
          await client.loadDevice(routerRtpCapabilities as RtpCapabilities);

          // Get user media (audio + video)
          const stream = await client.getUserMedia({
            audio: true,
            video: { facingMode },
          });
          setLocalStream(stream);

          // Create send transport
          socket.emit('video:createTransport', { roomId, direction: 'send' }, async (transportData: any) => {
            try {
              const sendTransport = await client.createSendTransport({
                id: transportData.id,
                iceParameters: transportData.iceParameters,
                iceCandidates: transportData.iceCandidates,
                dtlsParameters: transportData.dtlsParameters,
                iceServers: transportData.iceServers,
              });

              // Connect send transport
              sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                socket.emit('video:connectTransport', {
                  roomId,
                  transportId: sendTransport.id,
                  dtlsParameters,
                }, (result: any) => {
                  if (result.error) {
                    errback(new Error(result.error));
                  } else {
                    callback();
                  }
                });
              });

              // Handle produce
              sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                socket.emit('video:produce', {
                  roomId,
                  transportId: sendTransport.id,
                  kind,
                  rtpParameters,
                }, (result: any) => {
                  if (result.error) {
                    errback(new Error(result.error));
                  } else {
                    callback({ id: result.producerId });
                  }
                });
              });

              // Produce audio
              const audioTrack = stream.getAudioTracks()[0];
              if (audioTrack) {
                await client.produce({ track: audioTrack });
                console.log('✅ Audio producer created');
              }

              // Produce video
              const videoTrack = stream.getVideoTracks()[0];
              if (videoTrack) {
                await client.produce({ track: videoTrack });
                console.log('✅ Video producer created');
              }

              // Create receive transport
              socket.emit('video:createTransport', { roomId, direction: 'recv' }, async (recvTransportData: any) => {
                try {
                  const recvTransport = await client.createRecvTransport({
                    id: recvTransportData.id,
                    iceParameters: recvTransportData.iceParameters,
                    iceCandidates: recvTransportData.iceCandidates,
                    dtlsParameters: recvTransportData.dtlsParameters,
                    iceServers: recvTransportData.iceServers,
                  });

                  // Connect receive transport
                  recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                    socket.emit('video:connectTransport', {
                      roomId,
                      transportId: recvTransport.id,
                      dtlsParameters,
                    }, (result: any) => {
                      if (result.error) {
                        errback(new Error(result.error));
                      } else {
                        callback();
                      }
                    });
                  });

                  setIsConnected(true);
                  setIsConnecting(false);

                  // Request to consume existing producers
                  socket.emit('video:getProducers', { roomId }, async (existingProducers: any[]) => {
                    for (const producerInfo of existingProducers) {
                      await consumeProducer(client, socket, roomId, producerInfo);
                    }
                  });
                } catch (err: any) {
                  console.error('Failed to create receive transport:', err);
                  throw err;
                }
              });
            } catch (err: any) {
              console.error('Failed to create send transport:', err);
              throw err;
            }
          });
        } catch (err: any) {
          console.error('Failed to join video channel:', err);
          setError(err.message);
          setIsConnecting(false);
        }
      });

      // Listen for new producers
      socket.on('video:newProducer', async (producerInfo: any) => {
        console.log('New producer joined:', producerInfo);
        if (mediasoupClientRef.current && roomIdRef.current) {
          await consumeProducer(mediasoupClientRef.current, socket, roomIdRef.current, producerInfo);
        }
      });

      // Listen for producer closed
      socket.on('video:producerClosed', ({ producerId, userId }: any) => {
        console.log('Producer closed:', producerId);
        setParticipants((prev) => {
          const updated = new Map(prev);
          const participant = updated.get(userId);
          if (participant) {
            if (participant.audioProducerId === producerId) {
              participant.audioProducerId = undefined;
            }
            if (participant.videoProducerId === producerId) {
              participant.videoProducerId = undefined;
            }
            if (!participant.audioProducerId && !participant.videoProducerId) {
              updated.delete(userId);
            } else {
              updated.set(userId, participant);
            }
          }
          return updated;
        });
      });

    } catch (err: any) {
      console.error('Failed to join video channel:', err);
      setError(err.message);
      setIsConnecting(false);
      Alert.alert('Connection Failed', err.message);
    }
  }, [params.channelId, facingMode]);

  /**
   * Consume a producer from another participant
   */
  const consumeProducer = async (
    client: MediasoupClientRN,
    socket: any,
    roomId: string,
    producerInfo: any
  ) => {
    try {
      const rtpCapabilities = client.rtpCapabilities;
      if (!rtpCapabilities) {
        throw new Error('RTP capabilities not available');
      }

      socket.emit('video:consume', {
        roomId,
        producerId: producerInfo.producerId,
        rtpCapabilities,
      }, async (consumeData: any) => {
        if (consumeData.error) {
          console.error('Failed to consume:', consumeData.error);
          return;
        }

        const consumer = await client.consume({
          id: consumeData.consumerId,
          producerId: consumeData.producerId,
          kind: consumeData.kind,
          rtpParameters: consumeData.rtpParameters,
        });

        console.log('✅ Consumer created:', consumer.id);

        // Add/update participant
        setParticipants((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(producerInfo.userId) || {
            userId: producerInfo.userId,
            username: producerInfo.username || 'Unknown',
            isMuted: false,
            isVideoOff: false,
          };

          // Create or update stream
          const track = consumer.track;
          if (!existing.stream) {
            const newStream = new MediaStream();
            newStream.addTrack(track);
            existing.stream = newStream;
          } else {
            existing.stream.addTrack(track);
          }

          if (consumer.kind === 'audio') {
            existing.audioProducerId = producerInfo.producerId;
          } else if (consumer.kind === 'video') {
            existing.videoProducerId = producerInfo.producerId;
          }

          updated.set(producerInfo.userId, existing);
          return updated;
        });
      });
    } catch (err) {
      console.error('Failed to consume producer:', err);
    }
  };

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    const client = mediasoupClientRef.current;
    if (!client) return;

    const producers = client.getProducers();
    const audioProducer = producers.find((p) => p.kind === 'audio');

    if (audioProducer) {
      if (isMuted) {
        audioProducer.resume();
        setIsMuted(false);
      } else {
        audioProducer.pause();
        setIsMuted(true);
      }
    }
  }, [isMuted]);

  /**
   * Toggle video
   */
  const toggleVideo = useCallback(() => {
    const client = mediasoupClientRef.current;
    if (!client) return;

    const producers = client.getProducers();
    const videoProducer = producers.find((p) => p.kind === 'video');

    if (videoProducer) {
      if (isVideoOff) {
        videoProducer.resume();
        setIsVideoOff(false);
      } else {
        videoProducer.pause();
        setIsVideoOff(true);
      }
    }
  }, [isVideoOff]);

  /**
   * Switch camera
   */
  const switchCamera = useCallback(() => {
    // Switching camera requires stopping and restarting the stream
    // This is a simplified version - production would need to handle this more gracefully
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    Alert.alert('Camera Switch', 'Camera switching requires reconnecting. Please leave and rejoin the call.');
  }, []);

  /**
   * Leave video channel
   */
  const leaveVideoChannel = useCallback(() => {
    const socket = socketService.getSocket();
    const client = mediasoupClientRef.current;

    if (socket && roomIdRef.current) {
      socket.emit('video:leave', { roomId: roomIdRef.current });
      socket.off('video:newProducer');
      socket.off('video:producerClosed');
    }

    if (client) {
      client.close();
      mediasoupClientRef.current = null;
    }

    setLocalStream(null);
    router.back();
  }, [router]);

  // Initialize on mount
  useEffect(() => {
    joinVideoChannel();

    return () => {
      // Cleanup on unmount
      if (mediasoupClientRef.current) {
        mediasoupClientRef.current.close();
      }
    };
  }, [joinVideoChannel]);

  return (
    <>
      <Stack.Screen
        options={{
          title: params.channelName || 'Video Call',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: '#000000' },
          headerTintColor: '#FFFFFF',
        }}
      />
      <View style={styles.container}>
        {/* Loading State */}
        {isConnecting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.loadingText}>Connecting to video channel...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {error}</Text>
            <Pressable style={styles.retryButton} onPress={joinVideoChannel}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Video Grid */}
        {isConnected && !error && (
          <View style={styles.videoGrid}>
            {/* Local Video */}
            <View style={styles.localVideoContainer}>
              {localStream && !isVideoOff ? (
                <RTCView
                  streamURL={localStream.toURL()}
                  style={styles.localVideo}
                  mirror={facingMode === 'user'}
                  objectFit="cover"
                />
              ) : (
                <View style={styles.videoPlaceholder}>
                  <VideoOff size={40} color="#A3A3A3" />
                  <Text style={styles.placeholderText}>Camera Off</Text>
                </View>
              )}
              <View style={styles.localVideoLabel}>
                <Text style={styles.localVideoLabelText}>You</Text>
              </View>
            </View>

            {/* Remote Videos */}
            {Array.from(participants.values()).map((participant) => (
              <View key={participant.userId} style={styles.remoteVideoContainer}>
                {participant.stream && !participant.isVideoOff ? (
                  <RTCView
                    streamURL={participant.stream.toURL()}
                    style={styles.remoteVideo}
                    objectFit="cover"
                  />
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {participant.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.placeholderText}>{participant.username}</Text>
                  </View>
                )}
                <View style={styles.remoteVideoLabel}>
                  <Text style={styles.remoteVideoLabelText}>{participant.username}</Text>
                  {participant.isMuted && <MicOff size={14} color="#EF4444" />}
                </View>
              </View>
            ))}

            {/* Empty state when no other participants */}
            {participants.size === 0 && (
              <View style={styles.emptyState}>
                <Users size={48} color="#A3A3A3" />
                <Text style={styles.emptyStateText}>Waiting for others to join...</Text>
              </View>
            )}
          </View>
        )}

        {/* Controls */}
        {isConnected && !error && (
          <View style={styles.controlsContainer}>
            <Pressable
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={toggleMute}
            >
              {isMuted ? (
                <MicOff size={24} color="#FFFFFF" />
              ) : (
                <Mic size={24} color="#FFFFFF" />
              )}
            </Pressable>

            <Pressable
              style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
              onPress={toggleVideo}
            >
              {isVideoOff ? (
                <VideoOff size={24} color="#FFFFFF" />
              ) : (
                <Video size={24} color="#FFFFFF" />
              )}
            </Pressable>

            <Pressable style={styles.controlButton} onPress={switchCamera}>
              <Camera size={24} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={[styles.controlButton, styles.hangupButton]}
              onPress={leaveVideoChannel}
            >
              <PhoneOff size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#A3A3A3',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoGrid: {
    flex: 1,
    padding: 8,
  },
  localVideoContainer: {
    width: width / 2 - 12,
    height: 200,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  localVideoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  localVideoLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  remoteVideoContainer: {
    width: width / 2 - 12,
    height: 200,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  remoteVideoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  remoteVideoLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  placeholderText: {
    color: '#A3A3A3',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyStateText: {
    color: '#A3A3A3',
    fontSize: 16,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    paddingBottom: 48,
    backgroundColor: '#171717',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#404040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#EF4444',
  },
  hangupButton: {
    backgroundColor: '#EF4444',
  },
});
