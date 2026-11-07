# Deploying Socket.io Server to Render

## Prerequisites

1. A Render account (sign up at https://render.com)
2. PostgreSQL database URL
3. Redis instance URL
4. Clerk API keys
5. Cloudinary credentials

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Connect your GitHub repository to Render**
   - Go to https://dashboard.render.com
   - Click "New" → "Blueprint"
   - Connect your GitHub account
   - Select the `nextalk` repository
   - Render will automatically detect `render.yaml`

2. **Set Environment Variables**
   
   In the Render dashboard, set these environment variables:
   
   ```
   NODE_ENV=production
   DATABASE_URL=postgresql://user:password@host:port/database
   REDIS_URL=redis://user:password@host:port
   CLERK_SECRET_KEY=sk_test_xxxxx
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   GROQ_API_KEY=gsk_xxxxx (optional, for AI features)
   PORT=3001 (or your preferred port)
   ```

3. **Deploy**
   - Click "Apply" to create the service
   - Render will automatically build and deploy
   - Monitor the logs for any issues

### Option 2: Manual Web Service

1. **Create New Web Service**
   - Go to https://dashboard.render.com
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build Settings**
   ```
   Name: nextalk-socket-server
   Runtime: Node
   Build Command: npm install && npx prisma generate
   Start Command: npm run start:socket
   ```

3. **Set Environment Variables** (same as Option 1)

4. **Deploy**

## Required Environment Variables

### Essential
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `CLERK_SECRET_KEY` - Clerk authentication key
- `NODE_ENV` - Set to "production"

### Optional
- `GROQ_API_KEY` - For AI/RAG features
- `CLOUDINARY_CLOUD_NAME` - For image uploads
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `PORT` - Server port (default: 3001)

## Database Setup

After deploying, you need to push the Prisma schema:

```bash
# From your local machine with DATABASE_URL set
export DATABASE_URL="your-render-postgres-url"
npx prisma db push --skip-generate
```

Or use the migration scripts:
```bash
./scripts/migrate-production.sh
```

## Verifying Deployment

1. **Check Health Endpoint**
   ```bash
   curl https://your-app.onrender.com/health
   ```
   Should return status information

2. **Check Logs**
   - Go to your service in Render dashboard
   - Click "Logs" tab
   - Look for "🚀 Socket.IO server running"

3. **Test Socket.io Connection**
   ```javascript
   const socket = io('https://your-app.onrender.com');
   socket.on('connect', () => console.log('Connected!'));
   ```

## Common Issues

### Issue: "npm install failed"
**Solution**: 
- Check that Node version is 18-20 (not 24+)
- Verify `.node-version` file exists
- Check build logs for specific errors

### Issue: "Prisma Client not generated"
**Solution**: 
- Ensure build command includes `npx prisma generate`
- Check that `DATABASE_URL` is set

### Issue: "Cannot connect to database"
**Solution**:
- Verify `DATABASE_URL` is correct
- Ensure database allows connections from Render IPs
- Check if database requires SSL (`?sslmode=require`)

### Issue: "Redis connection failed"
**Solution**:
- Verify `REDIS_URL` format
- Check Redis instance is accessible
- Consider using Render's Redis add-on

## Connecting Vercel Frontend to Render Backend

In your Vercel project, set:

```
NEXT_PUBLIC_SOCKET_URL=https://your-render-app.onrender.com
```

The frontend will connect to your Render-hosted Socket.io server.

## Auto-Deploy

Once connected to GitHub:
- ✅ Automatic deploys on push to `main`
- ✅ Preview deploys for pull requests (optional)
- ✅ Rollback to previous deploys

## Monitoring

- **Metrics**: Available in Render dashboard
- **Logs**: Real-time streaming in dashboard
- **Health Checks**: Automatic via `/health` endpoint

## Scaling

To handle more connections:
1. Upgrade to higher Render plan
2. Enable horizontal scaling (multiple instances)
3. Ensure Redis is used for Socket.io adapter
4. Monitor memory and CPU usage

## Cost

- **Free Tier**: 750 hours/month (spins down after 15 min inactivity)
- **Starter**: $7/month (always on, more resources)
- **Pro**: $25/month+ (autoscaling, more power)

For production, recommend at least Starter tier.
