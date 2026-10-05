const WebSocket = require('ws');

const API_URL = 'http://localhost:8787';

function connectWs(roomId, query = '') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:8787/api/rooms/${roomId}/ws${query}`);
    ws.buffer = [];
    ws.on('message', (msg) => {
      ws.buffer.push(msg);
    });
    ws.on('error', reject);
    ws.on('open', () => resolve(ws));
  });
}

function waitForEvent(ws, type, timeout = 4000, filterFn = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${type}`)), timeout);
    for (let i = 0; i < ws.buffer.length; i++) {
      try {
        const e = JSON.parse(ws.buffer[i].toString());
        if (e.type === type && (!filterFn || filterFn(e.payload))) {
          ws.buffer.splice(i, 1);
          clearTimeout(timer);
          return resolve(e.payload);
        }
      } catch (err) {}
    }
    const handler = (msg) => {
      try {
        const e = JSON.parse(msg.toString());
        if (e.type === type && (!filterFn || filterFn(e.payload))) {
          const idx = ws.buffer.indexOf(msg);
          if (idx !== -1) ws.buffer.splice(idx, 1);
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(e.payload);
        }
      } catch (err) {}
    };
    ws.on('message', handler);
  });
}

async function verifyPeopleCount() {
  console.log('Testing People Count Synchronization...');

  // 1. Create Room
  const createRes = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
  const { roomId, adminToken } = await createRes.json();

  // 2. Host Connects
  const hostWs = await connectWs(roomId, `?adminToken=${adminToken}`);
  const hostInitialState = await waitForEvent(hostWs, 'ROOM_STATE');
  
  const hostOnline1 = hostInitialState.participants.filter(p => p.status === 'online').length;
  console.log(`Host initial online count: ${hostOnline1} (Expected: 1)`);
  if (hostOnline1 !== 1) throw new Error(`Host initial count mismatch: ${hostOnline1}`);

  // 3. User 1 Joins
  const p1Ws = await connectWs(roomId);
  p1Ws.send(JSON.stringify({ type: 'JOIN_REQUEST', payload: { displayName: 'Alice' } }));
  const req1 = await waitForEvent(hostWs, 'JOIN_REQUEST_RECEIVED');
  hostWs.send(JSON.stringify({ type: 'JOIN_APPROVE', payload: { participantId: req1.id } }));
  
  const p1State = await waitForEvent(p1Ws, 'ROOM_STATE');
  await waitForEvent(hostWs, 'PARTICIPANT_JOINED');

  const p1Online = p1State.participants.filter(p => p.status === 'online').length;
  console.log(`User 1 sees online count: ${p1Online} (Expected: 2)`);
  if (p1Online !== 2) throw new Error(`User 1 count mismatch: ${p1Online}`);

  // 4. User 2 Joins
  const p2Ws = await connectWs(roomId);
  p2Ws.send(JSON.stringify({ type: 'JOIN_REQUEST', payload: { displayName: 'Bob' } }));
  const req2 = await waitForEvent(hostWs, 'JOIN_REQUEST_RECEIVED');
  hostWs.send(JSON.stringify({ type: 'JOIN_APPROVE', payload: { participantId: req2.id } }));

  const p2State = await waitForEvent(p2Ws, 'ROOM_STATE');
  await waitForEvent(p1Ws, 'PARTICIPANT_JOINED');
  await waitForEvent(hostWs, 'PARTICIPANT_JOINED');

  const p2Online = p2State.participants.filter(p => p.status === 'online').length;
  console.log(`User 2 sees online count: ${p2Online} (Expected: 3)`);
  if (p2Online !== 3) throw new Error(`User 2 count mismatch: ${p2Online}`);

  // Check drawer items: host is in the list with displayName 'Host'
  const hostParticipant = p2State.participants.find(p => p.id === 'host');
  if (!hostParticipant || hostParticipant.displayName !== 'Host') {
    throw new Error('Host is not listed in participants');
  }
  console.log('Host correctly present in participants list for guests [PASS]');

  // 5. User 1 Leaves
  p1Ws.close();
  const leftEventOnHost = await waitForEvent(hostWs, 'PARTICIPANT_LEFT');
  const leftEventOnP2 = await waitForEvent(p2Ws, 'PARTICIPANT_LEFT');

  if (leftEventOnHost.participantId !== req1.id || leftEventOnP2.participantId !== req1.id) {
    throw new Error('PARTICIPANT_LEFT did not broadcast to both Host and remaining guests');
  }
  console.log('PARTICIPANT_LEFT correctly received by both Host and Guest 2 [PASS]');

  // Cleanup
  hostWs.close();
  p2Ws.close();

  console.log('\n=============================================');
  console.log('PEOPLE COUNT SYNCHRONIZATION VERIFIED [PASS]');
  console.log('=============================================');
}

verifyPeopleCount().catch(err => {
  console.error('People count test error:', err);
  process.exit(1);
});
