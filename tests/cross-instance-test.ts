/**
 * Cross-Instance Message Delivery Test
 * 
 * Tests that messages sent to one Socket.io instance are delivered to clients
 * connected to other instances via Redis pub/sub fanout.
 * 
 * Requirements: 1.7
 * Validates: Property 2 - Cross-Instance Message Delivery
 */

import { io, Socket } from "socket.io-client";

// Configuration
const INSTANCE_URLS = [
  "http://localhost:3001", // Instance 1
  "http://localhost:3002", // Instance 2  
  "http://localhost:3003", // Instance 3
];

// Or use nginx load balancer
const NGINX_URL = "http://localhost:8080";

interface TestClient {
  socket: Socket;
  userId: string;
  username: string;
  receivedMessages: any[];
  connectedTo?: string;
}

interface TestConfig {
  useNginx: boolean;
  channelId: string;
  messageCount: number;
  testDurationMs: number;
}

/**
 * Create a test client that connects to a specific instance or nginx
 */
function createTestClient(
  url: string,
  userId: string,
  username: string
): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      auth: {
        userId,
        username,
        token: "test-token",
      },
      transports: ["websocket"],
      reconnection: false,
    });

    const client: TestClient = {
      socket,
      userId,
      username,
      receivedMessages: [],
    };

    socket.on("connect", () => {
      console.log(`✅ ${username} connected to ${url}`);
      resolve(client);
    });

    socket.on("connect_error", (error) => {
      console.error(`❌ ${username} failed to connect:`, error.message);
      reject(error);
    });

    // Track received messages
    socket.on("message:new", (data) => {
      client.receivedMessages.push({
        ...data,
        receivedAt: Date.now(),
      });
    });
  });
}

/**
 * Join a channel for all clients
 */
async function joinChannel(clients: TestClient[], channelId: string): Promise<void> {
  console.log(`\n📌 Joining channel: ${channelId}`);
  
  for (const client of clients) {
    await new Promise<void>((resolve) => {
      client.socket.emit("channel:join", channelId);
      // Give server time to process join
      setTimeout(resolve, 100);
    });
    console.log(`  ${client.username} joined channel`);
  }
  
  // Wait for all joins to propagate
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Send test messages from each client
 */
async function sendTestMessages(
  clients: TestClient[],
  channelId: string,
  messagesPerClient: number
): Promise<void> {
  console.log(`\n📤 Sending ${messagesPerClient} messages from each client...`);
  
  for (let i = 0; i < messagesPerClient; i++) {
    for (const client of clients) {
      const content = `Test message ${i + 1} from ${client.username}`;
      const tempId = `temp-${client.userId}-${Date.now()}-${i}`;
      
      client.socket.emit("message:send", {
        channelId,
        content,
        tempId,
      });
      
      console.log(`  ${client.username}: "${content}"`);
    }
    
    // Delay between rounds to avoid rate limiting
    if (i < messagesPerClient - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  
  // Wait for all messages to propagate
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Verify that all clients received all messages
 */
function verifyMessageDelivery(
  clients: TestClient[],
  expectedMessageCount: number
): boolean {
  console.log(`\n📊 Verifying message delivery...`);
  console.log(`Expected: ${expectedMessageCount} messages per client`);
  
  let allReceived = true;
  
  for (const client of clients) {
    const received = client.receivedMessages.length;
    const status = received === expectedMessageCount ? "✅" : "❌";
    
    console.log(`  ${status} ${client.username}: received ${received}/${expectedMessageCount}`);
    
    if (received !== expectedMessageCount) {
      allReceived = false;
      
      // Debug: show which messages were received
      const senders = new Set(client.receivedMessages.map(m => m.username));
      console.log(`    Received from: ${Array.from(senders).join(", ")}`);
    }
  }
  
  return allReceived;
}

/**
 * Test cross-instance delivery with direct connections to instances
 */
async function testDirectInstanceConnections(
  channelId: string,
  messagesPerClient: number
): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Direct Instance Connections");
  console.log("=".repeat(60));
  console.log("Each client connects to a different Socket.io instance");
  console.log("Messages should be delivered via Redis pub/sub\n");
  
  const clients: TestClient[] = [];
  
  try {
    // Create clients, each connected to a different instance
    for (let i = 0; i < INSTANCE_URLS.length; i++) {
      const url = INSTANCE_URLS[i];
      const userId = `user-${i + 1}`;
      const username = `TestUser${i + 1}`;
      
      const client = await createTestClient(url, userId, username);
      client.connectedTo = url;
      clients.push(client);
    }
    
    // Join channel
    await joinChannel(clients, channelId);
    
    // Send messages
    await sendTestMessages(clients, channelId, messagesPerClient);
    
    // Verify delivery
    const totalMessages = clients.length * messagesPerClient;
    const success = verifyMessageDelivery(clients, totalMessages);
    
    if (success) {
      console.log("\n✅ TEST 1 PASSED: All messages delivered across instances");
    } else {
      console.log("\n❌ TEST 1 FAILED: Some messages were not delivered");
    }
    
    return success;
  } catch (error: any) {
    console.error("\n❌ TEST 1 ERROR:", error.message);
    return false;
  } finally {
    // Cleanup
    for (const client of clients) {
      client.socket.disconnect();
    }
  }
}

/**
 * Test cross-instance delivery through nginx load balancer
 */
async function testNginxLoadBalancer(
  channelId: string,
  messagesPerClient: number,
  clientCount: number
): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: nginx Load Balancer");
  console.log("=".repeat(60));
  console.log(`${clientCount} clients connect through nginx`);
  console.log("nginx will distribute them across instances with sticky sessions");
  console.log("Messages should be delivered via Redis pub/sub\n");
  
  const clients: TestClient[] = [];
  
  try {
    // Create multiple clients through nginx
    for (let i = 0; i < clientCount; i++) {
      const userId = `nginx-user-${i + 1}`;
      const username = `NginxUser${i + 1}`;
      
      const client = await createTestClient(NGINX_URL, userId, username);
      client.connectedTo = NGINX_URL;
      clients.push(client);
    }
    
    // Join channel
    await joinChannel(clients, channelId);
    
    // Send messages
    await sendTestMessages(clients, channelId, messagesPerClient);
    
    // Verify delivery
    const totalMessages = clients.length * messagesPerClient;
    const success = verifyMessageDelivery(clients, totalMessages);
    
    if (success) {
      console.log("\n✅ TEST 2 PASSED: All messages delivered through nginx");
    } else {
      console.log("\n❌ TEST 2 FAILED: Some messages were not delivered");
    }
    
    return success;
  } catch (error: any) {
    console.error("\n❌ TEST 2 ERROR:", error.message);
    return false;
  } finally {
    // Cleanup
    for (const client of clients) {
      client.socket.disconnect();
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("\n" + "=".repeat(60));
  console.log("Cross-Instance Message Delivery Test");
  console.log("=".repeat(60));
  console.log("\nThis test verifies that messages are properly delivered");
  console.log("across multiple Socket.io instances via Redis pub/sub.");
  console.log("\nPrerequisites:");
  console.log("  - Run: docker-compose up -d");
  console.log("  - Wait for all services to be healthy");
  console.log("  - Redis should be running on port 6379");
  console.log("  - Socket.io instances on ports 3001, 3002, 3003");
  console.log("  - nginx on port 8080\n");
  
  const channelId = "test-channel-" + Date.now();
  const messagesPerClient = 2;
  
  // Wait for services to be ready
  console.log("⏳ Waiting 3 seconds for services to be ready...\n");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  
  const results: boolean[] = [];
  
  // Test 1: Direct instance connections
  try {
    const result1 = await testDirectInstanceConnections(channelId, messagesPerClient);
    results.push(result1);
  } catch (error: any) {
    console.error("Test 1 crashed:", error);
    results.push(false);
  }
  
  // Wait between tests
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Test 2: nginx load balancer
  try {
    const result2 = await testNginxLoadBalancer(channelId, messagesPerClient, 5);
    results.push(result2);
  } catch (error: any) {
    console.error("Test 2 crashed:", error);
    results.push(false);
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter((r) => r).length;
  const total = results.length;
  
  console.log(`\nTests passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log("\n🎉 ALL TESTS PASSED");
    console.log("\nProperty 2 validated: Cross-instance message delivery works correctly.");
    console.log("Messages are successfully fanned out via Redis pub/sub.");
    process.exit(0);
  } else {
    console.log("\n❌ SOME TESTS FAILED");
    console.log("\nPlease check:");
    console.log("  1. All Docker containers are running");
    console.log("  2. Redis is connected (check /health endpoint)");
    console.log("  3. No firewall blocking ports");
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
}

export { testDirectInstanceConnections, testNginxLoadBalancer };
