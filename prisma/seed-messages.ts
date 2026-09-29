/**
 * Message Seeding Script for Database Performance Testing
 * 
 * Generates 1M+ synthetic messages with realistic distribution:
 * - Multiple channels and users
 * - Realistic timestamp distribution (weighted toward recent)
 * - Varied message lengths and types
 * - Some reactions and files
 * 
 * Usage: npx tsx prisma/seed-messages.ts [messageCount]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const TARGET_MESSAGES = parseInt(process.argv[2] || '1000000'); // 1M default
const BATCH_SIZE = 1000;
const NUM_TEST_USERS = 50;
const NUM_TEST_CHANNELS = 10;

// Sample message templates
const MESSAGE_TEMPLATES = [
  "Hey everyone!",
  "Thanks for sharing that.",
  "I agree with what you're saying.",
  "Has anyone tried this approach?",
  "Let me know if you need any help with that.",
  "I think we should discuss this further.",
  "Great point!",
  "I'll look into that and get back to you.",
  "Can someone help me with this?",
  "This is really interesting.",
  "I'm working on implementing the new feature.",
  "The deployment went smoothly today.",
  "We should schedule a meeting to discuss the roadmap.",
  "I found a bug in the authentication flow.",
  "The performance improvements are looking good.",
  "Does anyone have experience with this library?",
  "I updated the documentation.",
  "The tests are passing now.",
  "We need to refactor this module.",
  "I'm available for a code review.",
];

// Generate random timestamp (weighted toward recent)
function randomTimestamp(): Date {
  const now = Date.now();
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  // Exponential distribution - more recent messages
  const random = Math.random();
  const weight = Math.pow(random, 0.3); // Skew toward recent
  const timestamp = oneMonthAgo + weight * (now - oneMonthAgo);
  
  return new Date(timestamp);
}

// Generate random message content
function randomMessage(): string {
  const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)];
  
  // 20% chance of longer message
  if (Math.random() < 0.2) {
    const extraSentences = Math.floor(Math.random() * 3) + 1;
    const sentences = [template];
    for (let i = 0; i < extraSentences; i++) {
      sentences.push(MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)]);
    }
    return sentences.join(' ');
  }
  
  return template;
}

async function main() {
  console.log('🌱 NexTalk Message Seeding Script');
  console.log('===================================\n');
  console.log(`Target: ${TARGET_MESSAGES.toLocaleString()} messages`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  // Step 1: Create test users
  console.log(`📝 Step 1: Creating ${NUM_TEST_USERS} test users...`);
  const testUsers = [];
  for (let i = 0; i < NUM_TEST_USERS; i++) {
    const clerkId = `seed-user-${i}`;
    const existingUser = await prisma.user.findUnique({ where: { clerkId } });
    
    if (existingUser) {
      testUsers.push(existingUser);
    } else {
      const user = await prisma.user.create({
        data: {
          clerkId,
          email: `seed-user-${i}@test.com`,
          username: `TestUser${i}`,
          firstName: `Test`,
          lastName: `User${i}`,
          imageUrl: `https://avatar.vercel.sh/user${i}`,
        },
      });
      testUsers.push(user);
    }
  }
  console.log(`✅ Users ready: ${testUsers.length}`);
  console.log('');

  // Step 2: Create test server and channels
  console.log(`📝 Step 2: Creating test server and ${NUM_TEST_CHANNELS} channels...`);
  let testServer = await prisma.server.findFirst({
    where: { name: 'Performance Test Server' },
  });

  if (!testServer) {
    testServer = await prisma.server.create({
      data: {
        name: 'Performance Test Server',
        icon: '🧪',
        ownerId: testUsers[0].id,
        inviteCode: 'perf-test-server',
      },
    });
  }

  const testChannels = [];
  for (let i = 0; i < NUM_TEST_CHANNELS; i++) {
    const channelName = `test-channel-${i}`;
    let channel = await prisma.channel.findFirst({
      where: { name: channelName, serverId: testServer.id },
    });

    if (!channel) {
      channel = await prisma.channel.create({
        data: {
          name: channelName,
          description: `Performance test channel ${i}`,
          type: 'text',
          serverId: testServer.id,
          creatorId: testUsers[0].id,
        },
      });

      // Create memberships for all test users
      await prisma.membership.createMany({
        data: testUsers.map(user => ({
          userId: user.id,
          channelId: channel!.id,
          role: 'member',
        })),
        skipDuplicates: true,
      });
    }

    testChannels.push(channel);
  }
  console.log(`✅ Channels ready: ${testChannels.length}`);
  console.log('');

  // Step 3: Generate messages
  console.log(`📝 Step 3: Generating ${TARGET_MESSAGES.toLocaleString()} messages...`);
  console.log(`This may take several minutes...\n`);

  const startTime = Date.now();
  let totalCreated = 0;
  const batches = Math.ceil(TARGET_MESSAGES / BATCH_SIZE);

  for (let batchNum = 0; batchNum < batches; batchNum++) {
    const batchMessages = [];
    const batchSize = Math.min(BATCH_SIZE, TARGET_MESSAGES - totalCreated);

    for (let i = 0; i < batchSize; i++) {
      const randomUser = testUsers[Math.floor(Math.random() * testUsers.length)];
      const randomChannel = testChannels[Math.floor(Math.random() * testChannels.length)];
      const content = randomMessage();
      const createdAt = randomTimestamp();

      // 5% chance of file attachment
      const hasFile = Math.random() < 0.05;

      batchMessages.push({
        content,
        channelId: randomChannel.id,
        userId: randomUser.id,
        createdAt,
        ...(hasFile && {
          fileUrl: `https://res.cloudinary.com/demo/image/upload/sample.jpg`,
          fileName: `test-file-${i}.jpg`,
          fileType: 'image/jpeg',
        }),
      });
    }

    // Batch insert
    await prisma.message.createMany({
      data: batchMessages,
      skipDuplicates: true,
    });

    totalCreated += batchSize;

    // Progress update
    const progress = ((totalCreated / TARGET_MESSAGES) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(totalCreated / parseFloat(elapsed));
    
    process.stdout.write(`\r   Progress: ${progress}% (${totalCreated.toLocaleString()}/${TARGET_MESSAGES.toLocaleString()}) - ${rate} msg/s`);
  }

  console.log('\n');
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Seeding complete in ${totalTime}s`);
  console.log('');

  // Step 4: Verify
  console.log('📊 Verification:');
  const counts = await Promise.all(
    testChannels.map(async (channel) => {
      const count = await prisma.message.count({ where: { channelId: channel.id } });
      return { channel: channel.name, count };
    })
  );

  counts.forEach(({ channel, count }) => {
    console.log(`   ${channel}: ${count.toLocaleString()} messages`);
  });

  const totalMessages = await prisma.message.count();
  console.log(`\n   Total messages in database: ${totalMessages.toLocaleString()}`);
  console.log('');
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run query profiling: npm run db:profile');
  console.log('2. Test pagination performance');
  console.log('3. Add database indexes');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
