import { DurableObject } from 'cloudflare:workers';
import { AwsClient } from 'aws4fetch';
import { Env } from './types';
import { ClientEvent, ServerEvent, Room, Participant, ChatMessage, FileMetadata, JoinRequest } from '@droproom/shared';

export class RoomDurableObject extends DurableObject {
  env: Env;
  sessions: Map<WebSocket, { participantId?: string; isAdmin: boolean }> = new Map();
  roomId: string = '';
  adminToken: string = '';
  cleanupAlarmSet: boolean = false;

  private getSession(ws: WebSocket): { participantId?: string; isAdmin: boolean } | undefined {
    const mem = this.sessions.get(ws);
    if (mem) return mem;
    try {
      const att = (ws as any).deserializeAttachment();
      if (att) {
        this.sessions.set(ws, att);
        return att as { participantId?: string; isAdmin: boolean };
      }
    } catch (e) {}
    return undefined;
  }

  private setSession(ws: WebSocket, session: { participantId?: string; isAdmin: boolean }) {
    this.sessions.set(ws, session);
    try {
      (ws as any).serializeAttachment(session);
    } catch (e) {}
  }

  private ensureRoomLoaded() {
    if (!this.roomId) {
      const roomRow = this.ctx.storage.sql.exec('SELECT * FROM room LIMIT 1').toArray()[0];
      if (roomRow) {
        this.roomId = roomRow.id as string;
        this.adminToken = roomRow.admin_token as string;
      }
    }
  }

  private getAllWebSockets(closingWs?: WebSocket): WebSocket[] {
    let sockets: WebSocket[] = [];
    try {
      const s = (this.ctx as any).getWebSockets();
      if (s && s.length > 0) sockets = s;
    } catch (e) {}
    if (sockets.length === 0 && this.sessions.size > 0) {
      sockets = Array.from(this.sessions.keys());
    }
    return sockets.filter((ws: WebSocket) => ws !== closingWs && ws.readyState === 1);
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;

    // Initialize SQLite tables if they don't exist
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room (
        id TEXT PRIMARY KEY,
        admin_token TEXT,
        status TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        display_name TEXT,
        status TEXT,
        joined_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS join_requests (
        id TEXT PRIMARY KEY,
        display_name TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT,
        sender_name TEXT,
        content TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        object_key TEXT,
        original_name TEXT,
        size INTEGER,
        mime_type TEXT,
        uploader_id TEXT,
        uploader_name TEXT,
        created_at INTEGER
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const roomRow = this.ctx.storage.sql.exec('SELECT * FROM room LIMIT 1').toArray()[0];
    if (roomRow) {
      this.roomId = roomRow.id as string;
      this.adminToken = roomRow.admin_token as string;
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/init') {
      const { roomId, adminToken } = await request.json() as any;
      this.roomId = roomId;
      this.adminToken = adminToken;
      
      this.ctx.storage.sql.exec('INSERT OR IGNORE INTO room (id, admin_token, status, created_at) VALUES (?, ?, ?, ?)', 
        this.roomId, this.adminToken, 'active', Date.now());
        
      return new Response('OK');
    }

    if (request.method === 'POST' && url.pathname === '/end-room') {
      const { adminToken } = await request.json() as any;
      if (!adminToken || adminToken !== this.adminToken) return new Response('Unauthorized', { status: 403 });

      this.broadcast({ type: 'ROOM_ENDED' });
      this.ctx.storage.sql.exec("UPDATE room SET status = 'ended' WHERE id = ?", this.roomId);
      setTimeout(() => {
        this.closeAll();
        this.ctx.waitUntil(this.alarm());
      }, 100);
      return new Response('OK');
    }

    if (request.method === 'GET' && (url.pathname === '/info' || url.pathname === '/status')) {
      const roomRow = this.ctx.storage.sql.exec('SELECT id, status, created_at FROM room WHERE id = ? LIMIT 1', this.roomId).toArray()[0];
      if (!roomRow || roomRow.status === 'ended') {
        return new Response(JSON.stringify({ status: 'ended' }), {
          status: 410,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ status: roomRow.status, roomId: roomRow.id, createdAt: roomRow.created_at }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const roomRow = this.ctx.storage.sql.exec('SELECT * FROM room WHERE id = ? LIMIT 1', this.roomId).toArray()[0];
      if (!roomRow || roomRow.status === 'ended') {
        return new Response('Room ended', { status: 410 });
      }

      const isAdmin = url.searchParams.get('adminToken') === this.adminToken;
      const participantId = url.searchParams.get('participantId') || undefined;

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      this.ctx.acceptWebSocket(server);
      this.setSession(server, { participantId: isAdmin ? 'host' : participantId, isAdmin });

      this.ensureHostParticipant();

      // Load initial state if they are already a participant or admin
      if (isAdmin || (participantId && this.getParticipant(participantId))) {
        if (isAdmin) {
          this.updateParticipantStatus('host', 'online');
        } else if (participantId) {
          this.updateParticipantStatus(participantId, 'online');
        }

        this.sendRoomState(server, isAdmin);

        if (isAdmin) {
          this.broadcast({ type: 'PARTICIPANT_JOINED', payload: this.getParticipant('host')! }, server);
        } else if (participantId) {
          this.broadcast({ type: 'PARTICIPANT_JOINED', payload: this.getParticipant(participantId)! }, server);
        }
      }
      
      this.cancelCleanup();

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }
    
    if (request.method === 'POST' && url.pathname === '/authorize-upload') {
      const { sessionId, adminToken } = await request.json() as any;
      const roomRow = this.ctx.storage.sql.exec('SELECT * FROM room WHERE id = ? LIMIT 1', this.roomId).toArray()[0];
      if (!roomRow || roomRow.status !== 'active') return new Response('Unauthorized', { status: 403 });

      if (adminToken === this.adminToken) return new Response('OK');
      if (sessionId === 'host' || sessionId === 'admin') return new Response('OK');
      if (sessionId) {
        const p = this.getParticipant(sessionId);
        if (p) return new Response('OK');
      }
      return new Response('Unauthorized', { status: 403 });
    }

    if (request.method === 'POST' && url.pathname.startsWith('/authorize-download/')) {
      const fileId = url.pathname.replace('/authorize-download/', '');
      const { sessionId, adminToken } = await request.json() as any;
      const roomRow = this.ctx.storage.sql.exec('SELECT * FROM room WHERE id = ? LIMIT 1', this.roomId).toArray()[0];
      if (!roomRow || roomRow.status !== 'active') return new Response('Unauthorized (room)', { status: 403 });

      let isAuth = false;
      if (adminToken === this.adminToken) isAuth = true;
      if (!isAuth && (sessionId === 'host' || sessionId === 'admin')) isAuth = true;
      if (!isAuth && sessionId) {
        const p = this.getParticipant(sessionId);
        if (p) isAuth = true;
      }
      
      if (!isAuth) return new Response('Unauthorized (participant)', { status: 403 });

      const filesInDb = this.ctx.storage.sql.exec('SELECT id FROM files').toArray();
      const fileRow = this.ctx.storage.sql.exec('SELECT object_key FROM files WHERE id = ? LIMIT 1', fileId).toArray()[0];
      if (!fileRow) return new Response(`Not found. Searched for ${fileId}, DB has: ${JSON.stringify(filesInDb)}`, { status: 404 });

      return new Response(JSON.stringify({ objectKey: fileRow.object_key }));
    }


    if (request.method === 'POST' && url.pathname === '/file-complete') {
      const body = await request.json() as any;
      if (!body || typeof body !== 'object') {
        return new Response('Invalid payload', { status: 400 });
      }
      const { fileId, objectKey, originalName, size, mimeType, participantId, adminToken, sessionId } = body;
      
      this.ensureRoomLoaded();
      const roomRow = this.ctx.storage.sql.exec('SELECT * FROM room LIMIT 1').toArray()[0];
      if (!roomRow || roomRow.status !== 'active') return new Response('Unauthorized (room)', { status: 403 });

      // Verify authorization
      let isAuth = false;
      let effectiveUploaderId = participantId || sessionId;
      let effectiveUploaderName = 'Guest';

      if (adminToken === this.adminToken || participantId === 'admin' || sessionId === 'admin' || participantId === 'host' || sessionId === 'host') {
        if (adminToken === this.adminToken) {
          isAuth = true;
          effectiveUploaderId = 'host';
          effectiveUploaderName = 'Host';
        }
      }

      if (!isAuth && effectiveUploaderId) {
        const p = this.getParticipant(effectiveUploaderId);
        if (p) {
          isAuth = true;
          effectiveUploaderName = p.displayName;
        }
      }

      if (!isAuth) {
        return new Response('Unauthorized', { status: 403 });
      }

      // Validate objectKey prefix strictly matches room and fileId
      const expectedPrefix = `rooms/${this.roomId}/${fileId}/`;
      if (typeof objectKey !== 'string' || !objectKey.startsWith(expectedPrefix)) {
        return new Response('Invalid object key for room', { status: 400 });
      }

      if (typeof size !== 'number' || size <= 0 || size > 100 * 1024 * 1024) {
        return new Response('Invalid file size', { status: 400 });
      }

      const file: FileMetadata = {
        id: fileId,
        objectKey,
        originalName: typeof originalName === 'string' ? originalName.slice(0, 255) : 'file',
        size,
        mimeType: typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
        uploaderId: effectiveUploaderId,
        uploaderName: effectiveUploaderName,
        createdAt: Date.now()
      };
      
      this.ctx.storage.sql.exec('INSERT INTO files (id, object_key, original_name, size, mime_type, uploader_id, uploader_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        file.id, file.objectKey, file.originalName, file.size, file.mimeType, file.uploaderId, file.uploaderName, file.createdAt);
        
      this.broadcast({ type: 'FILE_SHARED', payload: file });
      
      return new Response('OK');
    }

    return new Response('Not found in DO', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return;
    try {
      const event = JSON.parse(message) as ClientEvent;
      const session = this.getSession(ws);
      if (!session) return;

      switch (event.type) {
        case 'JOIN_REQUEST': {
          if (session.isAdmin || session.participantId) return; // Prevent duplicate requests
          const rawName = typeof event.payload?.displayName === 'string' ? event.payload.displayName.trim() : '';
          if (!rawName || rawName.length > 32) return; // Must be between 1 and 32 characters
          
          const requestId = generateId();
          this.ctx.storage.sql.exec('INSERT INTO join_requests (id, display_name, created_at) VALUES (?, ?, ?)',
            requestId, rawName, Date.now());
          
          this.setSession(ws, { ...session, participantId: requestId });
          
          const request = { id: requestId, displayName: rawName, createdAt: Date.now() };
          this.broadcastToAdmins({ type: 'JOIN_REQUEST_RECEIVED', payload: request });
          break;
        }
        
        case 'JOIN_APPROVE': {
          if (!session.isAdmin) return;
          const { participantId } = event.payload;
          if (typeof participantId !== 'string' || !participantId) return;
          const req = this.ctx.storage.sql.exec('SELECT * FROM join_requests WHERE id = ?', participantId).toArray()[0];
          if (req) {
            this.ctx.storage.sql.exec('INSERT INTO participants (id, display_name, status, joined_at) VALUES (?, ?, ?, ?)',
              req.id, req.display_name, 'online', Date.now());
            this.ctx.storage.sql.exec('DELETE FROM join_requests WHERE id = ?', participantId);
            
            const participant = this.getParticipant(participantId as string)!;
            
            // Find the pending socket and approve
            for (const socket of this.getAllWebSockets()) {
              const sess = this.getSession(socket);
              if (sess?.participantId === participantId) {
                this.send(socket, { type: 'JOIN_APPROVED', payload: { sessionId: participantId as string, roomId: this.roomId, participant } });
                this.sendRoomState(socket, false);
                break;
              }
            }
            this.broadcast({ type: 'PARTICIPANT_JOINED', payload: participant });
            this.broadcastToAdmins({ type: 'JOIN_REQUEST_RESOLVED', payload: { participantId } });
          }
          break;
        }

        case 'JOIN_REJECT': {
          if (!session.isAdmin) return;
          const { participantId } = event.payload;
          if (typeof participantId !== 'string' || !participantId) return;
          this.ctx.storage.sql.exec('DELETE FROM join_requests WHERE id = ?', participantId);
          for (const socket of this.getAllWebSockets()) {
            const sess = this.getSession(socket);
            if (sess?.participantId === participantId) {
              this.send(socket, { type: 'JOIN_REJECTED', payload: { reason: 'Admin rejected request' } });
              socket.close();
              this.sessions.delete(socket);
              break;
            }
          }
          this.broadcastToAdmins({ type: 'JOIN_REQUEST_RESOLVED', payload: { participantId } });
          break;
        }

        case 'REMOVE_PARTICIPANT': {
          if (!session.isAdmin) return;
          const { participantId } = event.payload;
          if (typeof participantId !== 'string' || !participantId) return;
          this.ctx.storage.sql.exec('DELETE FROM participants WHERE id = ?', participantId);
          for (const socket of this.getAllWebSockets()) {
            const sess = this.getSession(socket);
            if (sess?.participantId === participantId) {
              this.send(socket, { type: 'JOIN_REJECTED', payload: { reason: 'Removed by host' } });
              socket.close();
              this.sessions.delete(socket);
              break;
            }
          }
          this.broadcast({ type: 'PARTICIPANT_REMOVED', payload: { participantId } });
          break;
        }
        
        case 'CHAT_SEND': {
          if (!session.participantId && !session.isAdmin) return;
          const rawMessage = typeof event.payload?.message === 'string' ? event.payload.message : '';
          const trimmed = rawMessage.trim();
          if (!trimmed || trimmed.length > 2000) return; // Prevent empty or oversized spam
          let senderName = 'Host';
          let senderId = 'admin';
          if (session.participantId && session.participantId !== 'host' && !session.isAdmin) {
            const p = this.getParticipant(session.participantId);
            if (!p) return;
            senderName = p.displayName;
            senderId = p.id;
          }
          const msg = {
            id: generateId(),
            roomId: this.roomId,
            senderId,
            senderName,
            message: trimmed,
            timestamp: Date.now()
          };
          this.ctx.storage.sql.exec('INSERT INTO messages (id, sender_id, sender_name, content, created_at) VALUES (?, ?, ?, ?, ?)',
            msg.id, msg.senderId, msg.senderName, msg.message, msg.timestamp);
          
          this.broadcast({ type: 'CHAT_MESSAGE', payload: msg });
          break;
        }


        case 'END_ROOM': {
          if (!session.isAdmin) return;
          this.broadcast({ type: 'ROOM_ENDED' });
          this.ctx.storage.sql.exec("UPDATE room SET status = 'ended' WHERE id = ?", this.roomId);
          setTimeout(() => {
            this.closeAll();
            this.ctx.waitUntil(this.alarm());
          }, 100);
          break;
        }
        
        case 'PING': {
          this.send(ws, { type: 'PONG' });
          break;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async webSocketClose(ws: WebSocket) {
    const session = this.getSession(ws);
    this.sessions.delete(ws);
    this.ensureRoomLoaded();
    
    const activeSockets = this.getAllWebSockets(ws);
    
    if (session?.isAdmin) {
      const remainingAdmin = activeSockets.some(s => this.getSession(s)?.isAdmin);
      if (!remainingAdmin) {
        this.updateParticipantStatus('host', 'offline');
        this.broadcast({ type: 'PARTICIPANT_LEFT', payload: { participantId: 'host' } });
      }
    } else if (session?.participantId) {
      const remainingParticipant = activeSockets.some(s => this.getSession(s)?.participantId === session.participantId);
      if (!remainingParticipant) {
        this.updateParticipantStatus(session.participantId, 'offline');
        this.broadcast({ type: 'PARTICIPANT_LEFT', payload: { participantId: session.participantId } });
      }
    }

    if (activeSockets.length === 0) {
      const roomRow = this.ctx.storage.sql.exec('SELECT status FROM room LIMIT 1').toArray()[0];
      if (roomRow && roomRow.status === 'active') {
        this.scheduleCleanup();
      }
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    this.ensureRoomLoaded();
    const activeSockets = this.getAllWebSockets();
    if (activeSockets.length > 0) {
      // Participants reconnected during grace period, cancel destruction
      this.cleanupAlarmSet = false;
      return;
    }

    console.log('[DO ALARM TRIGGERED - DESTROYING ROOM]', this.roomId);
    const files = this.ctx.storage.sql.exec('SELECT object_key FROM files').toArray();
    
    if (files.length > 0) {
      const aws = new AwsClient({
        accessKeyId: this.env.R2_ACCESS_KEY_ID,
        secretAccessKey: this.env.R2_SECRET_ACCESS_KEY,
        service: 's3',
        region: 'auto',
      });

      for (const file of files) {
        const objectKey = file.object_key as string;
        const r2Url = new URL(`https://${this.env.R2_BUCKET_NAME}.${this.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`);
        
        try {
          const req = await aws.sign(new Request(r2Url.toString(), { method: 'DELETE' }));
          await fetch(req);
        } catch (e) {
          console.error('Failed to delete file from R2', e);
        }
      }
    }

    // Cleanup all room data permanently
    this.ctx.storage.sql.exec('DELETE FROM room');
    this.ctx.storage.sql.exec('DELETE FROM participants');
    this.ctx.storage.sql.exec('DELETE FROM join_requests');
    this.ctx.storage.sql.exec('DELETE FROM messages');
    this.ctx.storage.sql.exec('DELETE FROM files');
    this.cleanupAlarmSet = false;
  }

  private scheduleCleanup() {
    if (this.cleanupAlarmSet) return;
    const gracePeriod = parseInt(this.env.ROOM_CLEANUP_GRACE_SECONDS || '60', 10);
    this.ctx.storage.setAlarm(Date.now() + gracePeriod * 1000);
    this.cleanupAlarmSet = true;
  }

  private cancelCleanup() {
    try {
      this.ctx.storage.deleteAlarm();
    } catch (e) {}
    this.cleanupAlarmSet = false;
  }

  private send(ws: WebSocket, event: ServerEvent) {
    try {
      ws.send(JSON.stringify(event));
    } catch (e) {}
  }

  private broadcast(event: ServerEvent, exclude?: WebSocket) {
    const str = JSON.stringify(event);
    for (const ws of this.getAllWebSockets()) {
      if (ws !== exclude) {
        try { ws.send(str); } catch (e) {}
      }
    }
  }

  private broadcastToAdmins(event: ServerEvent) {
    const str = JSON.stringify(event);
    for (const ws of this.getAllWebSockets()) {
      const sess = this.getSession(ws);
      if (sess?.isAdmin) {
        try { ws.send(str); } catch (e) {}
      }
    }
  }

  private getParticipant(id: string): Participant | undefined {
    const rows = this.ctx.storage.sql.exec('SELECT * FROM participants WHERE id = ?', id).toArray();
    if (rows.length === 0) return undefined;
    return {
      id: rows[0].id as string,
      displayName: rows[0].display_name as string,
      status: rows[0].status as any,
      joinedAt: rows[0].joined_at as number
    };
  }

  private updateParticipantStatus(id: string, status: string) {
    this.ctx.storage.sql.exec('UPDATE participants SET status = ? WHERE id = ?', status, id);
  }

  private ensureHostParticipant() {
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO participants (id, display_name, status, joined_at) VALUES (?, ?, ?, ?)',
      'host', 'Host', 'online', Date.now()
    );
  }

  private sendRoomState(ws: WebSocket, isAdmin: boolean) {
    const roomRow = this.ctx.storage.sql.exec('SELECT * FROM room LIMIT 1').toArray()[0];
    if (!roomRow) return;
    
    const room: Room = {
      id: roomRow.id as string,
      status: roomRow.status as any,
      createdAt: roomRow.created_at as number
    };

    this.ensureHostParticipant();
    const hasAdmin = this.getAllWebSockets().some(s => this.getSession(s)?.isAdmin);
    this.updateParticipantStatus('host', hasAdmin ? 'online' : 'offline');

    const participants = this.ctx.storage.sql.exec(
      'SELECT * FROM participants ORDER BY CASE WHEN id = "host" THEN 0 ELSE 1 END, joined_at ASC'
    ).toArray().map(r => ({
      id: r.id as string,
      displayName: r.display_name as string,
      status: r.status as any,
      joinedAt: r.joined_at as number
    }));

    const messages = this.ctx.storage.sql.exec('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100').toArray().reverse().map(r => ({
      id: r.id as string,
      roomId: this.roomId,
      senderId: r.sender_id as string,
      senderName: r.sender_name as string,
      message: r.content as string,
      timestamp: r.created_at as number
    }));

    const files = this.ctx.storage.sql.exec('SELECT * FROM files ORDER BY created_at DESC').toArray().map(r => ({
      id: r.id as string,
      objectKey: r.object_key as string,
      originalName: r.original_name as string,
      size: r.size as number,
      mimeType: r.mime_type as string,
      uploaderId: r.uploader_id as string,
      uploaderName: r.uploader_name as string,
      createdAt: r.created_at as number
    }));

    let joinRequests: JoinRequest[] | undefined;
    if (isAdmin) {
      joinRequests = this.ctx.storage.sql.exec('SELECT * FROM join_requests').toArray().map(r => ({
        id: r.id as string,
        displayName: r.display_name as string,
        createdAt: r.created_at as number
      }));
    }

    this.send(ws, {
      type: 'ROOM_STATE',
      payload: { room, participants, messages, files, joinRequests, isAdmin }
    });
  }
  
  private closeAll() {
    for (const ws of this.getAllWebSockets()) {
      try { ws.close(); } catch (e) {}
    }
    this.sessions.clear();
  }
}

function generateId() {
  return crypto.randomUUID();
}
