/**
 * Test script for cross-instance message delivery via Redis pub/sub
 * 
 * This script:
 * 1. Starts two Socket.io server instances on different ports
 * 2. Connects clients to different instances
 * 3. Sends messages from one client and verifies delivery to other clients
 * 4. Validates Redis pub/sub fanout is working correctly
 */

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

const REDIS_URL = process.env.UPSTASH_REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ UPSTASH_REDIS_URL not configured");
  process.exit(1);
}

interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

async function createSocketServer(port: number): Promise<SocketIOServer> {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket"],
  });

  // Attach Redis adapter
  const pubClient = new Redis(REDIS_URL);
  const subClient = pubClient.duplicate();

  await new Promise<void>((resolve, reject) => {
    subClient.on("connect", () => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log(`✅ Server on port ${port} - Redis adapter attached`);
      resolve();
    });
    subClient.on("error", reject);
  });

  // Simple message broadcast handler
  io.on("connection", (socket) => {
    socket.on("test:message", (data: any) => {
      io.emit("test:broadcast", {
        ...data,
        serverPort: port,
        timestamp: Date.now(),
      });
    });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => {
      console.log(`🚀 Test server ${port} started`);
      resolve();
    });
  });

  return io;
}

function createClient(port: number): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ["websocket"],
    });

    client.on("connect", () => {
      console.log(`🟢 Client connected to port ${port}`);
      resolve(client);
    });

    client.on("connect_error", reject);

    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });
}

async function testCrossInstanceDelivery(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  console.log("\n🧪 Starting cross-instance message delivery test...\n");

  // Step 1: Start two server instances
  console.log("📦 Starting server instances...");
  const server1 = await createSocketServer(3101);
  const server2 = await createSocketServer(3102);
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for Redis sync

  // Step 2: Connect clients to different servers
  console.log("\n🔌 Connecting clients to different servers...");
  const client1 = await createClient(3101);
  const client2 = await createClient(3102);
  const client3 = await createClient(3101); // Another client on server 1

  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 3: Set up listeners
  console.log("\n👂 Setting up message listeners...");
  
  const receivedMessages = {
    client1: [] as any[],
    client2: [] as any[],
    client3: [] as any[],
  };

  client1.on("test:broadcast", (data) => receivedMessages.client1.push(data));
  client2.on("test:broadcast", (data) => receivedMessages.client2.push(data));
  client3.on("test:broadcast", (data) => receivedMessages.client3.push(data));

  // Step 4: Send message from client1 (connected to server1)
  console.log("\n📤 Client1 (server 3101) sending test message...");
  const sendTime = Date.now();
  client1.emit("test:message", {
    content: "Hello from client1",
    testId: "test-001",
  });

  // Wait for message propagation
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 5: Verify delivery
  console.log("\n✅ Verifying message delivery...\n");

  // Test 1: Client2 (on different server) should receive the message
  if (receivedMessages.client2.length > 0) {
    const msg = receivedMessages.client2[0];
    const latency = msg.timestamp - sendTime;
    results.push({
      success: true,
      message: `✅ Cross-instance delivery: Client2 (server 3102) received message from Client1 (server 3101)`,
      latency,
    });
    console.log(`   Latency: ${latency}ms`);
  } else {
    results.push({
      success: false,
      message: `❌ Cross-instance delivery FAILED: Client2 did not receive message`,
    });
  }

  // Test 2: Client3 (on same server) should also receive the message
  if (receivedMessages.client3.length > 0) {
    results.push({
      success: true,
      message: `✅ Same-instance delivery: Client3 (server 3101) received message from Client1`,
    });
  } else {
    results.push({
      success: false,
      message: `❌ Same-instance delivery FAILED: Client3 did not receive message`,
    });
  }

  // Test 3: Client1 (sender) should also receive its own message via broadcast
  if (receivedMessages.client1.length > 0) {
    results.push({
      success: true,
      message: `✅ Sender receives broadcast: Client1 received its own message`,
    });
  } else {
    results.push({
      success: false,
      message: `❌ Sender broadcast FAILED: Client1 did not receive its own message`,
    });
  }

  // Cleanup
  console.log("\n🧹 Cleaning up...");
  client1.disconnect();
  client2.disconnect();
  client3.disconnect();
  server1.close();
  server2.close();

  return results;
}

// Run the test
(async () => {
  try {
    const results = await testCrossInstanceDelivery();
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST RESULTS");
    console.log("=".repeat(60) + "\n");
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.message}`);
      if (result.latency) {
        console.log(`   └─ Latency: ${result.latency}ms`);
      }
    });
    
    const allPassed = results.every(r => r.success);
    const passedCount = results.filter(r => r.success).length;
    
    console.log("\n" + "=".repeat(60));
    console.log(`Summary: ${passedCount}/${results.length} tests passed`);
    console.log("=".repeat(60) + "\n");
    
    if (allPassed) {
      console.log("✅ All tests passed! Redis pub/sub is working correctly.\n");
      process.exit(0);
    } else {
      console.log("❌ Some tests failed. Check Redis configuration.\n");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ Test failed with error:", error.message);
    process.exit(1);
  }
})();
