# Connect Vercel Frontend to Backend Socket Server

## The Problem
Vercel doesn't allow environment variable keys with "PUBLIC" in them, but Next.js client-side code needs `NEXT_PUBLIC_*` variables.

## The Solution
We use a server-side variable and expose it through `next.config.ts`.

---

## Steps to Configure

### 1. Get Your Backend URL
After your Railway/Render deployment succeeds, copy the URL:
```
https://your-app-name.onrender.com
```
OR
```
https://your-app-name.up.railway.app
```

### 2. Add to Vercel Environment Variables

Go to your Vercel project → **Settings** → **Environment Variables**

Add this variable:
```
Key:   SOCKET_SERVER_URL
Value: https://your-backend-url.onrender.com
```

**Important:** 
- ✅ Use `SOCKET_SERVER_URL` (no "PUBLIC" word)
- ✅ No trailing slash
- ✅ Must be HTTPS in production

### 3. Redeploy Vercel

After adding the environment variable:
1. Go to **Deployments** tab
2. Click the three dots (...) on the latest deployment
3. Click **Redeploy**

OR push a new commit to trigger auto-deploy.

---

## How It Works

### In `next.config.ts`:
```typescript
env: {
  // Expose socket URL to client-side
  NEXT_PUBLIC_SOCKET_URL: process.env.SOCKET_SERVER_URL || "http://localhost:3001",
}
```

### In client code (`lib/socket.ts`):
```typescript
const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
```

The config reads the server-side `SOCKET_SERVER_URL` and exposes it as `NEXT_PUBLIC_SOCKET_URL` to the client.

---

## Verify It Works

After redeployment:

1. **Open browser console** on your Vercel site
2. **Type:** `console.log(process.env.NEXT_PUBLIC_SOCKET_URL)`
3. **Should show:** Your backend URL (not localhost)

If you see localhost, the env variable didn't apply - redeploy again.

---

## Local Development

For local dev, create `.env.local`:
```bash
SOCKET_SERVER_URL=http://localhost:3001
```

This keeps your local dev working while production uses the real backend URL.

---

## Troubleshooting

### ❌ "Cannot connect to socket"
- Check that backend is running (visit `https://your-backend.onrender.com/health`)
- Verify URL has no trailing slash
- Check browser console for CORS errors

### ❌ "Still showing localhost in production"
- Environment variable not set in Vercel
- Need to redeploy after adding env var
- Typo in variable name (must be `SOCKET_SERVER_URL`)

### ❌ "Mixed content error" (HTTP/HTTPS)
- Backend MUST be HTTPS in production
- Railway/Render provide HTTPS by default
- Don't use `http://` URLs in production
