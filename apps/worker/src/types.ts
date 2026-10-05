export interface Env {
  ROOM_DO: DurableObjectNamespace;
  FRONTEND_URL?: string;
  ROOM_CLEANUP_GRACE_SECONDS?: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  CLOUDFLARE_ACCOUNT_ID: string;
}
