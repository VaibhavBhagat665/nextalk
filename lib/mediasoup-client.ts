/**
 * mediasoup Client Wrapper
 * 
 * This module provides a clean interface for client-side WebRTC media routing
 * through the mediasoup SFU server.
 * 
 * Architecture:
 * - Device: Represents the client's media capabilities
 * - Transports: Send and receive transports for media
 * - Producers: Local media tracks (audio/video) sent to SFU
 * - Consumers: Remote media tracks received from SFU
 */

import * as mediasoupClient from 'mediasoup-client';
import type {
  Device,
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from 'mediasoup-client/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface TransportOptions {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  iceServers?: RTCIceServer[]; // TURN server configuration
}

export interface ProducerOptions {
  track: MediaStreamTrack;
  appData?: any;
}

export interface ConsumerOptions {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
}

export interface MediasoupClientEvents {
  transportConnected: (transportId: string) => void;
  transportClosed: (transportId: string) => void;
  producerCreated: (producer: Producer) => void;
  producerClosed: (producerId: string) => void;
  consumerCreated: (consumer: Consumer) => void;
  consumerClosed: (consumerId: string) => void;
  error: (error: Error) => void;
}

// ============================================================================
// MediasoupClient Class
// ============================================================================

export class MediasoupClient {
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private eventHandlers: Partial<MediasoupClientEvents> = {};

  /**
   * Check if device is loaded
   */
  get isLoaded(): boolean {
    return this.device !== null && this.device.loaded;
  }

  /**
   * Get device RTP capabilities
   */
  get rtpCapabilities(): RtpCapabilities | null {
    return this.device?.rtpCapabilities || null;
  }

  /**
   * Register event handler
   */
  on<K extends keyof MediasoupClientEvents>(
    event: K,
    handler: MediasoupClientEvents[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Emit event
   */
  private emit<K extends keyof MediasoupClientEvents>(
    event: K,
    ...args: Parameters<MediasoupClientEvents[K]>
  ): void {
    const handler = this.eventHandlers[event];
    if (handler) {
      // @ts-ignore - TypeScript has trouble with spread args
      handler(...args);
    }
  }

  /**
   * Load device with router RTP capabilities
   */
  async loadDevice(routerRtpCapabilities: RtpCapabilities): Promise<void> {
    try {
      this.device = new mediasoupClient.Device();
      await this.device.load({ routerRtpCapabilities });
      console.log('📱 mediasoup Device loaded', {
        handlerName: this.device.handlerName,
        capabilities: this.device.rtpCapabilities,
      });
    } catch (error) {
      console.error('❌ Failed to load mediasoup device:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Create send transport for producing media
   */
  async createSendTransport(transportOptions: TransportOptions): Promise<Transport> {
    if (!this.device) {
      throw new Error('Device not loaded. Call loadDevice() first.');
    }

    try {
      // Build transport configuration with optional TURN servers
      const transportConfig: any = {
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
      };

      // Add TURN servers if provided
      if (transportOptions.iceServers && transportOptions.iceServers.length > 0) {
        transportConfig.iceServers = transportOptions.iceServers;
        console.log('🔄 TURN servers configured for send transport:', transportOptions.iceServers);
      }

      this.sendTransport = this.device.createSendTransport(transportConfig);

      // Handle transport connection
      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // This callback will be called by the application to connect the transport
          console.log('🔌 Send transport connecting...');
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      // Handle producer creation
      this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          // This callback will be called by the application to notify server of new producer
          console.log(`🎤 Producing ${kind}...`);
          callback({ id: '' }); // ID will be set by server response
        } catch (error) {
          errback(error as Error);
        }
      });

      this.sendTransport.on('connectionstatechange', (state) => {
        console.log(`📡 Send transport state: ${state}`);
        if (state === 'connected') {
          this.emit('transportConnected', this.sendTransport!.id);
        } else if (state === 'closed' || state === 'failed') {
          this.emit('transportClosed', this.sendTransport!.id);
        }
      });

      console.log('✅ Send transport created:', this.sendTransport.id);
      return this.sendTransport;
    } catch (error) {
      console.error('❌ Failed to create send transport:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Create receive transport for consuming media
   */
  async createRecvTransport(transportOptions: TransportOptions): Promise<Transport> {
    if (!this.device) {
      throw new Error('Device not loaded. Call loadDevice() first.');
    }

    try {
      // Build transport configuration with optional TURN servers
      const transportConfig: any = {
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
      };

      // Add TURN servers if provided
      if (transportOptions.iceServers && transportOptions.iceServers.length > 0) {
        transportConfig.iceServers = transportOptions.iceServers;
        console.log('🔄 TURN servers configured for receive transport:', transportOptions.iceServers);
      }

      this.recvTransport = this.device.createRecvTransport(transportConfig);

      // Handle transport connection
      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('🔌 Receive transport connecting...');
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      this.recvTransport.on('connectionstatechange', (state) => {
        console.log(`📡 Receive transport state: ${state}`);
        if (state === 'connected') {
          this.emit('transportConnected', this.recvTransport!.id);
        } else if (state === 'closed' || state === 'failed') {
          this.emit('transportClosed', this.recvTransport!.id);
        }
      });

      console.log('✅ Receive transport created:', this.recvTransport.id);
      return this.recvTransport;
    } catch (error) {
      console.error('❌ Failed to create receive transport:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Produce media (send local track to SFU)
   */
  async produce(options: ProducerOptions): Promise<Producer> {
    if (!this.sendTransport) {
      throw new Error('Send transport not created. Call createSendTransport() first.');
    }

    try {
      const producer = await this.sendTransport.produce({
        track: options.track,
        appData: options.appData,
      });

      this.producers.set(producer.id, producer);

      producer.on('transportclose', () => {
        console.log(`🚫 Producer ${producer.id} transport closed`);
        this.producers.delete(producer.id);
        this.emit('producerClosed', producer.id);
      });

      producer.on('trackended', () => {
        console.log(`🎬 Producer ${producer.id} track ended`);
        // Optionally close the producer
      });

      console.log(`✅ Producer created: ${producer.kind} (${producer.id})`);
      this.emit('producerCreated', producer);
      return producer;
    } catch (error) {
      console.error('❌ Failed to produce:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Consume media (receive remote track from SFU)
   */
  async consume(options: ConsumerOptions): Promise<Consumer> {
    if (!this.recvTransport) {
      throw new Error('Receive transport not created. Call createRecvTransport() first.');
    }

    try {
      const consumer = await this.recvTransport.consume({
        id: options.id,
        producerId: options.producerId,
        kind: options.kind,
        rtpParameters: options.rtpParameters,
      });

      this.consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => {
        console.log(`🚫 Consumer ${consumer.id} transport closed`);
        this.consumers.delete(consumer.id);
        this.emit('consumerClosed', consumer.id);
      });

      consumer.on('trackended', () => {
        console.log(`🎬 Consumer ${consumer.id} track ended`);
        // Optionally close the consumer
      });

      // Resume consumer (start receiving media)
      await consumer.resume();

      console.log(`✅ Consumer created: ${consumer.kind} (${consumer.id})`);
      this.emit('consumerCreated', consumer);
      return consumer;
    } catch (error) {
      console.error('❌ Failed to consume:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Close a producer
   */
  closeProducer(producerId: string): void {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
      this.emit('producerClosed', producerId);
      console.log(`🗑️  Producer closed: ${producerId}`);
    }
  }

  /**
   * Close a consumer
   */
  closeConsumer(consumerId: string): void {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);
      this.emit('consumerClosed', consumerId);
      console.log(`🗑️  Consumer closed: ${consumerId}`);
    }
  }

  /**
   * Get all active producers
   */
  getProducers(): Producer[] {
    return Array.from(this.producers.values());
  }

  /**
   * Get all active consumers
   */
  getConsumers(): Consumer[] {
    return Array.from(this.consumers.values());
  }

  /**
   * Close all transports and cleanup
   */
  close(): void {
    // Close all producers
    this.producers.forEach((producer) => producer.close());
    this.producers.clear();

    // Close all consumers
    this.consumers.forEach((consumer) => consumer.close());
    this.consumers.clear();

    // Close transports
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }
    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    console.log('🛑 MediasoupClient closed');
  }
}

// ============================================================================
// Singleton instance (optional pattern)
// ============================================================================

let mediasoupClientInstance: MediasoupClient | null = null;

export function getMediasoupClient(): MediasoupClient {
  if (!mediasoupClientInstance) {
    mediasoupClientInstance = new MediasoupClient();
  }
  return mediasoupClientInstance;
}

export function resetMediasoupClient(): void {
  if (mediasoupClientInstance) {
    mediasoupClientInstance.close();
    mediasoupClientInstance = null;
  }
}
