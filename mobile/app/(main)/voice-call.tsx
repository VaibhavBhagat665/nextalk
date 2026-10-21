/**
 * Voice Call Screen - React Native
 * 
 * Audio-only call screen using mediasoup SFU for group voice calls.
 * Connects to the same mediasoup server as the web app.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Mic, MicOff, PhoneOff, Users } from 'lucide-react-native';
import { MediasoupClientRN } from '@/lib/mediasoup-client-rn';
import { socketService } from '@/lib/socket';
import type { RtpCapabilities } from 'mediasoup-client/lib/types';

interface Participant {
  userId: string;
  username: string;
  audioProducerId?: string;
  isMuted: boolean;
}

export default function VoiceCallScreen() {
  const params = useLocalSearchParams<{ channelId: string; channelName: string }>();
  const router = useRouter();

  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediasoupClientRef = useRef<MediasoupClientRN | null>(null);
  const roomIdRef = useRef<string | null>(null);

  /**
   * Initialize mediasoup client and join voice channel
   */
  const joinVoiceChannel = useCallback(async () => {
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

      // Request to join voice channel
      socket.emit('voice:join', { channelId: params.channelId }, async (response: any) => {
        try {
          if (response.error) {
            throw new Error(response.error);
          }

          const { roomId, routerRtpCapabilities } = response;
          roomIdRef.current = roomId;

          // Load device with router capabilities
          await client.loadDevice(routerRtpCapabilities as RtpCapabilities);

          // Create send transport
          socket.emit('voice:createTransport', { roomId, direction: 'send' }, async (transportData: any) => {
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
                socket.emit('voice:connectTransport', {
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
                socket.emit('voice:produce', {
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

              // Get user media (audio only)
              const stream = await client.getUserMedia({ audio: true, video: false });
              const audioTrack = stream.getAudioTracks()[0];

              if (!audioTrack) {
                throw new Error('No audio track available');
              }

              // Produce audio
              const producer = await client.produce({ track: audioTrack });
              console.log('✅ Audio producer created:', producer.id);

              // Create receive transport
              socket.emit('voice:createTransport', { roomId, direction: 'recv' }, async (recvTransportData: any) => {
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
                    socket.emit('voice:connectTransport', {
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
                  socket.emit('voice:getProducers', { roomId }, async (existingProducers: any[]) => {
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
          console.error('Failed to join voice channel:', err);
          setError(err.message);
          setIsConnecting(false);
        }
      });

      // Listen for new producers
      socket.on('voice:newProducer', async (producerInfo: any) => {
        console.log('New producer joined:', producerInfo);
        if (mediasoupClientRef.current && roomIdRef.current) {
          await consumeProducer(mediasoupClientRef.current, socket, roomIdRef.current, producerInfo);
        }
      });

      // Listen for producer closed
      socket.on('voice:producerClosed', ({ producerId }: { producerId: string }) => {
        console.log('Producer closed:', producerId);
        setParticipants((prev) => prev.filter((p) => p.audioProducerId !== producerId));
      });

      // Listen for participant list updates
      socket.on('voice:participants', (participantList: Participant[]) => {
        setParticipants(participantList);
      });

    } catch (err: any) {
      console.error('Failed to join voice channel:', err);
      setError(err.message);
      setIsConnecting(false);
      Alert.alert('Connection Failed', err.message);
    }
  }, [params.channelId]);

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

      socket.emit('voice:consume', {
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

        // Add participant to list
        setParticipants((prev) => {
          const exists = prev.find((p) => p.userId === producerInfo.userId);
          if (exists) return prev;
          return [
            ...prev,
            {
              userId: producerInfo.userId,
              username: producerInfo.username || 'Unknown',
              audioProducerId: producerInfo.producerId,
              isMuted: false,
            },
          ];
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
   * Leave voice channel
   */
  const leaveVoiceChannel = useCallback(() => {
    const socket = socketService.getSocket();
    const client = mediasoupClientRef.current;

    if (socket && roomIdRef.current) {
      socket.emit('voice:leave', { roomId: roomIdRef.current });
      socket.off('voice:newProducer');
      socket.off('voice:producerClosed');
      socket.off('voice:participants');
    }

    if (client) {
      client.close();
      mediasoupClientRef.current = null;
    }

    router.back();
  }, [router]);

  // Initialize on mount
  useEffect(() => {
    joinVoiceChannel();

    return () => {
      // Cleanup on unmount
      if (mediasoupClientRef.current) {
        mediasoupClientRef.current.close();
      }
    };
  }, [joinVoiceChannel]);

  return (
    <>
      <Stack.Screen
        options={{
          title: params.channelName || 'Voice Call',
          headerBackTitle: 'Back',
        }}
      />
      <View style={styles.container}>
        {/* Status Section */}
        <View style={styles.statusSection}>
          {isConnecting && (
            <View style={styles.statusContent}>
              <ActivityIndicator size="large" color="#D4AF37" />
              <Text style={styles.statusText}>Connecting to voice channel...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContent}>
              <Text style={styles.errorText}>❌ {error}</Text>
              <Pressable style={styles.retryButton} onPress={joinVoiceChannel}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {isConnected && !error && (
            <View style={styles.connectedContent}>
              <View style={styles.connectedIndicator} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}
        </View>

        {/* Participants Section */}
        <View style={styles.participantsSection}>
          <View style={styles.participantsHeader}>
            <Users size={20} color="#A3A3A3" />
            <Text style={styles.participantsTitle}>
              Participants ({participants.length + 1})
            </Text>
          </View>

          <ScrollView style={styles.participantsList}>
            {/* Current user */}
            <View style={styles.participantItem}>
              <View style={styles.participantInfo}>
                <View style={styles.participantAvatar}>
                  <Text style={styles.participantAvatarText}>You</Text>
                </View>
                <Text style={styles.participantName}>You</Text>
              </View>
              {isMuted && <MicOff size={18} color="#EF4444" />}
              {!isMuted && <Mic size={18} color="#10B981" />}
            </View>

            {/* Other participants */}
            {participants.map((participant) => (
              <View key={participant.userId} style={styles.participantItem}>
                <View style={styles.participantInfo}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantAvatarText}>
                      {participant.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.participantName}>{participant.username}</Text>
                </View>
                {participant.isMuted && <MicOff size={18} color="#EF4444" />}
                {!participant.isMuted && <Mic size={18} color="#10B981" />}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Controls Section */}
        <View style={styles.controlsSection}>
          <Pressable
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
            disabled={!isConnected}
          >
            {isMuted ? (
              <MicOff size={28} color="#FFFFFF" />
            ) : (
              <Mic size={28} color="#FFFFFF" />
            )}
          </Pressable>

          <Pressable
            style={[styles.controlButton, styles.hangupButton]}
            onPress={leaveVoiceChannel}
          >
            <PhoneOff size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },
  statusSection: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  statusContent: {
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    color: '#A3A3A3',
    fontSize: 16,
  },
  errorContent: {
    alignItems: 'center',
    gap: 16,
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
  connectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  connectedText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  participantsSection: {
    flex: 1,
    padding: 16,
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  participantsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  participantsList: {
    flex: 1,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#262626',
    borderRadius: 8,
    marginBottom: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  controlsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 32,
    paddingBottom: 48,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#404040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#EF4444',
  },
  hangupButton: {
    backgroundColor: '#EF4444',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
});
