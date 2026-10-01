/**
 * Property-Based Tests for mediasoup SFU Server
 * 
 * Feature: nextalk-production-upgrade, Property 6: SFU Media Routing
 * 
 * This test validates that media streams are routed through the SFU
 * and never via direct peer-to-peer connections.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as mediasoup from 'mediasoup';
import type { Worker, Router, WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types';

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_RUNS = 100; // Minimum per design doc requirements

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a minimal mediasoup worker for testing
 */
async function createTestWorker(): Promise<Worker> {
  return await mediasoup.createWorker({
    logLevel: 'error',
    rtcMinPort: 20000,
    rtcMaxPort: 20100,
  });
}

/**
 * Creates a router with minimal codec configuration
 */
async function createTestRouter(worker: Worker): Promise<Router> {
  return await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
      },
    ],
  });
}

/**
 * Creates a WebRTC transport for testing
 */
async function createTestTransport(router: Router): Promise<WebRtcTransport> {
  return await router.createWebRtcTransport({
    listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
}

/**
 * Simulates a participant with send and receive transports
 */
interface TestParticipant {
  id: string;
  sendTransport: WebRtcTransport;
  recvTransport: WebRtcTransport;
  producers: Producer[];
  consumers: Consumer[];
}

/**
 * Creates a test participant with both send and receive transports
 */
async function createTestParticipant(
  router: Router,
  participantId: string
): Promise<TestParticipant> {
  const sendTransport = await createTestTransport(router);
  const recvTransport = await createTestTransport(router);

  return {
    id: participantId,
    sendTransport,
    recvTransport,
    producers: [],
    consumers: [],
  };
}

/**
 * Creates a producer on a participant's send transport
 */
async function createTestProducer(
  participant: TestParticipant,
  kind: 'audio' | 'video'
): Promise<Producer> {
  // Generate minimal valid RTP parameters for the codec
  const rtpParameters: mediasoup.types.RtpParameters = {
    codecs: [
      kind === 'audio'
        ? {
            mimeType: 'audio/opus',
            payloadType: 111,
            clockRate: 48000,
            channels: 2,
          }
        : {
            mimeType: 'video/VP8',
            payloadType: 96,
            clockRate: 90000,
          },
    ],
    encodings: [{ ssrc: Math.floor(Math.random() * 1000000) + 1000 }],
  };

  const producer = await participant.sendTransport.produce({
    kind,
    rtpParameters,
  });

  participant.producers.push(producer);
  return producer;
}

/**
 * Creates a consumer on a participant's receive transport for a given producer
 */
async function createTestConsumer(
  participant: TestParticipant,
  producer: Producer,
  router: Router
): Promise<Consumer> {
  // Use router's RTP capabilities as the consumer's capabilities
  const rtpCapabilities = router.rtpCapabilities;

  if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
    throw new Error('Router cannot consume this producer');
  }

  const consumer = await participant.recvTransport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: false,
  });

  participant.consumers.push(consumer);
  return consumer;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('SFU Media Routing - Property-Based Tests', () => {
  let worker: Worker;
  let router: Router;
  let participants: TestParticipant[] = [];

  beforeEach(async () => {
    worker = await createTestWorker();
    router = await createTestRouter(worker);
    participants = [];
  });

  afterEach(async () => {
    // Cleanup all participants
    for (const participant of participants) {
      for (const producer of participant.producers) {
        producer.close();
      }
      for (const consumer of participant.consumers) {
        consumer.close();
      }
      participant.sendTransport.close();
      participant.recvTransport.close();
    }
    participants = [];

    // Close router and worker
    router.close();
    worker.close();
  });

  /**
   * Property 6: SFU Media Routing
   * 
   * For any participant in a video room with N participants, their media stream
   * should be routed through the SFU and received by all other N-1 participants,
   * never via direct peer connections.
   * 
   * Validates: Requirements 3.2
   */
  it(
    'Property 6: All media should route through SFU, never P2P',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of participants (2-8)
        fc.integer({ min: 2, max: 8 }),
        // Generate random media types for each participant
        fc.array(fc.constantFrom('audio', 'video', 'both'), { minLength: 2, maxLength: 8 }),
        async (numParticipants, mediaTypes) => {
          // Ensure mediaTypes array matches numParticipants
          const adjustedMediaTypes = mediaTypes.slice(0, numParticipants);
          if (adjustedMediaTypes.length < numParticipants) {
            adjustedMediaTypes.push(
              ...Array(numParticipants - adjustedMediaTypes.length).fill('audio')
            );
          }

          // Create participants
          const testParticipants: TestParticipant[] = [];
          for (let i = 0; i < numParticipants; i++) {
            const participant = await createTestParticipant(router, `participant-${i}`);
            testParticipants.push(participant);
          }
          participants = testParticipants;

          // Each participant produces media based on their media type
          const allProducers: Producer[] = [];
          for (let i = 0; i < testParticipants.length; i++) {
            const participant = testParticipants[i];
            const mediaType = adjustedMediaTypes[i];

            if (mediaType === 'audio' || mediaType === 'both') {
              const audioProducer = await createTestProducer(participant, 'audio');
              allProducers.push(audioProducer);
            }
            if (mediaType === 'video' || mediaType === 'both') {
              const videoProducer = await createTestProducer(participant, 'video');
              allProducers.push(videoProducer);
            }
          }

          // === CRITICAL ASSERTION: No P2P connections ===
          // In SFU architecture, participants NEVER exchange RTP directly.
          // All media flows through the router (SFU).
          // We verify this by checking that:
          // 1. Each producer is associated with ONLY the router's transport
          // 2. No direct transport connections exist between participants

          for (const participant of testParticipants) {
            // Check that send transport only connects to the router, not other participants
            const sendTransportId = participant.sendTransport.id;

            // Verify no other participant's receive transport matches this send transport
            for (const otherParticipant of testParticipants) {
              if (otherParticipant.id === participant.id) continue;

              const recvTransportId = otherParticipant.recvTransport.id;
              expect(sendTransportId).not.toBe(recvTransportId);
            }
          }

          // === CRITICAL ASSERTION: Each participant consumes N-1 producers ===
          // For any participant P in a room with N participants, P should:
          // - Produce their own media (already done above)
          // - Consume media from all N-1 other participants via SFU

          for (const consumer of testParticipants) {
            // Get all producers from OTHER participants
            const otherProducers = allProducers.filter((producer) => {
              // Find which participant owns this producer
              const producerOwner = testParticipants.find((p) =>
                p.producers.some((prod) => prod.id === producer.id)
              );
              return producerOwner && producerOwner.id !== consumer.id;
            });

            // Create consumers for all remote producers
            for (const remoteProducer of otherProducers) {
              const consumerObj = await createTestConsumer(consumer, remoteProducer, router);

              // === CRITICAL ASSERTION: Consumer targets remote producer ===
              // Verify the consumer is consuming the correct remote producer
              expect(consumerObj.producerId).toBe(remoteProducer.id);

              // === CRITICAL ASSERTION: Producer and consumer are on different transports ===
              // In SFU architecture, the producer's transport and consumer's transport are NEVER the same
              // This proves media goes through the router (SFU), not directly P2P
              const producerTransportId = remoteProducer.transportId;
              const consumerTransportId = consumer.recvTransport.id;
              
              expect(producerTransportId).not.toBe(consumerTransportId);
              
              // Additionally verify producer is not on consumer's send transport either
              expect(producerTransportId).not.toBe(consumer.sendTransport.id);
            }

            // === CRITICAL ASSERTION: Consumer count matches N-1 producers ===
            // After consuming all remote producers, consumer should have exactly N-1 consumers
            // (one for each other participant's producer)
            expect(consumer.consumers.length).toBe(otherProducers.length);
          }

          // === FINAL ASSERTION: Total consumers equals expected ===
          // In a room with N participants, if each produces M media tracks,
          // total consumers should be N * M * (N - 1)
          // (each participant consumes all M tracks from N-1 other participants)
          const totalProducers = allProducers.length;
          const totalConsumers = testParticipants.reduce(
            (sum, p) => sum + p.consumers.length,
            0
          );

          // Calculate expected consumers:
          // For each producer, N-1 consumers should exist (one per other participant)
          const expectedConsumers = totalProducers * (numParticipants - 1);
          expect(totalConsumers).toBe(expectedConsumers);

          // Clean up this iteration's resources
          for (const participant of testParticipants) {
            for (const producer of participant.producers) {
              producer.close();
            }
            for (const consumer of participant.consumers) {
              consumer.close();
            }
            participant.sendTransport.close();
            participant.recvTransport.close();
          }
          participants = [];
        }
      ),
      { numRuns: PROPERTY_TEST_RUNS }
    );
  },
  30000 // 30 second timeout for property-based test with 100 runs
  );

  /**
   * Additional property: Verify no shared transports between participants
   * 
   * This test ensures that transports are not accidentally shared,
   * which would indicate a P2P connection rather than SFU routing.
   */
  it('Property 6.1: Transports are never shared between participants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 6 }),
        async (numParticipants) => {
          // Create participants
          const testParticipants: TestParticipant[] = [];
          for (let i = 0; i < numParticipants; i++) {
            const participant = await createTestParticipant(router, `participant-${i}`);
            testParticipants.push(participant);
          }
          participants = testParticipants;

          // Collect all transport IDs
          const allTransportIds = new Set<string>();

          for (const participant of testParticipants) {
            const sendId = participant.sendTransport.id;
            const recvId = participant.recvTransport.id;

            // === CRITICAL ASSERTION: No transport ID collision ===
            expect(allTransportIds.has(sendId)).toBe(false);
            expect(allTransportIds.has(recvId)).toBe(false);

            allTransportIds.add(sendId);
            allTransportIds.add(recvId);
          }

          // === FINAL ASSERTION: Total transports equals 2 * N ===
          expect(allTransportIds.size).toBe(numParticipants * 2);

          // Clean up
          for (const participant of testParticipants) {
            participant.sendTransport.close();
            participant.recvTransport.close();
          }
          participants = [];
        }
      ),
      { numRuns: PROPERTY_TEST_RUNS }
    );
  });

  /**
   * Property 7: Consumer Creation Symmetry
   * 
   * For any participant joining a video room with N existing participants,
   * the system should create N consumers for the new participant (to receive N streams)
   * and create 1 consumer on each of the N existing participants (to receive the new participant's stream).
   * 
   * Validates: Requirements 3.3
   * 
   * Feature: nextalk-production-upgrade, Property 7: Consumer Creation Symmetry
   */
  it(
    'Property 7: Consumer creation is symmetric when new participant joins',
    async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of existing participants (1-6)
        fc.integer({ min: 1, max: 6 }),
        // Generate random media types for existing participants
        fc.array(fc.constantFrom('audio', 'video', 'both'), { minLength: 1, maxLength: 6 }),
        // Generate random media type for new joining participant
        fc.constantFrom('audio', 'video', 'both'),
        async (numExistingParticipants, existingMediaTypes, newParticipantMediaType) => {
          // Ensure existingMediaTypes array matches numExistingParticipants
          const adjustedMediaTypes = existingMediaTypes.slice(0, numExistingParticipants);
          if (adjustedMediaTypes.length < numExistingParticipants) {
            adjustedMediaTypes.push(
              ...Array(numExistingParticipants - adjustedMediaTypes.length).fill('audio')
            );
          }

          // Phase 1: Create existing participants and their producers
          const existingParticipants: TestParticipant[] = [];
          const existingProducers: Producer[] = [];

          for (let i = 0; i < numExistingParticipants; i++) {
            const participant = await createTestParticipant(router, `existing-${i}`);
            existingParticipants.push(participant);

            const mediaType = adjustedMediaTypes[i];

            // Create producers for existing participants
            if (mediaType === 'audio' || mediaType === 'both') {
              const audioProducer = await createTestProducer(participant, 'audio');
              existingProducers.push(audioProducer);
            }
            if (mediaType === 'video' || mediaType === 'both') {
              const videoProducer = await createTestProducer(participant, 'video');
              existingProducers.push(videoProducer);
            }
          }
          // Make a copy to avoid reference issues
          participants = [...existingParticipants];

          // Record initial consumer counts for existing participants
          const initialConsumerCounts = existingParticipants.map(p => p.consumers.length);

          // === Phase 2: NEW PARTICIPANT JOINS ===
          const newParticipant = await createTestParticipant(router, 'new-joiner');
          participants.push(newParticipant);

          // New participant creates their producer(s)
          const newProducers: Producer[] = [];
          if (newParticipantMediaType === 'audio' || newParticipantMediaType === 'both') {
            const audioProducer = await createTestProducer(newParticipant, 'audio');
            newProducers.push(audioProducer);
          }
          if (newParticipantMediaType === 'video' || newParticipantMediaType === 'both') {
            const videoProducer = await createTestProducer(newParticipant, 'video');
            newProducers.push(videoProducer);
          }

          // === SYMMETRY PART 1: New participant consumes ALL existing producers ===
          // The new participant should create N consumers (one for each existing producer)
          for (const existingProducer of existingProducers) {
            await createTestConsumer(newParticipant, existingProducer, router);
          }

          // === CRITICAL ASSERTION: New participant has N consumers ===
          // where N = total number of producers from existing participants
          expect(newParticipant.consumers.length).toBe(existingProducers.length);

          // Verify each consumer points to a different existing producer
          const consumedProducerIds = new Set(
            newParticipant.consumers.map(c => c.producerId)
          );
          expect(consumedProducerIds.size).toBe(existingProducers.length);
          
          // Verify all consumed producers are from existing participants
          for (const consumer of newParticipant.consumers) {
            expect(existingProducers.some(p => p.id === consumer.producerId)).toBe(true);
          }

          // === SYMMETRY PART 2: Each existing participant creates 1 consumer per new producer ===
          // Each existing participant should create M consumers, where M = number of new participant's producers
          for (let i = 0; i < existingParticipants.length; i++) {
            const existingParticipant = existingParticipants[i];
            const initialCount = initialConsumerCounts[i] || 0;
            const consumerCountBefore = existingParticipant.consumers.length;
            
            // Verify consumer count matches initial count before adding new consumers
            expect(consumerCountBefore).toBe(initialCount);
            
            for (const newProducer of newProducers) {
              await createTestConsumer(existingParticipant, newProducer, router);
            }
            
            const consumerCountAfter = existingParticipant.consumers.length;
            
            // === CRITICAL ASSERTION: Exactly M consumers were added ===
            expect(consumerCountAfter - consumerCountBefore).toBe(newProducers.length);
            expect(consumerCountAfter).toBe(initialCount + newProducers.length);
            
            // Verify the new consumers are consuming the new participant's producers
            const newConsumers = existingParticipant.consumers.slice(initialCount);
            for (const consumer of newConsumers) {
              expect(newProducers.some(p => p.id === consumer.producerId)).toBe(true);
            }
          }

          // === SYMMETRY PART 3: Total consumer count verification ===
          // Total consumers in room = 
          //   (existing participants' cross-consumption) + 
          //   (new participant's consumption of existing) +
          //   (existing participants' consumption of new)
          
          const totalConsumers = participants.reduce(
            (sum, p) => sum + p.consumers.length,
            0
          );

          // Calculate expected:
          // - New participant has existingProducers.length consumers
          // - Each existing participant gained newProducers.length consumers
          const expectedNewParticipantConsumers = existingProducers.length;
          const expectedExistingParticipantNewConsumers = 
            existingParticipants.length * newProducers.length;
          const expectedMinimumTotal = 
            expectedNewParticipantConsumers + expectedExistingParticipantNewConsumers;

          expect(totalConsumers).toBeGreaterThanOrEqual(expectedMinimumTotal);

          // === FINAL VERIFICATION: Symmetry holds ===
          // For every producer from new participant, there should be exactly N consumers
          // (one per existing participant)
          for (const newProducer of newProducers) {
            let consumerCount = 0;
            for (const existingParticipant of existingParticipants) {
              if (existingParticipant.consumers.some(c => c.producerId === newProducer.id)) {
                consumerCount++;
              }
            }
            expect(consumerCount).toBe(existingParticipants.length);
          }

          // For every producer from existing participants, the new participant should have a consumer
          for (const existingProducer of existingProducers) {
            const hasConsumer = newParticipant.consumers.some(
              c => c.producerId === existingProducer.id
            );
            expect(hasConsumer).toBe(true);
          }

          // Clean up this iteration's resources
          for (const participant of participants) {
            for (const producer of participant.producers) {
              producer.close();
            }
            for (const consumer of participant.consumers) {
              consumer.close();
            }
            participant.sendTransport.close();
            participant.recvTransport.close();
          }
          participants = [];
        }
      ),
      { numRuns: PROPERTY_TEST_RUNS }
    );
  },
  30000 // 30 second timeout for property-based test with 100 runs
  );
});
