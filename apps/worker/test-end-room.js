const WebSocket = require('ws');

const API_URL = 'http://localhost:8787';

async function testEndRoomSpecifics() {
  console.log('Testing End Room specifics...');

  // 1. Create room
  const createRes = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
  const { roomId, adminToken } = await createRes.json();
  console.log(`Room created: ${roomId}`);

  // 2. Connect client A (admin) and client B (user)
  const adminWs = new WebSocket(`ws://localhost:8787/api/rooms/${roomId}/ws?adminToken=${adminToken}`);
  await new Promise(r => adminWs.on('open', r));

  const userWs = new WebSocket(`ws://localhost:8787/api/rooms/${roomId}/ws`);
  await new Promise(r => userWs.on('open', r));

  let userReceivedEnded = false;
  let adminReceivedEnded = false;

  userWs.on('message', (m) => {
    const data = JSON.parse(m.toString());
    if (data.type === 'ROOM_ENDED') {
      userReceivedEnded = true;
    }
  });

  adminWs.on('message', (m) => {
    const data = JSON.parse(m.toString());
    if (data.type === 'ROOM_ENDED') {
      adminReceivedEnded = true;
    }
  });

  // 3. Admin calls end-room via HTTP endpoint
  const endRes = await fetch(`${API_URL}/api/rooms/${roomId}/end-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminToken })
  });

  if (!endRes.ok) throw new Error(`HTTP end-room failed with ${endRes.status}`);
  console.log(`HTTP end-room returned status: ${endRes.status} (OK)`);

  // Wait 300ms for events and socket closures
  await new Promise(r => setTimeout(r, 400));

  if (!userReceivedEnded) throw new Error('User did not receive ROOM_ENDED');
  if (!adminReceivedEnded) throw new Error('Admin did not receive ROOM_ENDED');
  console.log('Both admin and user received ROOM_ENDED event! [PASS]');

  // Check socket states: both should be closed
  if (userWs.readyState === WebSocket.OPEN || adminWs.readyState === WebSocket.OPEN) {
    throw new Error('Sockets were not closed by DO after end-room');
  }
  console.log('All WebSockets successfully closed! [PASS]');

  // 4. Try reconnecting to the ended room via WebSocket
  let reconnectStatus = null;
  const failWs = new WebSocket(`ws://localhost:8787/api/rooms/${roomId}/ws`);
  await new Promise((resolve) => {
    failWs.on('unexpected-response', (req, res) => {
      reconnectStatus = res.statusCode;
      resolve();
    });
    failWs.on('error', () => {
      resolve();
    });
    failWs.on('open', () => {
      failWs.close();
      resolve();
    });
  });

  console.log(`Reconnection attempt response status: ${reconnectStatus}`);
  if (reconnectStatus !== 410) {
    throw new Error(`Expected 410 for reconnection to ended room, got: ${reconnectStatus}`);
  }
  console.log('Reconnection rejected with 410 Gone! [PASS]');

  console.log('ALL END-ROOM VERIFICATIONS PASSED SUCCESSFULLY!');
}

testEndRoomSpecifics().catch(err => {
  console.error('End room test error:', err);
  process.exit(1);
});
