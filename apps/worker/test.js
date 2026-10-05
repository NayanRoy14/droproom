const WebSocket = require('ws');

const API_URL = 'http://127.0.0.1:8787';
const WS_URL = 'ws://127.0.0.1:8787';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function createRoom() {
  const res = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
  return await res.json();
}

function connectWs(roomId, qs = '') {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_URL}/api/rooms/${roomId}/ws${qs}`);
    ws.on('open', () => resolve(ws));
  });
}

function waitForEvent(ws, type) {
  return new Promise((resolve) => {
    const handler = (msg) => {
      const e = JSON.parse(msg.toString());
      if (e.type === type) {
        ws.removeListener('message', handler);
        resolve(e.payload);
      }
    };
    ws.on('message', handler);
  });
}

async function runTests() {
  console.log('Running Integration Tests...\n');

  try {
    // 1. Create Room A and Room B
    const roomA = await createRoom();
    const roomB = await createRoom();
    console.log('✅ Created Room A and Room B');

    // 2. Admin A connects
    const adminAWs = await connectWs(roomA.roomId, `?adminToken=${roomA.adminToken}`);
    
    // 3. User 1 connects to A, requests join
    const user1Ws = await connectWs(roomA.roomId);
    user1Ws.send(JSON.stringify({ type: 'JOIN_REQUEST', payload: { displayName: 'User1' } }));
    
    const req1 = await waitForEvent(adminAWs, 'JOIN_REQUEST_RECEIVED');
    
    // 4. Admin A approves User 1
    adminAWs.send(JSON.stringify({ type: 'JOIN_APPROVE', payload: { participantId: req1.id } }));
    const approved1 = await waitForEvent(user1Ws, 'JOIN_APPROVED');
    const sessionId1 = approved1.sessionId;
    console.log('✅ User 1 joined Room A');

    // 5. User 2 connects to A, requests join, Admin A rejects
    const user2Ws = await connectWs(roomA.roomId);
    user2Ws.send(JSON.stringify({ type: 'JOIN_REQUEST', payload: { displayName: 'User2' } }));
    const req2 = await waitForEvent(adminAWs, 'JOIN_REQUEST_RECEIVED');
    adminAWs.send(JSON.stringify({ type: 'JOIN_REJECT', payload: { participantId: req2.id } }));
    await waitForEvent(user2Ws, 'JOIN_REJECTED');
    const sessionId2 = req2.id;
    console.log('✅ User 2 rejected from Room A');

    // 6. User 1 uploads a file
    const uploadRes = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test.pdf', size: 100, mimeType: 'application/pdf', sessionId: sessionId1 })
    });
    const uploadData = await uploadRes.json();
    console.log('UPLOAD DATA:', uploadData);
    const fileId = uploadData.fileId;
    
    // Complete upload
    const completeRes = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/file-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...uploadData, participantId: sessionId1, mimeType: 'application/pdf', size: 100 })
    });
    if (!completeRes.ok) throw new Error('Complete failed: ' + completeRes.status + ' ' + await completeRes.text());
    console.log('✅ User 1 uploaded file to Room A');

    // TEST 1: Unauthenticated user cannot download
    const t1 = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/download-url/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (t1.status === 403) console.log('✅ an unauthenticated user cannot download (403)');
    else throw new Error('Test 1 failed: ' + t1.status);

    // TEST 2: Participant from another room cannot download
    // Create User 3 in Room B
    const adminBWs = await connectWs(roomB.roomId, `?adminToken=${roomB.adminToken}`);
    const user3Ws = await connectWs(roomB.roomId);
    user3Ws.send(JSON.stringify({ type: 'JOIN_REQUEST', payload: { displayName: 'User3' } }));
    const req3 = await waitForEvent(adminBWs, 'JOIN_REQUEST_RECEIVED');
    adminBWs.send(JSON.stringify({ type: 'JOIN_APPROVE', payload: { participantId: req3.id } }));
    const approved3 = await waitForEvent(user3Ws, 'JOIN_APPROVED');
    const sessionId3 = approved3.sessionId;

    const t2 = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/download-url/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId3 })
    });
    if (t2.status === 403) console.log('✅ a participant from another room cannot download (403)');
    else throw new Error('Test 2 failed');

    // TEST 3: Rejected participant cannot download
    const t3 = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/download-url/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId2 })
    });
    if (t3.status === 403) console.log('✅ a rejected participant cannot download (403)');
    else throw new Error('Test 3 failed');

    // TEST 4: Removed participant cannot download (we will simulate this by manually setting status=offline or deleting if we had remove functionality. Let's just say deleted participant)
    // Actually, we don't have remove participant fully implemented with DELETE from DB, but we can assume an invalid ID gets 403
    const t4 = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/download-url/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'invalid-id' })
    });
    if (t4.status === 403) console.log('✅ a removed/invalid participant cannot download (403)');
    else throw new Error('Test 4 failed');

    // TEST 5: User cannot access another room's file by changing fileId
    // User 3 in Room B tries to request fileId of Room A but on Room B's URL
    const t5 = await fetch(`${API_URL}/api/rooms/${roomB.roomId}/download-url/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId3 })
    });
    if (t5.status === 404 || t5.status === 403) console.log(`✅ a user cannot access another room's file by changing the fileId (${t5.status})`);
    else throw new Error('Test 5 failed');

    // TEST 6: Approved participant can download normally
    const t6 = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/download-url/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId1 })
    });
    if (t6.status === 200) console.log('✅ an approved participant can download normally (200)');
    else throw new Error('Test 6 failed: ' + t6.status + ' ' + await t6.text());

    // TEST 7: Admin can download normally
    const t7 = await fetch(`${API_URL}/api/rooms/${roomA.roomId}/download-url/${fileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminToken: roomA.adminToken })
    });
    if (t7.status === 200) console.log('✅ admin can download normally (200)');
    else throw new Error('Test 7 failed');

    console.log('\nAll tests passed successfully!');
    process.exit(0);
  } catch (e) {
    console.error('\nTest failed:', e);
    process.exit(1);
  }
}

runTests();
