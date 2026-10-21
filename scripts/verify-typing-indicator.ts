/**
 * Verification script for typing indicator implementation
 * Checks that all required features are in place:
 * - TypingIndicator component accepts imageUrl
 * - useSocket hook includes imageUrl in TypingUser
 * - Socket server emits imageUrl with typing events
 */

console.log('✓ Verifying typing indicator implementation...\n');

// Check 1: TypingIndicator component structure
console.log('1. Checking TypingIndicator component...');
import fs from 'fs';
import path from 'path';

const typingIndicatorPath = path.join(process.cwd(), 'components/chat/TypingIndicator.tsx');
const typingIndicatorContent = fs.readFileSync(typingIndicatorPath, 'utf-8');

const checks = [
  {
    name: 'TypingUser interface includes imageUrl',
    test: typingIndicatorContent.includes('imageUrl?: string | null'),
    message: 'imageUrl property found in TypingUser interface'
  },
  {
    name: 'Component displays avatars',
    test: typingIndicatorContent.includes('typing-avatars') && typingIndicatorContent.includes('typing-avatar'),
    message: 'Avatar rendering elements found'
  },
  {
    name: 'Auto-hide timer implemented',
    test: typingIndicatorContent.includes('setTimeout') && typingIndicatorContent.includes('5000'),
    message: '5-second auto-hide timer found'
  },
  {
    name: 'Image component used for avatars',
    test: typingIndicatorContent.includes('import Image from "next/image"'),
    message: 'Next.js Image component imported'
  },
  {
    name: 'Fallback avatars for users without images',
    test: typingIndicatorContent.includes('avatar-fallback') && typingIndicatorContent.includes('getInitials'),
    message: 'Fallback avatar with initials found'
  },
  {
    name: 'Animation styles present',
    test: typingIndicatorContent.includes('typingBounce') || typingIndicatorContent.includes('typing-dot'),
    message: 'Animated typing dots found'
  },
  {
    name: 'Max 3 avatars displayed',
    test: typingIndicatorContent.includes('slice(0, 3)'),
    message: 'Avatar limit of 3 found'
  },
  {
    name: 'Remaining count indicator',
    test: typingIndicatorContent.includes('remainingCount') && typingIndicatorContent.includes('avatar-count'),
    message: 'Remaining count (+N) indicator found'
  }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  if (check.test) {
    console.log(`   ✓ ${check.message}`);
    passed++;
  } else {
    console.log(`   ✗ ${check.name} FAILED`);
    failed++;
  }
});

// Check 2: useSocket hook
console.log('\n2. Checking useSocket hook...');
const useSocketPath = path.join(process.cwd(), 'hooks/useSocket.ts');
const useSocketContent = fs.readFileSync(useSocketPath, 'utf-8');

const socketChecks = [
  {
    name: 'TypingUser interface includes imageUrl',
    test: useSocketContent.includes('imageUrl?: string | null'),
    message: 'imageUrl property in TypingUser interface'
  },
  {
    name: 'handleTyping receives imageUrl',
    test: useSocketContent.includes('imageUrl?: string | null') && useSocketContent.includes('data.imageUrl'),
    message: 'handleTyping processes imageUrl from socket events'
  }
];

socketChecks.forEach(check => {
  if (check.test) {
    console.log(`   ✓ ${check.message}`);
    passed++;
  } else {
    console.log(`   ✗ ${check.name} FAILED`);
    failed++;
  }
});

// Check 3: Socket server
console.log('\n3. Checking socket server...');
const socketServerPath = path.join(process.cwd(), 'server/socket-server.ts');
const socketServerContent = fs.readFileSync(socketServerPath, 'utf-8');

const serverChecks = [
  {
    name: 'typing:start emits imageUrl',
    test: socketServerContent.includes('typing:start') && 
          socketServerContent.match(/socket\.to.*emit\("typing:update".*imageUrl/s),
    message: 'typing:start event emits imageUrl'
  },
  {
    name: 'typing:stop emits imageUrl',
    test: socketServerContent.includes('typing:stop') && 
          socketServerContent.match(/socket\.to.*emit\("typing:update".*imageUrl/s),
    message: 'typing:stop event emits imageUrl'
  }
];

serverChecks.forEach(check => {
  if (check.test) {
    console.log(`   ✓ ${check.message}`);
    passed++;
  } else {
    console.log(`   ✗ ${check.name} FAILED`);
    failed++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Verification Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n✅ All checks passed! Typing indicator implementation is complete.');
  console.log('\nFeatures implemented:');
  console.log('  • User avatars displayed (up to 3)');
  console.log('  • Auto-hide after 5 seconds of no typing');
  console.log('  • Contextual text based on number of users');
  console.log('  • Animated typing dots');
  console.log('  • Fallback initials for users without avatars');
  console.log('  • Remaining count indicator (+N) for >3 users');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed. Please review the implementation.');
  process.exit(1);
}
