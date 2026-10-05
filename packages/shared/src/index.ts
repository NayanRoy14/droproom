export interface Room {
  id: string;
  name?: string;
  status: 'active' | 'closed';
  createdAt: number;
}

export interface Participant {
  id: string;
  displayName: string;
  status: 'online' | 'offline';
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
}

export interface FileMetadata {
  id: string;
  objectKey: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: number;
}

export interface JoinRequest {
  id: string; // usually same as participant id
  displayName: string;
  createdAt: number;
}

// WebSocket Events
// Client -> Server
export type ClientEvent =
  | { type: 'JOIN_REQUEST'; payload: { displayName: string } }
  | { type: 'JOIN_APPROVE'; payload: { participantId: string } }
  | { type: 'JOIN_REJECT'; payload: { participantId: string } }
  | { type: 'CHAT_SEND'; payload: { message: string } }
  | { type: 'FILE_UPLOAD_COMPLETE'; payload: { fileId: string; originalName: string; size: number; mimeType: string } }
  | { type: 'REMOVE_PARTICIPANT'; payload: { participantId: string } }
  | { type: 'END_ROOM' }
  | { type: 'PING' };

// Server -> Client
export type ServerEvent =
  | { type: 'JOIN_REQUEST_RECEIVED'; payload: JoinRequest }
  | { type: 'JOIN_REQUEST_RESOLVED'; payload: { participantId: string } }
  | { type: 'JOIN_APPROVED'; payload: { sessionId: string; roomId: string; participant: Participant } }
  | { type: 'JOIN_REJECTED'; payload: { reason?: string } }
  | { type: 'PARTICIPANT_JOINED'; payload: Participant }
  | { type: 'PARTICIPANT_LEFT'; payload: { participantId: string } }
  | { type: 'PARTICIPANT_REMOVED'; payload: { participantId: string } }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'FILE_SHARED'; payload: FileMetadata }
  | { type: 'FILE_REMOVED'; payload: { fileId: string } }
  | { type: 'ROOM_ENDED' }
  | {
      type: 'ROOM_STATE';
      payload: {
        room: Room;
        participants: Participant[];
        messages: ChatMessage[];
        files: FileMetadata[];
        joinRequests?: JoinRequest[]; // Only for admin
        isAdmin: boolean;
      };
    }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'PONG' };
