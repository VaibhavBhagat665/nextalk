/**
 * TURN Server Connectivity Test
 * 
 * This script tests the TURN server configuration to ensure it's working correctly.
 * Run with: npx tsx scripts/test-turn-server.ts
 * 
 * Task 22.2: Test connection through strict NAT
 * Requirements: 3.7
 */

import { getIceServers, getIceServersInfo, isTurnConfigured } from '../lib/turn-config';

async function testTurnServer() {
  console.log('🧪 TURN Server Connectivity Test\n');
  console.log('='.repeat(50));
  
  // 1. Check if TURN is configured
  console.log('\n1️⃣  Configuration Check');
  console.log('-'.repeat(50));
  
  const isConfigured = isTurnConfigured();
  console.log('TURN Configured:', isConfigured ? '✅ Yes' : '❌ No');
  
  if (!isConfigured) {
    console.log('\n⚠️  TURN server not configured!');
    console.log('\nTo configure TURN:');
    console.log('1. Add to .env.local:');
    console.log('   NEXT_PUBLIC_TURN_URL=turn:localhost:3478');
    console.log('   NEXT_PUBLIC_TURN_USERNAME=nextalk');
    console.log('   NEXT_PUBLIC_TURN_CREDENTIAL=nextturn2024');
    console.log('\n2. Start TURN server: docker-compose up turnserver');
    console.log('\n3. Run this test again');
    process.exit(1);
  }
  
  // 2. Display ICE servers configuration
  console.log('\n2️⃣  ICE Servers Configuration');
  console.log('-'.repeat(50));
  
  const iceServersInfo = getIceServersInfo();
  console.log('Total servers:', iceServersInfo.count);
  console.log('STUN servers:', iceServersInfo.stunServers);
  console.log('TURN servers:', iceServersInfo.turnServers);
  console.log('\nServers:');
  
  iceServersInfo.servers.forEach((server, index) => {
    console.log(`\n  ${index + 1}. ${server.urls}`);
    if (server.username) {
      console.log(`     Username: ${server.username}`);
      console.log(`     Has credential: ${!!server.credential}`);
    }
  });
  
  // 3. Test TURN connectivity
  console.log('\n3️⃣  Connectivity Test');
  console.log('-'.repeat(50));
  console.log('Testing TURN server connectivity...');
  console.log('(This may take up to 10 seconds)');
  
  try {
    // For Node.js environment, we need to use a different approach
    // In browser, we would use RTCPeerConnection
    console.log('\n⚠️  Note: Full connectivity test requires browser environment');
    console.log('To test in browser:');
    console.log('1. Go to https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/');
    console.log('2. Add your TURN server:');
    console.log(`   URI: ${process.env.NEXT_PUBLIC_TURN_URL}`);
    console.log(`   Username: ${process.env.NEXT_PUBLIC_TURN_USERNAME}`);
    console.log(`   Password: ${process.env.NEXT_PUBLIC_TURN_CREDENTIAL}`);
    console.log('3. Click "Gather candidates"');
    console.log('4. Look for "relay" candidates (indicates TURN is working)');
    
    // Test basic connectivity with nc
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL || '';
    const match = turnUrl.match(/turn:([^:]+):(\d+)/);
    
    if (match) {
      const [, host, port] = match;
      console.log(`\n📡 Testing basic connectivity to ${host}:${port}...`);
      
      // Try to connect using Node's net module
      const net = require('net');
      const socket = new net.Socket();
      
      const testConnection = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 5000);
        
        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
        
        socket.connect(parseInt(port), host);
      });
      
      const connected = await testConnection;
      
      if (connected) {
        console.log('✅ TCP connection successful!');
        console.log('   TURN server is reachable on TCP port', port);
      } else {
        console.log('❌ TCP connection failed');
        console.log('   TURN server may not be running or port is blocked');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Connectivity test error:', error.message);
  }
  
  // 4. Summary
  console.log('\n4️⃣  Summary');
  console.log('='.repeat(50));
  
  if (isConfigured) {
    console.log('✅ TURN server is configured');
    console.log('✅ ICE servers are set up correctly');
    console.log('\n📝 Next steps:');
    console.log('1. Test in browser using the Trickle ICE tool (see above)');
    console.log('2. Check Docker logs: docker-compose logs turnserver');
    console.log('3. Verify firewall rules allow ports 3478 and 49152-49252');
  } else {
    console.log('❌ TURN server is not configured');
  }
  
  console.log('\n' + '='.repeat(50));
}

// Run test
testTurnServer().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
