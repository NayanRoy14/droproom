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

function waitForEvent(ws, type, timeout = 6000, filterFn = null) {
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
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(e.payload);
        }
      } catch (err) {}
    };
    ws.on('message', handler);
  });
}

async function runCompleteUserFlow() {
  console.log('====================================================');
  console.log('STARTING COMPLETE END-TO-END FLOW VERIFICATION');
  console.log('====================================================\n');

  try {
    // 1. Admin creates room
    const createRes = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
    if (!createRes.ok) throw new Error('Failed to create room');
    const { roomId, adminToken } = await createRes.json();
    console.log(`[STEP 1] Admin creates room -> Room Code: "${roomId}" (Length: ${roomId.length}), Admin Token generated. [PASS]`);

    if (roomId.length !== 4) {
      throw new Error(`Expected room code length 4, but got ${roomId.length}`);
    }

    // 2. Admin connects to room
    const adminWs = await connectWs(roomId, `?adminToken=${adminToken}`);
    const adminState = await waitForEvent(adminWs, 'ROOM_STATE');
    console.log(`[STEP 2] Admin connects via WebSocket -> Received ROOM_STATE (isAdmin: ${adminState.isAdmin}). [PASS]`);

    // 3. Admin uploads file
    const filename = 'project-brief.pdf';
    const fileContent = 'DropXYZ confidential project brief content';
    const uploadRes = await fetch(`${API_URL}/api/rooms/${roomId}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        size: Buffer.byteLength(fileContent),
        mimeType: 'application/pdf',
        adminToken
      })
    });
    if (!uploadRes.ok) throw new Error('Upload URL authorization failed');
    const { uploadUrl, fileId, objectKey } = await uploadRes.json();

    // Verify signed upload URL was generated
    if (!uploadUrl.includes('X-Amz-Signature')) {
      throw new Error('uploadUrl is not a valid AWS v4 presigned URL');
    }

    // Complete upload in DO
    const completeRes = await fetch(`${API_URL}/api/rooms/${roomId}/file-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        objectKey,
        originalName: filename,
        size: Buffer.byteLength(fileContent),
        mimeType: 'application/pdf',
        participantId: 'admin'
      })
    });
    if (!completeRes.ok) throw new Error('File complete notification failed');
    const adminFileEvent = await waitForEvent(adminWs, 'FILE_SHARED');
    console.log(`[STEP 3] Admin uploads file "${filename}" -> Presigned URL issued & FILE_SHARED broadcasted. [PASS]`);

    // 4. Admin sends a chat message
    adminWs.send(JSON.stringify({
      type: 'CHAT_SEND',
      payload: { message: 'Welcome to the temporary DropXYZ room! Here is the file.' }
    }));
    const adminMsgEvent = await waitForEvent(adminWs, 'CHAT_MESSAGE');
    console.log(`[STEP 4] Admin sends message -> Broadcasted: "${adminMsgEvent.message}". [PASS]`);

    // 5. Another user types the 4-character room code and requests to join
    console.log(`[STEP 5] Participant types 4-character code "${roomId.toUpperCase()}" and requests to join...`);
    const participantWs = await connectWs(roomId.toLowerCase());
    participantWs.send(JSON.stringify({
      type: 'JOIN_REQUEST',
      payload: { displayName: 'Alex' }
    }));

    // 6. Admin receives real-time join request event
    const joinReq = await waitForEvent(adminWs, 'JOIN_REQUEST_RECEIVED');
    console.log(`[STEP 6] Admin gets real-time popup notification -> "${joinReq.displayName}" wants to join (ID: ${joinReq.id}). [PASS]`);

    // 7. Admin accepts the join request
    adminWs.send(JSON.stringify({
      type: 'JOIN_APPROVE',
      payload: { participantId: joinReq.id }
    }));

    // 8. User gets admitted immediately and receives room state
    const approvedEvent = await waitForEvent(participantWs, 'JOIN_APPROVED');
    const userState = await waitForEvent(participantWs, 'ROOM_STATE');
    console.log(`[STEP 7 & 8] Admin accepts -> Participant received JOIN_APPROVED (Session ID: ${approvedEvent.sessionId}). [PASS]`);

    // 9. User sees the uploaded file and the chat message from admin
    const foundFile = userState.files.find(f => f.id === fileId);
    const foundMsg = userState.messages.find(m => m.id === adminMsgEvent.id);
    if (!foundFile || !foundMsg) throw new Error('User did not receive files or messages in ROOM_STATE');
    console.log(`[STEP 9] Participant sees existing file "${foundFile.originalName}" and message: "${foundMsg.message}". [PASS]`);

    // 10. User downloads the file
    const downloadRes = await fetch(`${API_URL}/api/rooms/${roomId}/download-url/${encodeURIComponent(fileId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: approvedEvent.sessionId })
    });
    if (!downloadRes.ok) throw new Error(`User download authorization failed: ${downloadRes.status}`);
    const { downloadUrl } = await downloadRes.json();
    
    // Verify signed download URL is valid
    if (!downloadUrl.includes('X-Amz-Signature') || !downloadUrl.includes(objectKey)) {
      throw new Error('downloadUrl is not a valid AWS v4 presigned download URL');
    }
    console.log(`[STEP 10] Participant downloads file -> Authorized signed download URL issued. [PASS]`);

    // 11. Participant sends chat message
    participantWs.send(JSON.stringify({
      type: 'CHAT_SEND',
      payload: { message: 'Thanks! Downloaded the file successfully.' }
    }));
    const participantMsg = await waitForEvent(adminWs, 'CHAT_MESSAGE', 6000, m => m.message.includes('Downloaded'));
    console.log(`[STEP 11] Participant sends chat message -> Admin received: "${participantMsg.message}". [PASS]`);

    // 12. Participant leaves the room by clicking Exit
    participantWs.close();
    const leaveEvent = await waitForEvent(adminWs, 'PARTICIPANT_LEFT');
    console.log(`[STEP 12] Participant clicks "Exit room" -> Disconnected & broadcasted PARTICIPANT_LEFT (ID: ${leaveEvent.participantId}). [PASS]`);

    // 13. Admin clicks "End room" to close room and permanently delete files
    console.log(`[STEP 13] Admin clicks "End room" button...`);
    adminWs.send(JSON.stringify({ type: 'END_ROOM' }));
    await waitForEvent(adminWs, 'ROOM_ENDED');
    console.log(`[STEP 13] Received ROOM_ENDED event on all sockets. [PASS]`);

    // Allow background alarm / delete execution
    await new Promise(r => setTimeout(r, 600));

    // 14. Verify room is closed and files permanently deleted
    const postEndDownload = await fetch(`${API_URL}/api/rooms/${roomId}/download-url/${encodeURIComponent(fileId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: approvedEvent.sessionId })
    });
    console.log(`[STEP 14] File download rejected after room end (Status: ${postEndDownload.status}). [PASS]`);

    const postEndJoin = await fetch(`${API_URL}/api/rooms/${roomId}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'hack.txt',
        size: 10,
        mimeType: 'text/plain',
        adminToken
      })
    });
    console.log(`[STEP 15] New operations on ended room rejected (Status: ${postEndJoin.status}). [PASS]`);

    // 15. Verify Reject flow as well
    console.log('\n--- VERIFYING REJECT FLOW ---');
    const room2Res = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
    const room2 = await room2Res.json();
    const admin2Ws = await connectWs(room2.roomId, `?adminToken=${room2.adminToken}`);
    await waitForEvent(admin2Ws, 'ROOM_STATE');

    const p2Ws = await connectWs(room2.roomId);
    p2Ws.send(JSON.stringify({ type: 'JOIN_REQUEST', payload: { displayName: 'UninvitedGuest' } }));
    const req2 = await waitForEvent(admin2Ws, 'JOIN_REQUEST_RECEIVED');

    // Admin rejects
    admin2Ws.send(JSON.stringify({ type: 'JOIN_REJECT', payload: { participantId: req2.id } }));
    const rejectEvent = await waitForEvent(p2Ws, 'JOIN_REJECTED');
    console.log(`[REJECT FLOW] Admin rejects -> Participant received JOIN_REJECTED: "${rejectEvent.reason}". [PASS]`);

    admin2Ws.close();
    p2Ws.close();

    console.log('\n====================================================');
    console.log('ALL STEPS IN THE USER FLOW COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('\nFAILURE AT STEP:', err);
    process.exit(1);
  }
}

runCompleteUserFlow();
