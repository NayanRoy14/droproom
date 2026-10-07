import { Env } from './types';
import { AwsClient } from 'aws4fetch';
import { MAX_FILE_SIZE_BYTES } from '@droproom/shared';
export { RoomDurableObject } from './RoomDurableObject';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const reqOrigin = request.headers.get('Origin') || '';
    const isAllowed = !env.FRONTEND_URL ||
      reqOrigin.includes('localhost') ||
      reqOrigin.includes('127.0.0.1') ||
      reqOrigin.endsWith('.vercel.app') ||
      reqOrigin === env.FRONTEND_URL;
    const allowedOrigin = isAllowed && reqOrigin ? reqOrigin : (env.FRONTEND_URL || '*');

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method === 'GET' && url.pathname === '/api/storage-stats') {
        const globalId = env.ROOM_DO.idFromName('__GLOBAL_STORAGE__');
        const globalDO = env.ROOM_DO.get(globalId);
        const statsRes = await globalDO.fetch(new Request('http://do/global-storage/stats'));
        return new Response(statsRes.body, {
          status: statsRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/storage-reconcile') {
        const globalId = env.ROOM_DO.idFromName('__GLOBAL_STORAGE__');
        const globalDO = env.ROOM_DO.get(globalId);
        const reconcileRes = await globalDO.fetch(new Request('http://do/global-storage/reconcile', { method: 'POST' }));
        return new Response(reconcileRes.body, {
          status: reconcileRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'GET' && url.pathname === '/api/rooms/local') {
        const clientIp = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-real-ip') || 
                         request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                         '127.0.0.1';
        const ipSubnet = getIpSubnet(clientIp);
        const globalId = env.ROOM_DO.idFromName('__GLOBAL_STORAGE__');
        const globalDO = env.ROOM_DO.get(globalId);
        const listRes = await globalDO.fetch(new Request(`http://do/global-discovery/list?ip=${encodeURIComponent(clientIp)}&subnet=${encodeURIComponent(ipSubnet)}`));
        return new Response(listRes.body, {
          status: listRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/rooms') {
        const roomId = generateRoomCode(4);
        const adminToken = generateRandomString(32);
        
        const id = env.ROOM_DO.idFromName(roomId);
        const roomDO = env.ROOM_DO.get(id);
        
        const res = await roomDO.fetch(new Request('http://do/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, adminToken })
        }));
        
        if (!res.ok) throw new Error('Failed to init room');

        const clientIp = request.headers.get('cf-connecting-ip') || 
                         request.headers.get('x-real-ip') || 
                         request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                         '127.0.0.1';
        const ipSubnet = getIpSubnet(clientIp);

        try {
          const globalId = env.ROOM_DO.idFromName('__GLOBAL_STORAGE__');
          const globalDO = env.ROOM_DO.get(globalId);
          await globalDO.fetch(new Request('http://do/global-discovery/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, clientIp, ipSubnet })
          }));
        } catch (e) {
          console.error('Failed to register discoverable room', e);
        }

        return new Response(JSON.stringify({ roomId, adminToken }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const roomMatch = url.pathname.match(/^\/api\/rooms\/([a-zA-Z0-9_-]+)(.*)$/);
      if (roomMatch) {
        const roomId = roomMatch[1].toLowerCase();
        const path = roomMatch[2] || '/';
        
        // Handle Presigned URLs in the Worker, rather than DO, since it needs secrets from Env
        if (request.method === 'POST' && path === '/upload-url') {
          const body = await request.json() as any;
          if (!body || typeof body !== 'object') {
            return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: corsHeaders });
          }
          const { filename, size, mimeType, sessionId, adminToken } = body;
          if (typeof filename !== 'string' || !filename.trim()) {
            return new Response(JSON.stringify({ error: 'Filename is required' }), { status: 400, headers: corsHeaders });
          }
          if (typeof size !== 'number' || size <= 0) {
            return new Response(JSON.stringify({ error: 'Invalid file size' }), { status: 400, headers: corsHeaders });
          }
          if (size > MAX_FILE_SIZE_BYTES) {
            return new Response(JSON.stringify({ error: 'File too large (max 1 GB per file)' }), { status: 413, headers: corsHeaders });
          }

          // 1. Authorize via Room DO first (room lifetime, room quota, participant permissions)
          const id = env.ROOM_DO.idFromName(roomId);
          const roomDO = env.ROOM_DO.get(id);
          const authRes = await roomDO.fetch(new Request('http://do/authorize-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, adminToken, size })
          }));

          if (!authRes.ok) {
            const errText = await authRes.text();
            let parsedErr;
            try { parsedErr = JSON.parse(errText); } catch { parsedErr = { error: errText || 'Unauthorized' }; }
            return new Response(JSON.stringify(parsedErr), { status: authRes.status, headers: corsHeaders });
          }

          // 2. Atomic Global Storage Reservation Check & Hold
          const fileId = crypto.randomUUID();
          const globalId = env.ROOM_DO.idFromName('__GLOBAL_STORAGE__');
          const globalDO = env.ROOM_DO.get(globalId);
          const globalRes = await globalDO.fetch(new Request('http://do/global-storage/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, fileId, userId: sessionId || (adminToken ? 'admin' : 'anonymous'), size })
          }));

          if (!globalRes.ok) {
            const errData = await globalRes.json().catch(() => ({}));
            return new Response(JSON.stringify(errData), { status: globalRes.status, headers: corsHeaders });
          }

          const reservationData = await globalRes.json() as any;
          const reservationId = reservationData.reservationId;

          // 3. Generate Presigned URL
          const rawName = filename.split(/[/\\]/).pop() || 'file';
          const safeFilename = rawName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.{2,}/g, '_') || 'file';
          const objectKey = `rooms/${roomId}/${fileId}/${safeFilename}`;

          try {
            const aws = new AwsClient({
              accessKeyId: env.R2_ACCESS_KEY_ID,
              secretAccessKey: env.R2_SECRET_ACCESS_KEY,
              service: 's3',
              region: 'auto',
            });

            const r2Url = new URL(`https://${env.R2_BUCKET_NAME}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`);
            r2Url.searchParams.set('X-Amz-Expires', '900'); // 15 minutes
            
            const signed = await aws.sign(new Request(r2Url.toString(), {
              method: 'PUT',
              headers: {
                'Content-Type': typeof mimeType === 'string' && mimeType ? mimeType : 'application/octet-stream'
              }
            }), { aws: { signQuery: true } });

            return new Response(JSON.stringify({
              uploadUrl: signed.url,
              fileId,
              reservationId,
              objectKey,
              originalName: rawName
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } catch (signingErr: any) {
            // Rollback reservation if presigning failed
            try {
              await globalDO.fetch(new Request('http://do/global-storage/release-reservation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservationId, fileId })
              }));
            } catch (e) {}
            return new Response(JSON.stringify({ error: 'Failed to generate upload URL' }), {
              status: 500,
              headers: corsHeaders
            });
          }
        }

        if (request.method === 'POST' && path === '/upload-cancel') {
          const body = await request.json().catch(() => ({})) as any;
          const { fileId, reservationId } = body || {};
          if (fileId || reservationId) {
            try {
              const globalId = env.ROOM_DO.idFromName('__GLOBAL_STORAGE__');
              const globalDO = env.ROOM_DO.get(globalId);
              await globalDO.fetch(new Request('http://do/global-storage/release-reservation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservationId, fileId })
              }));
            } catch (e) {}
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST' && path.startsWith('/download-url/')) {
          const fileId = decodeURIComponent(path.replace('/download-url/', ''));
          if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
            return new Response(JSON.stringify({ error: 'Invalid file ID' }), { status: 400, headers: corsHeaders });
          }

          const body = await request.json() as any;
          const { sessionId, adminToken } = body;

          // Authorize via DO
          const id = env.ROOM_DO.idFromName(roomId);
          const roomDO = env.ROOM_DO.get(id);
          const authRes = await roomDO.fetch(new Request(`http://do/authorize-download/${fileId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, adminToken })
          }));

          if (!authRes.ok) return new Response(await authRes.text(), { status: authRes.status, headers: corsHeaders });
          const { objectKey, originalName } = await authRes.json() as any;

          const aws = new AwsClient({
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            service: 's3',
            region: 'auto',
          });

          const r2Url = new URL(`https://${env.R2_BUCKET_NAME}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`);
          r2Url.searchParams.set('X-Amz-Expires', '900'); // 15 minutes

          // Enforce browser file attachment with clean leaf filename
          const cleanDownloadName = (typeof originalName === 'string' ? originalName : objectKey.split('/').pop() || 'file')
            .split(/[/\\]/).pop() || 'file';
          r2Url.searchParams.set('response-content-disposition', `attachment; filename="${encodeURIComponent(cleanDownloadName)}"`);
          
          const signed = await aws.sign(new Request(r2Url.toString(), {
            method: 'GET'
          }), { aws: { signQuery: true } });

          return new Response(JSON.stringify({
            downloadUrl: signed.url
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        if (request.method === 'POST' && path === '/file-complete') {
          const payload = await request.json() as any;
          if (!payload || typeof payload !== 'object') {
            return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: corsHeaders });
          }

          const { fileId, reservationId, objectKey, originalName, mimeType, participantId, adminToken, sessionId } = payload;
          if (!fileId || !objectKey) {
            return new Response(JSON.stringify({ error: 'fileId and objectKey are required' }), { status: 400, headers: corsHeaders });
          }

          if (!objectKey.startsWith(`rooms/${roomId}/${fileId}/`)) {
            return new Response(JSON.stringify({ error: 'Invalid object key for this room' }), { status: 400, headers: corsHeaders });
          }

          // 1. Authoritative check: verify R2 object exists and inspect Content-Length
          const aws = new AwsClient({
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            service: 's3',
            region: 'auto',
          });

          let actualSize = 0;
          try {
            const headUrl = new URL(`https://${env.R2_BUCKET_NAME}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`);
            const headReq = await aws.sign(new Request(headUrl.toString(), { method: 'HEAD' }));
            const headRes = await fetch(headReq);
            if (!headRes.ok) {
              return new Response(JSON.stringify({ error: 'Uploaded object not found in R2 storage' }), { status: 400, headers: corsHeaders });
            }
            const cl = headRes.headers.get('content-length');
            actualSize = cl ? parseInt(cl, 10) : 0;
            if (!actualSize || actualSize <= 0) {
              return new Response(JSON.stringify({ error: 'Empty or invalid file in R2 storage' }), { status: 400, headers: corsHeaders });
            }
          } catch (headErr: any) {
            return new Response(JSON.stringify({ error: 'Failed to verify object in storage' }), { status: 500, headers: corsHeaders });
          }

          // 2. Commit storage reservation atomically inside global DO
          const globalId = env.ROOM_DO.idFromName('__GLOBAL_STORAGE__');
          const globalDO = env.ROOM_DO.get(globalId);
          if (reservationId) {
            const commitRes = await globalDO.fetch(new Request('http://do/global-storage/commit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reservationId, fileId, roomId, actualBytes: actualSize })
            }));

            if (!commitRes.ok) {
              const commitErr = await commitRes.json().catch(() => ({}));
              return new Response(JSON.stringify(commitErr), { status: commitRes.status, headers: corsHeaders });
            }
          } else {
            await globalDO.fetch(new Request('http://do/global-storage/record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ size: actualSize })
            }));
          }

          // 3. Forward to Room DO to record in room DB and broadcast FILE_SHARED
          const id = env.ROOM_DO.idFromName(roomId);
          const roomDO = env.ROOM_DO.get(id);
          const doRes = await roomDO.fetch(new Request('http://do/file-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileId,
              objectKey,
              originalName,
              size: actualSize,
              mimeType,
              participantId,
              adminToken,
              sessionId
            })
          }));

          if (!doRes.ok) {
            const errText = await doRes.text();
            return new Response(errText, { status: doRes.status, headers: corsHeaders });
          }

          return new Response(JSON.stringify({ ok: true, fileId, size: actualSize }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const deleteMatch = path.match(/^\/files\/([a-zA-Z0-9_-]+)$/);
        if (request.method === 'DELETE' && deleteMatch) {
          const fileId = deleteMatch[1];
          const body = await request.json().catch(() => ({})) as any;
          const { sessionId, adminToken } = body;

          const id = env.ROOM_DO.idFromName(roomId);
          const roomDO = env.ROOM_DO.get(id);
          const delRes = await roomDO.fetch(new Request(`http://do/delete-file/${fileId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, adminToken })
          }));

          return new Response(delRes.body, {
            status: delRes.status,
            headers: corsHeaders
          });
        }

        const id = env.ROOM_DO.idFromName(roomId);
        const roomDO = env.ROOM_DO.get(id);
        
        const doUrl = new URL(request.url);
        doUrl.pathname = path;
        
        const doReq = new Request(doUrl.toString(), request);
        const response = await roomDO.fetch(doReq);
        
        if (response.status === 101) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};

function generateRoomCode(length = 4) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  for (let i = 0; i < length; i++) {
    result += chars[randomArray[i] % chars.length];
  }
  return result;
}

function generateRandomString(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  for (let i = 0; i < length; i++) {
    result += chars[randomArray[i] % chars.length];
  }
  return result;
}

function getIpSubnet(ip: string): string {
  if (!ip) return '';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':');
  }
  const parts = ip.split('.');
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('.');
  }
  return ip;
}
