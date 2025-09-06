/**
 * Test the handlePresenceUpdate functionality
 */
import { Zenbot } from './domain/session/Zenbot';

// Mock presence objects
const mockUser = {
  id: '123456789',
  username: 'TestUser',
  displayName: 'Test User',
  bot: false
} as any;

const mockOldPresence = {
  user: mockUser,
  status: 'offline',
  activities: []
} as any;

const mockNewPresence = {
  user: mockUser,
  status: 'online',
  activities: [
    {
      name: 'Visual Studio Code',
      type: 0, // Playing
      details: 'Editing zenbot code',
      state: 'Working on AI features'
    }
  ]
} as any;

async function testPresenceHandling() {
  console.log('🧘 Testing Zenbot Presence Update Handling...\n');

  try {
    // Get Zenbot instance
    const zenbot = Zenbot.getInstance();
    
    // Create a session first (presence updates only work for existing sessions)
    const session = zenbot.getSession(mockUser);
    console.log(`✅ Created session for testing: ${session.sessionId}\n`);

    // Test presence update: offline → online with activity
    console.log('📱 Simulating presence update: offline → online (with VS Code activity)');
    zenbot.handlePresenceUpdate(mockOldPresence, mockNewPresence);
    
    console.log('✅ Presence update handled successfully!\n');

    // Test another activity change
    const newActivity = {
      user: mockUser,
      status: 'online',
      activities: [
        {
          name: 'Overwatch 2',
          type: 0, // Playing
          details: 'As Zenyatta',
          state: 'Achieving harmony'
        }
      ]
    } as any;

    console.log('🎮 Simulating activity change: VS Code → Overwatch 2');
    zenbot.handlePresenceUpdate(mockNewPresence, newActivity);
    
    console.log('✅ Activity change handled successfully!\n');

    // Show stats
    const stats = zenbot.getStats();
    console.log('📊 Zenbot Stats after presence updates:');
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testPresenceHandling();
}
