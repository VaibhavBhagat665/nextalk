/**
 * mediasoup SFU Server
 * 
 * This server implements a Selective Forwarding Unit (SFU) for WebRTC media routing,
 * replacing the mesh topology which doesn't scale beyond 5-6 participants.
 * 
 * Architecture:
 * - Workers: 1 per CPU core (max 4) for load distribution
 * - Routers: 1 per voice/video room/channel
 * - Transports: 2 per participant (send + receive)
 * - Producers: 1-2 per participant (audio + optional video)
 * - Consumers: N-1 per participant (everyone else's streams)
 */

import * as mediasoup from "mediasoup";
import type { Worker, Router, WebRtcTransport, Producer, Consumer } from "mediasoup/node/lib/types";
import * as os from "os";

// ============================================================================
// Configuration
// ============================================================================

const config = {
  // Worker settings
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    logLevel: (process.env.MEDIASOUP_LOG_LEVEL || "warn") as mediasoup.types.WorkerLogLevel,
    logTags: [
      "info",
      "ice",
      "dtls",
      "rtp",
      "srtp",
      "rtcp",
    ] as mediasoup.types.WorkerLogTag[],
  },

  // Router settings
  router: {
    mediaCodecs: [
      {
        kind: "audio" as mediasoup.types.MediaKind,
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video" as mediasoup.types.MediaKind,
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video" as mediasoup.types.MediaKind,
        mimeType: "video/VP9",
        clockRate: 90000,
        parameters: {
          "profile-id": 2,
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video" as mediasoup.types.MediaKind,
        mimeType: "video/h264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
          "x-google-start-bitrate": 1000,
        },
      },
    ] as mediasoup.types.RtpCodecCapability[],
  },

  // WebRTC transport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
    // ICE configuration with TURN server support
    // TURN servers are used as fallback when direct peer connections fail
    iceServers: process.env.NEXT_PUBLIC_TURN_URL ? [
      {
        urls: [process.env.NEXT_PUBLIC_TURN_URL],
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
      },
    ] : undefined,
  },
};

// ============================================================================
// Types
// ============================================================================

interface Participant {
  id: string; // userId
  socketId: string;
  username: string;
  sendTransport: WebRtcTransport | null;
  recvTransport: WebRtcTransport | null;
  producers: Map<string, Producer>; // producerId => Producer
  consumers: Map<string, Consumer>; // consumerId => Consumer
}

interface Room {
  id: string; // channelId or roomId
  router: Router;
  participants: Map<string, Participant>; // userId => Participant
}

// ============================================================================
// Global State
// ============================================================================

class SFUServer {
  private workers: Worker[] = [];
  private nextWorkerIdx = 0;
  private rooms: Map<string, Room> = new Map();

  /**
   * Initialize mediasoup workers (1 per CPU core, max 4)
   */
  async init() {
    const numWorkers = Math.min(os.cpus().length, 4);
    console.log(`🚀 Starting ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
        rtcMinPort: config.worker.rtcMinPort,
        rtcMaxPort: config.worker.rtcMaxPort,
      });

      worker.on("died", () => {
        console.error(`❌ mediasoup worker ${i} died, exiting...`);
        process.exit(1);
      });

      this.workers.push(worker);
      console.log(`  ✅ Worker ${i} created (PID: ${worker.pid})`);
    }

    console.log("✅ All mediasoup workers ready");
  }

  /**
   * Get next worker using round-robin
   */
  private getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  /**
   * Create a new room with a router
   */
  async createRoom(roomId: string): Promise<Room> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    });

    const room: Room = {
      id: roomId,
      router,
      participants: new Map(),
    };

    this.rooms.set(roomId, room);
    console.log(`📦 Room created: ${roomId} on worker PID ${worker.pid}`);

    return room;
  }

  /**
   * Get existing room or null
   */
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Close a room and cleanup resources
   */
  async closeRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Close all transports and producers/consumers
    const participants = Array.from(room.participants.values());
    for (const participant of participants) {
      await this.removeParticipant(roomId, participant.id);
    }

    // Close the router
    room.router.close();
    this.rooms.delete(roomId);

    console.log(`🗑️  Room closed: ${roomId}`);
  }

  /**
   * Add a participant to a room
   */
  addParticipant(roomId: string, userId: string, socketId: string, username: string): Participant | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`⚠️  Cannot add participant: room ${roomId} not found`);
      return null;
    }

    // Check if participant already exists
    if (room.participants.has(userId)) {
      return room.participants.get(userId)!;
    }

    const participant: Participant = {
      id: userId,
      socketId,
      username,
      sendTransport: null,
      recvTransport: null,
      producers: new Map(),
      consumers: new Map(),
    };

    room.participants.set(userId, participant);
    console.log(`👤 Participant ${username} added to room ${roomId}`);

    return participant;
  }

  /**
   * Remove a participant and cleanup their resources
   */
  async removeParticipant(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    if (!participant) return;

    // Close all producers
    const producers = Array.from(participant.producers.values());
    for (const producer of producers) {
      producer.close();
    }

    // Close all consumers
    const consumers = Array.from(participant.consumers.values());
    for (const consumer of consumers) {
      consumer.close();
    }

    // Close transports
    if (participant.sendTransport) {
      participant.sendTransport.close();
    }
    if (participant.recvTransport) {
      participant.recvTransport.close();
    }

    room.participants.delete(userId);
    console.log(`👤 Participant ${participant.username} removed from room ${roomId}`);

    // Auto-cleanup: if room is empty, close it
    if (room.participants.size === 0) {
      await this.closeRoom(roomId);
    }
  }

  /**
   * Get participant from room
   */
  getParticipant(roomId: string, userId: string): Participant | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return room.participants.get(userId) || null;
  }

  /**
   * Get all participants in a room
   */
  getRoomParticipants(roomId: string): Participant[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.participants.values());
  }

  /**
   * Get router capabilities for a room
   */
  getRouterRtpCapabilities(roomId: string): mediasoup.types.RtpCapabilities | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return room.router.rtpCapabilities;
  }

  /**
   * Create WebRTC transport for a participant
   */
  async createWebRtcTransport(roomId: string, userId: string, direction: "send" | "recv") {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(userId);

    if (!room || !participant) {
      throw new Error(`Room or participant not found: ${roomId}, ${userId}`);
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: config.webRtcTransport.listenIps,
      enableUdp: config.webRtcTransport.enableUdp,
      enableTcp: config.webRtcTransport.enableTcp,
      preferUdp: config.webRtcTransport.preferUdp,
      initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    // Store transport reference
    if (direction === "send") {
      participant.sendTransport = transport;
    } else {
      participant.recvTransport = transport;
    }

    console.log(`🔌 ${direction} transport created for ${participant.username} in room ${roomId}`);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  /**
   * Connect a WebRTC transport
   */
  async connectWebRtcTransport(
    roomId: string,
    userId: string,
    transportId: string,
    dtlsParameters: mediasoup.types.DtlsParameters
  ) {
    const participant = this.getParticipant(roomId, userId);
    if (!participant) {
      throw new Error(`Participant not found: ${userId}`);
    }

    const transport =
      participant.sendTransport?.id === transportId
        ? participant.sendTransport
        : participant.recvTransport?.id === transportId
        ? participant.recvTransport
        : null;

    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    await transport.connect({ dtlsParameters });
    console.log(`🔗 Transport ${transportId} connected for ${participant.username}`);
  }

  /**
   * Create a producer (participant starts sending media)
   * Supports simulcast for video producers
   */
  async produce(
    roomId: string,
    userId: string,
    transportId: string,
    kind: mediasoup.types.MediaKind,
    rtpParameters: mediasoup.types.RtpParameters,
    appData?: any
  ) {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(userId);

    if (!room || !participant) {
      throw new Error(`Room or participant not found`);
    }

    const transport = participant.sendTransport;
    if (!transport || transport.id !== transportId) {
      throw new Error(`Send transport not found for ${userId}`);
    }

    // Enable simulcast for video producers
    // This allows the SFU to dynamically select the appropriate quality layer
    // based on network conditions and screen size
    const producerOptions: mediasoup.types.ProducerOptions = {
      kind,
      rtpParameters,
      appData: appData || {},
    };

    // For video, check if simulcast encodings are present in rtpParameters
    // If not, we can't enable simulcast (client must provide multiple encodings)
    if (kind === "video" && rtpParameters.encodings && rtpParameters.encodings.length > 1) {
      console.log(`  📹 Simulcast enabled for video producer (${rtpParameters.encodings.length} layers)`);
    }

    const producer = await transport.produce(producerOptions);
    participant.producers.set(producer.id, producer);

    console.log(`🎤 Producer created: ${kind} from ${participant.username} in room ${roomId} (id: ${producer.id})`);

    // Notify other participants to create consumers
    return producer.id;
  }

  /**
   * Create a consumer (participant starts receiving media from another participant)
   * Supports simulcast layer selection for video consumers
   */
  async consume(
    roomId: string,
    userId: string,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities,
    preferredLayers?: { spatialLayer: number; temporalLayer?: number }
  ) {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(userId);

    if (!room || !participant || !participant.recvTransport) {
      throw new Error(`Room, participant, or recv transport not found`);
    }

    // Check if router can consume this producer
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Cannot consume producer ${producerId}`);
    }

    // Consumer options with simulcast support
    const consumerOptions: mediasoup.types.ConsumerOptions = {
      producerId,
      rtpCapabilities,
      paused: false, // Start consuming immediately
    };

    // If preferred layers are specified (for simulcast video), apply them
    if (preferredLayers) {
      consumerOptions.preferredLayers = preferredLayers;
    }

    const consumer = await participant.recvTransport.consume(consumerOptions);

    participant.consumers.set(consumer.id, consumer);

    // For video consumers with simulcast, we may want to dynamically adjust layers
    // based on bandwidth or other factors. The client can call setPreferredLayers later.
    if (consumer.kind === "video" && consumer.type === "simulcast") {
      console.log(`🔊 Simulcast consumer created (spatialLayers: ${consumer.producerRtpParameters?.encodings?.length || 1})`);
    }

    console.log(`🔊 Consumer created for ${participant.username} consuming ${producerId}`);

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    };
  }

  /**
   * Close a producer
   */
  closeProducer(roomId: string, userId: string, producerId: string) {
    const participant = this.getParticipant(roomId, userId);
    if (!participant) return;

    const producer = participant.producers.get(producerId);
    if (producer) {
      producer.close();
      participant.producers.delete(producerId);
      console.log(`❌ Producer ${producerId} closed`);
    }
  }

  /**
   * Close a consumer
   */
  closeConsumer(roomId: string, userId: string, consumerId: string) {
    const participant = this.getParticipant(roomId, userId);
    if (!participant) return;

    const consumer = participant.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      participant.consumers.delete(consumerId);
      console.log(`❌ Consumer ${consumerId} closed`);
    }
  }

  /**
   * Set preferred layers for a video consumer (simulcast quality adjustment)
   */
  async setConsumerPreferredLayers(
    roomId: string,
    userId: string,
    consumerId: string,
    spatialLayer: number,
    temporalLayer?: number
  ) {
    const participant = this.getParticipant(roomId, userId);
    if (!participant) {
      throw new Error(`Participant ${userId} not found`);
    }

    const consumer = participant.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found`);
    }

    if (consumer.kind !== "video") {
      throw new Error(`Consumer ${consumerId} is not a video consumer`);
    }

    await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
    console.log(`🎚️  Set preferred layers for consumer ${consumerId}: spatial=${spatialLayer}, temporal=${temporalLayer}`);
  }

  /**
   * Pause a consumer (stop receiving media temporarily)
   */
  async pauseConsumer(roomId: string, userId: string, consumerId: string) {
    const participant = this.getParticipant(roomId, userId);
    if (!participant) {
      throw new Error(`Participant ${userId} not found`);
    }

    const consumer = participant.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found`);
    }

    await consumer.pause();
    console.log(`⏸️  Consumer ${consumerId} paused`);
  }

  /**
   * Resume a consumer (start receiving media again)
   */
  async resumeConsumer(roomId: string, userId: string, consumerId: string) {
    const participant = this.getParticipant(roomId, userId);
    if (!participant) {
      throw new Error(`Participant ${userId} not found`);
    }

    const consumer = participant.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found`);
    }

    await consumer.resume();
    console.log(`▶️  Consumer ${consumerId} resumed`);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      workers: this.workers.length,
      rooms: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values()).reduce(
        (sum, room) => sum + room.participants.size,
        0
      ),
    };
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

export const sfuServer = new SFUServer();

// Initialize on module load
sfuServer.init().catch((err) => {
  console.error("❌ Failed to initialize SFU server:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, closing SFU server...");
  // Close all rooms
  const roomIds = Array.from(sfuServer["rooms"].keys());
  for (const roomId of roomIds) {
    await sfuServer.closeRoom(roomId);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, closing SFU server...");
  const roomIds = Array.from(sfuServer["rooms"].keys());
  for (const roomId of roomIds) {
    await sfuServer.closeRoom(roomId);
  }
  process.exit(0);
});
