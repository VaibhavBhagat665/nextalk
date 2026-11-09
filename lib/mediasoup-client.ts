/**
 * ============================================================================
 * Mediasoup Client Wrapper (STUB - Voice/Video Disabled)
 * ============================================================================
 * 
 * This is a stub implementation since mediasoup packages are not installed.
 * Voice/Video calling features are disabled in this deployment.
 * 
 * To enable: Install mediasoup and mediasoup-client packages.
 * 
 */

// Stub types
type RtpCapabilities = any;
type Producer = any;
type Consumer = any;
type Transport = any;
type Device = any;
type DtlsParameters = any;
type IceCandidate = any;
type IceParameters = any;

export interface TransportOptions {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  iceServers?: RTCIceServer[];
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

export class MediasoupClient {
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private eventHandlers: Partial<MediasoupClientEvents> = {};

  get isLoaded(): boolean {
    return false;
  }

  get rtpCapabilities(): RtpCapabilities | null {
    return null;
  }

  on<K extends keyof MediasoupClientEvents>(
    event: K,
    handler: MediasoupClientEvents[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  async loadDevice(routerRtpCapabilities: RtpCapabilities): Promise<void> {
    throw new Error("Voice/Video features are disabled (mediasoup not installed)");
  }

  async createSendTransport(transportOptions: TransportOptions): Promise<Transport> {
    throw new Error("Voice/Video features are disabled (mediasoup not installed)");
  }

  async createRecvTransport(transportOptions: TransportOptions): Promise<Transport> {
    throw new Error("Voice/Video features are disabled (mediasoup not installed)");
  }

  async produce(options: ProducerOptions): Promise<Producer> {
    throw new Error("Voice/Video features are disabled (mediasoup not installed)");
  }

  async consume(options: ConsumerOptions): Promise<Consumer> {
    throw new Error("Voice/Video features are disabled (mediasoup not installed)");
  }

  closeProducer(producerId: string): void {
    // no-op
  }

  closeConsumer(consumerId: string): void {
    // no-op
  }

  getProducers(): Producer[] {
    return [];
  }

  getConsumers(): Consumer[] {
    return [];
  }

  close(): void {
    this.producers.clear();
    this.consumers.clear();
  }
}

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
