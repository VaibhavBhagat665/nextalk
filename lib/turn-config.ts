/**
 * TURN Server Configuration
 * 
 * Provides ICE server configuration including TURN servers for NAT traversal.
 * TURN servers are used as fallback when direct peer-to-peer connections fail.
 * 
 * Task 22.2: Integrate TURN into ICE configuration
 * Requirements: 3.7
 */

export interface TURNCredentials {
  url: string;
  username?: string;
  credential?: string;
}

/**
 * Get ICE servers configuration including TURN servers
 * 
 * Returns an array of RTCIceServer objects that can be used for WebRTC connections.
 * Falls back to using only default ICE candidates if TURN is not configured.
 * 
 * @returns Array of ICE server configurations
 */
export function getIceServers(): RTCIceServer[] {
  const iceServers: RTCIceServer[] = [];

  // Add public STUN servers (free, for NAT discovery)
  // These help clients discover their public IP and port
  iceServers.push(
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  );

  // Add TURN server if configured (for NAT traversal relay)
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl) {
    const turnServer: RTCIceServer = {
      urls: turnUrl,
    };

    // Add authentication if provided
    if (turnUsername && turnCredential) {
      turnServer.username = turnUsername;
      turnServer.credential = turnCredential;
    }

    iceServers.push(turnServer);

    console.log('🔄 TURN server configured:', {
      url: turnUrl,
      hasAuth: !!(turnUsername && turnCredential),
    });
  } else {
    console.log('ℹ️  TURN server not configured (direct connections only)');
  }

  return iceServers;
}

/**
 * Check if TURN server is configured
 * 
 * @returns true if TURN server is configured, false otherwise
 */
export function isTurnConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_TURN_URL;
}

/**
 * Generate time-limited TURN credentials (for production use)
 * 
 * This function can be called on the server to generate temporary TURN credentials
 * that expire after a certain time period. This is more secure than static credentials.
 * 
 * Example usage on server:
 * ```typescript
 * import { generateTimeBasedTURNCredentials } from '@/lib/turn-config';
 * 
 * const creds = generateTimeBasedTURNCredentials(
 *   'user123',
 *   'your_shared_secret',
 *   86400 // 24 hours
 * );
 * 
 * // Return creds to client via API
 * res.json({ turnCredentials: creds });
 * ```
 * 
 * Server configuration (turnserver.conf):
 * ```
 * use-auth-secret
 * static-auth-secret=your_shared_secret
 * ```
 * 
 * @param username - Unique user identifier
 * @param secret - Shared secret from TURN server config
 * @param ttl - Time to live in seconds (default: 24 hours)
 * @returns TURN credentials with expiration
 */
export function generateTimeBasedTURNCredentials(
  username: string,
  secret: string,
  ttl: number = 86400
): TURNCredentials & { expiry: number } {
  // Only available on server-side
  if (typeof window !== 'undefined') {
    throw new Error('generateTimeBasedTURNCredentials should only be called server-side');
  }

  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const turnUsername = `${timestamp}:${username}`;
  
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(turnUsername);
  const turnCredential = hmac.digest('base64');

  return {
    url: process.env.NEXT_PUBLIC_TURN_URL || '',
    username: turnUsername,
    credential: turnCredential,
    expiry: timestamp,
  };
}

/**
 * Test TURN server connectivity
 * 
 * This function attempts to establish a connection through the TURN server
 * to verify it's working correctly.
 * 
 * @returns Promise that resolves to true if TURN is working, false otherwise
 */
export async function testTurnConnectivity(): Promise<boolean> {
  const iceServers = getIceServers();

  if (!isTurnConfigured()) {
    console.warn('⚠️  TURN server not configured, skipping connectivity test');
    return false;
  }

  try {
    // Create a temporary RTCPeerConnection with TURN servers
    const pc = new RTCPeerConnection({ iceServers });

    return new Promise<boolean>((resolve) => {
      let hasRelayCandidate = false;
      const timeout = setTimeout(() => {
        pc.close();
        resolve(hasRelayCandidate);
      }, 10000); // 10 second timeout

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate type:', event.candidate.type);
          
          // Check if we got a relay candidate (indicates TURN is working)
          if (event.candidate.type === 'relay') {
            hasRelayCandidate = true;
            console.log('✅ TURN server relay candidate received');
          }
        } else {
          // ICE gathering complete
          clearTimeout(timeout);
          pc.close();
          resolve(hasRelayCandidate);
        }
      };

      // Create a dummy data channel to trigger ICE gathering
      pc.createDataChannel('test');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  } catch (error) {
    console.error('❌ TURN connectivity test failed:', error);
    return false;
  }
}

/**
 * Get detailed ICE server statistics
 * 
 * This can be used for debugging and monitoring TURN server usage.
 * 
 * @returns Object containing ICE server configuration details
 */
export function getIceServersInfo() {
  const iceServers = getIceServers();

  return {
    servers: iceServers,
    count: iceServers.length,
    hasTurn: isTurnConfigured(),
    stunServers: iceServers.filter(server => 
      server.urls.toString().startsWith('stun:')
    ).length,
    turnServers: iceServers.filter(server => 
      server.urls.toString().startsWith('turn:')
    ).length,
  };
}
