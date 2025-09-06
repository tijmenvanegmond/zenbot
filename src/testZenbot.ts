/**
 * Test the new Zenbot AI session system
 */
import { Zenbot } from './domain/session/Zenbot';

// Mock user object for testing
const mockUser = {
  id: '123456789',
  username: 'TestUser',
  displayName: 'Test User'
} as any;

async function testZenbotSystem() {
  console.log('🧘 Testing Zenbot AI Session System...\n');

  try {
    // Get Zenbot instance and create session
    const zenbot = Zenbot.getInstance();
    const session = zenbot.getSession(mockUser);

    console.log(`✅ Created session: ${session.sessionId}`);
    console.log(`👤 User: ${session.username}\n`);

    // Test advice request
    console.log('🤔 Requesting advice...');
    const adviceResponse = await session.advice({
      topic: 'programming',
      urgency: 'medium'
    });

    console.log('📝 Advice Response:');
    console.log(`Voice: "${adviceResponse.voice}"`);
    console.log(`Text: "${adviceResponse.text}"`);
    console.log(`Actions: ${JSON.stringify(adviceResponse.actions, null, 2)}\n`);

    // Test quote request
    console.log('💬 Requesting quote...');
    const quoteResponse = await session.quote({
      theme: 'wisdom',
      mood: 'zen'
    });

    console.log('📜 Quote Response:');
    console.log(`Voice: "${quoteResponse.voice}"`);
    console.log(`Text: "${quoteResponse.text}"`);
    console.log(`Actions: ${JSON.stringify(quoteResponse.actions, null, 2)}\n`);

    // Test conversation
    console.log('💭 Starting conversation...');
    const conversationResponse = await session.converse(
      'Hello Zenyatta, how are you today?'
    );

    console.log('🗣️ Conversation Response:');
    console.log(`Voice: "${conversationResponse.voice}"`);
    console.log(`Text: "${conversationResponse.text}"`);
    console.log(`Actions: ${JSON.stringify(conversationResponse.actions, null, 2)}\n`);

    // Show stats
    const stats = zenbot.getStats();
    console.log('📊 Zenbot Stats:');
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testZenbotSystem();
}
