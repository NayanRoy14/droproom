import { Env } from './types';
import { AwsClient } from 'aws4fetch';
export { RoomDurableObject } from './RoomDurableObject';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
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
          if (size > 1024 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: 'File too large (max 1 GB)' }), { status: 413, headers: corsHeaders });
          }

          // Authorize via DO
          const id = env.ROOM_DO.idFromName(roomId);
          const roomDO = env.ROOM_DO.get(id);
          const authRes = await roomDO.fetch(new Request('http://do/authorize-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, adminToken })
          }));

          if (!authRes.ok) return new Response('Unauthorized', { status: 403, headers: corsHeaders });

          const fileId = crypto.randomUUID();
          const rawName = filename.split(/[/\\]/).pop() || 'file';
          const safeFilename = rawName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.{2,}/g, '_') || 'file';
          const objectKey = `rooms/${roomId}/${fileId}/${safeFilename}`;

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
            objectKey,
            originalName: rawName
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
          
          const id = env.ROOM_DO.idFromName(roomId);
          const roomDO = env.ROOM_DO.get(id);
          
          const doUrl = new URL(request.url);
          doUrl.pathname = '/file-complete';
          
          const doReq = new Request(doUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const response = await roomDO.fetch(doReq);
          
          return new Response(response.body, {
            status: response.status,
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
