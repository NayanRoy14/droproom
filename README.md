# DropRoom (DropXYZ)

Ephemeral rooms for real-time file sharing and chat — without leaving anything behind.

## Architecture

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript. Hosted on Vercel (`https://dropxyz.vercel.app`).
- **Backend API & WebSockets**: Cloudflare Workers (`https://droproom-worker.nayanroy.workers.dev`).
- **Database & Realtime Sync**: Cloudflare Durable Objects backed by embedded SQLite (`RoomDurableObject`).
- **Storage**: Cloudflare R2 private bucket (`droproom-files`) with presigned S3 PUT/GET URLs. Direct browser-to-R2 uploads.
- **Cleanup**: Durable Object Storage Alarms with automated AWS S3 signed deletions and SQLite table purges.

---

## Workspace Structure

```
droproom/
├── apps/
│   ├── web/         # Next.js frontend web application
│   └── worker/      # Cloudflare Worker & Durable Objects backend
└── packages/
    └── shared/      # Shared TypeScript types and WebSocket protocol definitions
```

---

## Local Development

### 1. Prerequisites
- Node.js >= 20 (Node 24 recommended)
- Cloudflare account with Workers and R2 enabled
- Wrangler CLI installed (`npm install -g wrangler`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables

#### Worker (`apps/worker/.dev.vars`):
```env
FRONTEND_URL="http://localhost:3000"
ROOM_CLEANUP_GRACE_SECONDS="60"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="droproom-files"
CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
```

#### Web (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL="http://localhost:8787"
```

### 4. Running Locally
Run worker and web in separate terminals:
```bash
# Terminal 1: Cloudflare Worker
npm run dev:worker

# Terminal 2: Next.js Frontend
npm run dev:web
```
Open `http://localhost:3000` in your browser.

---

## Development & CI Commands

| Command | Action |
| :--- | :--- |
| `npm run typecheck` | Runs TypeScript checks across all workspaces (`tsc --noEmit`) |
| `npm run lint` | Runs Next.js ESLint checks |
| `npm test` | Runs unit tests using Node.js test runner |
| `npm run build:web` | Produces production build of Next.js frontend |
| `npm run build:worker` | Bundles and verifies Cloudflare Worker via Wrangler dry-run |
| `npm run deploy:worker` | Deploys Worker to Cloudflare |

---

## Cloudflare Setup & Deployment

### 1. Authenticate Wrangler
```bash
npx wrangler login
```

### 2. Create R2 Bucket
```bash
npx wrangler r2 bucket create droproom-files
```

### 3. Configure R2 Bucket CORS
Create `cors.json`:
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://dropxyz.vercel.app",
      "https://droproom-umber.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```
Apply CORS to R2:
```bash
npx wrangler r2 bucket cors set droproom-files cors.json
```

### 4. Configure Production Secrets
Set the following secrets on Cloudflare:
```bash
npx wrangler secret put R2_ACCESS_KEY_ID --name droproom-worker
npx wrangler secret put R2_SECRET_ACCESS_KEY --name droproom-worker
npx wrangler secret put R2_BUCKET_NAME --name droproom-worker
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --name droproom-worker
npx wrangler secret put FRONTEND_URL --name droproom-worker
npx wrangler secret put ROOM_CLEANUP_GRACE_SECONDS --name droproom-worker
```

### 5. Deploy Worker
```bash
npm run deploy:worker
```

---

## Vercel Deployment

1. Connect the repository to Vercel.
2. In Project Settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web` (or root with monorepo auto-detection)
   - **Build Command**: `npm run build`
3. Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://droproom-worker.nayanroy.workers.dev`
4. Set production domain/alias to `dropxyz.vercel.app`.

---

## Room Lifecycle & Data Erasure

DropRoom offers **zero persistent residue** once a room concludes:

1. **Explicit End Room (Host Action)**:
   - The host clicks "End Room" and confirms.
   - Instantly broadcasts `ROOM_ENDED` to all connected clients.
   - Force-closes all client WebSockets.
   - Immediately dispatches signed AWS S3 `DELETE` requests to R2 for all uploaded files.
   - Drops/deletes all SQLite tables (`messages`, `files`, `participants`, `join_requests`, `room`).
   - The room returns `HTTP 410 Gone` on all subsequent requests.

2. **Passive Exit (Everyone Leaves / Closes Tabs)**:
   - When the last active WebSocket disconnects, the Durable Object starts a grace period timer (default 60 seconds).
   - If a participant reconnects before the timer expires, the alarm is automatically cancelled to prevent accidental loss during tab reloads.
   - Once the alarm triggers with 0 active connections, the DO permanently deletes all files from Cloudflare R2 and wipes SQLite storage.

---

## Security Architecture

- **Private Storage**: Cloudflare R2 bucket is strictly private with no public read access.
- **Short-Lived Presigned URLs**: Files are uploaded and downloaded directly between browser and R2 using signed AWS S3 URLs with a 15-minute expiration (`X-Amz-Expires=900`).
- **Secret Isolation**: R2 Access Key ID and Secret Access Key reside exclusively on Cloudflare Workers and are never sent to the browser.
- **Strict Authorization**: File upload URLs, download URLs, and file registration require valid DO session verification or host token authentication.
- **Path Traversal Protection**: Uploaded filenames are sanitized (`path.basename` equivalent, alphanumeric normalization, stripped relative traversal dots) and scoped strictly under `rooms/{roomId}/{fileId}/`.
- **SQL Injection Prevention**: All Durable Object SQLite queries strictly use parameterized statements (`?`).
- **XSS & Message Sanitization**: Chat messages are trimmed and size-limited (max 2,000 characters). React's standard JSX escaping prevents HTML injection.
- **Admission Control**: Guests must submit a join request; hosts admit or decline in real time.

---

- **Maximum File Size**: 1 GB per file.
- **Batch & Folder Transfers**: Supports multi-file selection, whole folder recursive upload preserving structure, and window drag-and-drop.
- **Fast Guest Joining**: Room code click triggers QR code modal for instant mobile camera joining.
- **Ephemeral Storage**: All files and chat logs are destroyed permanently upon room termination.

