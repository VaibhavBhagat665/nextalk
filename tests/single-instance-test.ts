/**
 * Single Instance Message Delivery Test
 * 
 * Tests basic message delivery within a single Socket.io instance
 * This is a simpler test to validate the test framework before testing cross-instance
 * 
 * Requirements: 1.1, 1.2
 */

import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:3001";

interface TestClient {
  socket: Socket;
  userId: string;
  username: string;
  receivedMessages: any[];
}

function createTestClient(userId: string, username: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
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
      console.log(`✅ ${username} connected`);
      resolve(client);
    });

    socket.on("connect_error", (error) => {
      console.error(`❌ ${username} connection failed:`, error.message);
      reject(error);
    });

    socket.on("message:new", (data) => {
      client.receivedMessages.push({
        ...data,
        receivedAt: Date.now(),
      });
      console.log(`  📨 ${username} received: "${data.content}" from ${data.username}`);
    });
  });
}

async function runTest() {
  console.log("\n" + "=".repeat(60));
  console.log("Single Instance Message Delivery Test");
  console.log("=".repeat(60));
  console.log(`\nConnecting to: ${SOCKET_URL}\n`);
  
  const clients: TestClient[] = [];
  const channelId = "test-channel-" + Date.now();
  
  try {
    // Create 3 test clients
    console.log("Creating test clients...\n");
    for (let i = 0; i < 3; i++) {
      const client = await createTestClient(`user-${i + 1}`, `TestUser${i + 1}`);
      clients.push(client);
    }
    
    // Join channel
    console.log(`\n📌 Joining channel: ${channelId}\n`);
    for (const client of clients) {
      await new Promise<void>((resolve) => {
        client.socket.emit("channel:join", channelId);
        setTimeout(resolve, 100);
      });
      console.log(`  ${client.username} joined`);
    }
    
    // Wait for joins to propagate
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Send test messages
    console.log(`\n📤 Sending test messages...\n`);
    for (let i = 0; i < 2; i++) {
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
      
      if (i < 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    
    // Wait for messages to be delivered
    console.log(`\n⏳ Waiting for messages to be delivered...\n`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Verify delivery
    console.log("📊 Verification Results:\n");
    const expectedCount = 6; // 3 clients * 2 messages
    let allPassed = true;
    
    for (const client of clients) {
      const received = client.receivedMessages.length;
      const status = received === expectedCount ? "✅" : "❌";
      console.log(`  ${status} ${client.username}: ${received}/${expectedCount} messages`);
      
      if (received !== expectedCount) {
        allPassed = false;
      }
    }
    
    console.log("\n" + "=".repeat(60));
    if (allPassed) {
      console.log("✅ TEST PASSED: All messages delivered correctly");
      console.log("=".repeat(60));
      process.exit(0);
    } else {
      console.log("❌ TEST FAILED: Some messages were not delivered");
      console.log("=".repeat(60));
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error("\n❌ TEST ERROR:", error.message);
    console.error("\nMake sure the Socket.io server is running:");
    console.error("  npm run dev:socket");
    process.exit(1);
  } finally {
    // Cleanup
    for (const client of clients) {
      client.socket.disconnect();
    }
  }
}

// Run test
if (require.main === module) {
  runTest().catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
}

export { runTest };
