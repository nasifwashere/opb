# 🚨 Render Deployment Troubleshooting Guide

## 🔍 Identified Issues

Based on analysis of your codebase, here are the most likely reasons your Discord bot won't deploy to Render:

### 1. **Environment Variables Not Set in Render Dashboard**
**Problem**: Your code requires `DISCORD_TOKEN` and `MONGO_URI`, but these aren't configured in Render.

**Solution**:
1. Go to your Render service dashboard
2. Navigate to "Environment" tab
3. Add these environment variables:
   ```
   DISCORD_TOKEN = your_discord_bot_token_here
   MONGO_URI = your_mongodb_connection_string_here
   NODE_ENV = production
   ```

### 2. **Render.yaml Configuration Issues**
**Current Issue**: The `render.yaml` has some configurations that might cause problems.

**Fix needed in render.yaml**:
```yaml
services:
  - type: web
    name: one-piece-bot
    env: node
    plan: free
    buildCommand: npm install --production
    startCommand: npm run start:render
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        generateValue: true
    scaling:
      minInstances: 1
      maxInstances: 1
    healthCheckPath: /health
    disk:
      name: bot-data
      mountPath: /opt/render/project/data
      sizeGB: 1
```

### 3. **Discord Bot as Web Service Conflict**
**Problem**: You're deploying a Discord bot as a "web service" instead of a "background worker".

**Options**:

#### Option A: Deploy as Web Service (Current Approach)
- ✅ Your keep-alive server is properly configured
- ✅ Health endpoints are available
- ⚠️ **Potential Issue**: Render expects web services to handle HTTP traffic, but this is primarily a Discord bot

#### Option B: Deploy as Background Worker (Recommended)
- Change service type in render.yaml from `web` to `worker`
- Remove health check requirements
- No need for keep-alive server

### 4. **Build Command Issues**
**Problem**: The build command might fail if dependencies aren't properly installed.

**Check these**:
- Ensure all dependencies in `package.json` are installable
- Verify no missing peer dependencies
- Check if `npm install --production` completes successfully

### 5. **Start Command Problems**
**Current start command**: `node --expose-gc index.js`
**Recommended**: Use the npm script: `npm run start:render`

### 6. **Port Binding Issues**
**Problem**: The keep-alive server might not bind to the correct port.

**Current code in keepAlive.js**:
```javascript
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
```

This looks correct, but verify Render is setting the PORT environment variable.

### 7. **Memory Issues**
**Problem**: Render free tier has 512MB RAM limit.

**Your optimizations look good**:
- Memory monitoring every minute
- Garbage collection when > 400MB
- Connection pooling (max 5 MongoDB connections)

## 🛠️ Quick Fix Steps

### Step 1: Update render.yaml
Replace your current render.yaml with this optimized version:

```yaml
services:
  - type: web
    name: one-piece-bot
    env: node
    plan: free
    buildCommand: npm ci --production
    startCommand: npm run start:render
    envVars:
      - key: NODE_ENV
        value: production
    scaling:
      minInstances: 1
      maxInstances: 1
    healthCheckPath: /health
```

### Step 2: Set Environment Variables
In Render Dashboard → Environment:
- `DISCORD_TOKEN` = your bot token
- `MONGO_URI` = your MongoDB connection string

### Step 3: Test Health Endpoint Locally
Run locally and test:
```bash
npm run start:render
curl http://localhost:3000/health
```

Should return status 200 with JSON response.

### Step 4: Check Build Logs
After deployment, check Render's build logs for:
- npm install errors
- Missing dependencies
- Build failures

### Step 5: Check Runtime Logs
Monitor for:
- Discord login failures
- MongoDB connection errors
- Memory issues
- Health check failures

## 🔧 Alternative: Deploy as Background Worker

If web service continues to fail, try this render.yaml:

```yaml
services:
  - type: worker
    name: one-piece-bot
    env: node
    plan: free
    buildCommand: npm ci --production
    startCommand: npm run start:prod
    envVars:
      - key: NODE_ENV
        value: production
    scaling:
      minInstances: 1
      maxInstances: 1
```

Remove or comment out the `keepAlive()` call in index.js:
```javascript
// Import keep-alive server for Render deployment
// const { keepAlive } = require('./keepAlive');

// Start keep-alive server immediately for Render
// keepAlive();
```

## 🚨 Common Error Messages and Solutions

### "Application failed to respond to HTTP requests"
- **Cause**: Health check endpoint not responding
- **Fix**: Ensure keep-alive server starts before Discord client
- **Check**: Test `/health` endpoint returns 200

### "Build failed: npm install"
- **Cause**: Missing dependencies or package conflicts
- **Fix**: Run `npm ci` locally to test
- **Check**: Review package-lock.json for conflicts

### "Discord login failed"
- **Cause**: Invalid or missing DISCORD_TOKEN
- **Fix**: Verify token in Render environment variables
- **Check**: Token hasn't expired or been regenerated

### "MongoDB connection timeout"
- **Cause**: Invalid MONGO_URI or network issues
- **Fix**: Test connection string locally
- **Check**: MongoDB Atlas IP whitelist includes 0.0.0.0/0

### "Memory limit exceeded"
- **Cause**: Bot using > 512MB RAM
- **Fix**: Your optimizations should prevent this
- **Check**: Monitor `/health` endpoint memory usage

## 🎯 Next Steps

1. **First**, update environment variables in Render dashboard
2. **Then**, try the fixed render.yaml configuration
3. **If still failing**, switch to background worker deployment
4. **Monitor** deployment logs carefully
5. **Test** health endpoints once deployed

## 📞 Still Having Issues?

If problems persist, check:
1. Render deployment logs (Build & Runtime)
2. Test all endpoints manually after deployment
3. Verify Discord bot permissions in your server
4. Confirm MongoDB Atlas connectivity

The most common issue is missing environment variables - make sure `DISCORD_TOKEN` and `MONGO_URI` are properly set in Render's dashboard.