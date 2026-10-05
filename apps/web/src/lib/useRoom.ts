"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { ClientEvent, ServerEvent, Room, Participant, ChatMessage, FileMetadata, JoinRequest } from '@droproom/shared';

import { API_URL } from '@/lib/config';

export function useRoom(roomId: string, adminToken?: string, participantId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'rejected' | 'ended'>('connecting');
  const [rejectReason, setRejectReason] = useState('');
  
  const cleanRoomId = roomId ? roomId.toLowerCase().trim() : '';

  const [sessionIdState, setSessionIdState] = useState<string | null>(() => {
    if (participantId) return participantId;
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`dropxyz_session_${cleanRoomId}`) || null;
    }
    return null;
  });
  
  const ws = useRef<WebSocket | null>(null);
  const sessionId = useRef<string | null>(participantId || (typeof window !== 'undefined' ? sessionStorage.getItem(`dropxyz_session_${cleanRoomId}`) : null));
  const isEndedRef = useRef(false);
  const isRejectedRef = useRef(false);
  const reconnectTimerRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (isEndedRef.current || isRejectedRef.current) return;
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
    }
    
    setStatus('connecting');
    
    let url = new URL(`${API_URL}/api/rooms/${cleanRoomId}/ws`);
    url.protocol = url.protocol.replace('http', 'ws');
    if (adminToken) url.searchParams.set('adminToken', adminToken);
    if (sessionId.current) url.searchParams.set('participantId', sessionId.current);
    
    const socket = new WebSocket(url.toString());
    ws.current = socket;
    
    socket.onopen = () => {
      if (isEndedRef.current || isRejectedRef.current) {
        socket.close();
        return;
      }
      setStatus('connected');
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerEvent;
        
        switch (data.type) {
          case 'ROOM_STATE':
            setRoom(data.payload.room);
            setParticipants(data.payload.participants);
            setMessages(data.payload.messages);
            setFiles(data.payload.files);
            if (data.payload.joinRequests) setJoinRequests(data.payload.joinRequests);
            setIsAdmin(data.payload.isAdmin);
            break;
          case 'PARTICIPANT_JOINED':
            setParticipants(p => {
              const exists = p.find(x => x.id === data.payload.id);
              if (exists) return p.map(x => x.id === data.payload.id ? data.payload : x);
              return [...p, data.payload];
            });
            setJoinRequests(r => r.filter(x => x.id !== data.payload.id));
            break;
          case 'PARTICIPANT_LEFT':
            setParticipants(p => p.map(x => x.id === data.payload.participantId ? { ...x, status: 'offline' } : x));
            break;
          case 'PARTICIPANT_REMOVED':
            setParticipants(p => p.filter(x => x.id !== data.payload.participantId));
            break;
          case 'CHAT_MESSAGE':
            setMessages(m => [...m, data.payload]);
            break;
          case 'FILE_SHARED':
            setFiles(f => [data.payload, ...f]);
            break;
          case 'JOIN_REQUEST_RECEIVED':
            setJoinRequests(r => {
              if (r.some(x => x.id === data.payload.id)) return r;
              return [...r, data.payload];
            });
            break;
          case 'JOIN_REQUEST_RESOLVED':
            setJoinRequests(r => r.filter(x => x.id !== data.payload.participantId));
            break;
          case 'JOIN_APPROVED':
            sessionId.current = data.payload.sessionId;
            setSessionIdState(data.payload.sessionId);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`dropxyz_session_${cleanRoomId}`, data.payload.sessionId);
            }
            break;
          case 'JOIN_REJECTED':
            isRejectedRef.current = true;
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem(`dropxyz_session_${cleanRoomId}`);
            }
            setStatus('rejected');
            setRejectReason(data.payload.reason || 'Admin declined your request.');
            socket.close();
            break;
          case 'ROOM_ENDED':
            isEndedRef.current = true;
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem(`dropxyz_session_${cleanRoomId}`);
            }
            setStatus('ended');
            socket.close();
            break;
        }
      } catch (err) {
        console.error('Failed to parse websocket message', err);
      }
    };
    
    socket.onclose = async () => {
      if (isEndedRef.current || isRejectedRef.current) {
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/rooms/${cleanRoomId}/info`);
        if (res.status === 410 || res.status === 404) {
          isEndedRef.current = true;
          setStatus('ended');
          return;
        }
      } catch (e) {
        // Network offline or temporary glitch
      }

      if (isEndedRef.current || isRejectedRef.current) {
        return;
      }

      setStatus('disconnected');
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = setTimeout(connect, 2000);
    };
    
    return () => {
      socket.close();
    };
  }, [cleanRoomId, adminToken]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [connect]);

  const sendEvent = useCallback((event: ClientEvent) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(event));
    }
  }, []);

  const approveJoin = useCallback((participantId: string) => {
    setJoinRequests(r => r.filter(x => x.id !== participantId));
    sendEvent({ type: 'JOIN_APPROVE', payload: { participantId } });
  }, [sendEvent]);

  const rejectJoin = useCallback((participantId: string) => {
    setJoinRequests(r => r.filter(x => x.id !== participantId));
    sendEvent({ type: 'JOIN_REJECT', payload: { participantId } });
  }, [sendEvent]);

  const endRoom = useCallback(async () => {
    isEndedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setStatus('ended');
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'END_ROOM' }));
    }
    try {
      const cleanRoomId = roomId ? roomId.toLowerCase().trim() : '';
      await fetch(`${API_URL}/api/rooms/${cleanRoomId}/end-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken })
      });
    } catch (e) {
      // Safe to ignore if connection reset or already closed
    }
    if (ws.current) {
      ws.current.close();
    }
  }, [roomId, adminToken]);

  return {
    status,
    rejectReason,
    room,
    participants,
    messages,
    files,
    joinRequests,
    isAdmin,
    sessionId: sessionIdState || sessionId.current,
    sendEvent,
    approveJoin,
    rejectJoin,
    endRoom
  };
}
