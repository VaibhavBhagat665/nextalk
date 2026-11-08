# Docker Deployment Guide

Docker solves the memory issues and gives you consistent deployments across all platforms.

## 🐳 Quick Start

### Local Testing

1. **Build the image:**
   ```bash
   docker build -t nextalk-socket .
   ```

2. **Run with environment variables:**
   ```bash
   docker run -p 3001:3001 \
     -e DATABASE_URL="your-db-url" \
     -e REDIS_URL="your-redis-url" \
     -e CLERK_SECRET_KEY="your-key" \
     nextalk-socket
   ```

3. **Or use docker-compose:**
   ```bash
   # Create .env file first with your variables
   docker-compose up -d
   ```

4. **Check logs:**
   ```bash
   docker-compose logs -f socket-server
   ```

5. **Test health:**
   ```bash
   curl http://localhost:3001/health
   ```

---

## 🚀 Deploy to Render with Docker

### Option A: Using render.yaml (Recommended)

The `render.yaml` is already configured for Docker. Just:

1. **In Render Dashboard:**
   - Delete your existing service (if it exists)
   - Create New → Blueprint
   - Connect your GitHub repo
   - Render will detect `render.yaml`

2. **Set environment variables in Render dashboard**

3. **Deploy!**

### Option B: Manual Docker Service

1. **Create New Web Service**
2. **Select "Docker" as environment**
3. **Settings:**
   - Dockerfile Path: `./Dockerfile`
   - Docker Context: `./`
   - Docker Command: (leave empty, uses CMD from Dockerfile)

4. **Set environment variables**

5. **Deploy**

---

## ☁️ Deploy to Railway with Docker

Railway automatically detects Dockerfile:

1. **Go to https://railway.app**
2. **New Project → Deploy from GitHub**
3. **Select your repo**
4. Railway auto-detects Dockerfile
5. **Add environment variables**
6. **Deploy!**

That's it! Railway handles everything.

---

## 🪂 Deploy to Fly.io with Docker

1. **Install flyctl:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Create fly.toml:**
   ```bash
   fly launch
   ```

4. **Set secrets:**
   ```bash
   fly secrets set DATABASE_URL="your-db-url"
   fly secrets set REDIS_URL="your-redis-url"
   fly secrets set CLERK_SECRET_KEY="your-key"
   ```

5. **Deploy:**
   ```bash
   fly deploy
   ```

---

## 🌊 Deploy to DigitalOcean App Platform

1. **Create New App**
2. **Select GitHub repo**
3. **Detected as Docker automatically**
4. **Configure:**
   - HTTP Port: 3001
   - Health Check: /health
5. **Add environment variables**
6. **Deploy**

**Cost:** $5/month for basic plan

---

## ☁️ Deploy to Google Cloud Run

1. **Build and push to Google Container Registry:**
   ```bash
   gcloud builds submit --tag gcr.io/YOUR-PROJECT/nextalk-socket
   ```

2. **Deploy:**
   ```bash
   gcloud run deploy nextalk-socket \
     --image gcr.io/YOUR-PROJECT/nextalk-socket \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars DATABASE_URL="your-db-url"
   ```

**Cost:** Pay per request (generous free tier)

---

## 📦 Deploy to AWS ECS/Fargate

1. **Push to Amazon ECR:**
   ```bash
   aws ecr create-repository --repository-name nextalk-socket
   docker tag nextalk-socket:latest YOUR-ACCOUNT.dkr.ecr.REGION.amazonaws.com/nextalk-socket
   docker push YOUR-ACCOUNT.dkr.ecr.REGION.amazonaws.com/nextalk-socket
   ```

2. **Create ECS Task Definition** (use Fargate)

3. **Create ECS Service**

4. **Configure Load Balancer**

---

## 🔧 Docker Image Optimization

The Dockerfile uses multi-stage build to reduce size:

**Stage 1 (Builder):**
- Installs build dependencies
- Builds native modules
- Generates Prisma Client

**Stage 2 (Runner):**
- Only copies built artifacts
- Minimal Alpine Linux base
- No build tools included

**Result:**
- Build stage: ~500MB
- Final image: ~150MB
- Much faster deployments

---

## 🔍 Troubleshooting

### "Cannot connect to database"
Add `?sslmode=require` to DATABASE_URL if using cloud database.

### "Prisma Client not generated"
The Dockerfile handles this automatically in the builder stage.

### "Port already in use"
Change the port mapping:
```bash
docker run -p 3002:3001 ...  # Use port 3002 on host
```

### Check container logs:
```bash
docker logs nextalk-socket
```

### Debug inside container:
```bash
docker exec -it nextalk-socket sh
```

---

## 📊 Performance

Docker deployment advantages:
- ✅ **No OOM errors** (controlled memory)
- ✅ **Consistent builds** (same everywhere)
- ✅ **Fast deployments** (layered caching)
- ✅ **Easy scaling** (just run more containers)
- ✅ **Platform independent** (works on any Docker host)

---

## 🎯 Recommended: Render with Docker

**Why:**
1. ✅ No more memory issues
2. ✅ Automatic deployments from GitHub
3. ✅ Built-in health checks
4. ✅ $7/month for reliable hosting
5. ✅ Simple setup with render.yaml

**To deploy:**
```bash
# Just push to GitHub
git push origin main

# Render automatically:
# 1. Detects Dockerfile
# 2. Builds Docker image
# 3. Deploys container
# 4. Monitors health
```

That's it! No more OOM, no more build failures. 🎉

---

## 📝 Next Steps

1. ✅ **Update render.yaml is already done**
2. ✅ **Dockerfile is ready**
3. ⬜ **Delete old Render service**
4. ⬜ **Create new Blueprint deployment**
5. ⬜ **Set environment variables**
6. ⬜ **Deploy!**

Docker will solve all your memory issues. The build happens in isolated stages with proper memory limits.
