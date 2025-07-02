# 🚀 Render Deployment & UptimeRobot Optimization Guide

## 🎯 Overview
This guide will help you deploy your optimized One Piece Discord Bot to Render's free tier with UptimeRobot monitoring, eliminating crashes and message duplication issues.

## 🔧 Optimizations Implemented

### **Message Duplication Prevention**
- ✅ **Interaction Deduplication**: Prevents duplicate command processing
- ✅ **Message ID Tracking**: Eliminates duplicate message handling
- ✅ **Memory-Safe Cleanup**: Automatic cleanup every 5 minutes

### **Crash Prevention**
- ✅ **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- ✅ **Error Handling**: Comprehensive error catching and recovery
- ✅ **Memory Monitoring**: Automatic garbage collection on high usage
- ✅ **Connection Retry**: Database reconnection with exponential backoff

### **Render Free Tier Optimization**
- ✅ **Memory Limits**: Optimized for 512MB RAM limit
- ✅ **Cold Start Handling**: Immediate keep-alive server startup
- ✅ **Connection Pooling**: Limited MongoDB connections (5 max)
- ✅ **Health Checks**: Multiple endpoints for monitoring

---

## 📋 Pre-Deployment Checklist

### **1. Environment Variables**
Make sure you have these ready:
```bash
DISCORD_TOKEN=your_discord_bot_token
MONGO_URI=your_mongodb_connection_string
NODE_ENV=production
```

### **2. MongoDB Setup**
- Use MongoDB Atlas (free tier: 512MB storage)
- Whitelist Render's IP ranges or use `0.0.0.0/0` (not recommended for production)
- Create a database user with read/write permissions

### **3. Discord Bot Setup**
- Bot must have necessary permissions in your Discord server
- Bot token must be valid and active

---

## 🚀 Render Deployment Steps

### **Method 1: Direct Git Deployment (Recommended)**

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Render optimization complete"
   git push origin main
   ```

2. **Create Render Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the repository and main branch

3. **Configure Service**
   ```yaml
   Name: one-piece-bot
   Environment: Node
   Build Command: npm install --production
   Start Command: npm run start:render
   ```

4. **Set Environment Variables**
   ```
   NODE_ENV = production
   DISCORD_TOKEN = your_bot_token
   MONGO_URI = your_mongodb_uri
   ```

5. **Advanced Settings**
   - Auto-Deploy: Yes
   - Health Check Path: `/health`

### **Method 2: Using render.yaml (Auto-Configuration)**

1. **Deploy with render.yaml**
   - The included `render.yaml` file will auto-configure your service
   - Just connect your repo and Render will use the configuration automatically

---

## 🔄 UptimeRobot Setup

### **1. Create UptimeRobot Account**
- Sign up at [UptimeRobot](https://uptimerobot.com)
- Free plan allows 50 monitors

### **2. Configure Monitor**
```
Monitor Type: HTTP(s)
Friendly Name: One Piece Bot
URL: https://your-app-name.onrender.com/health
Monitoring Interval: 5 minutes
```

### **3. Advanced Settings**
```
HTTP Method: GET
Expected Status Code: 200
Timeout: 30 seconds
```

### **4. Alert Contacts**
- Add your email for downtime notifications
- Optional: Add Discord webhook for alerts

---

## 📊 Health Check Endpoints

Your bot provides multiple monitoring endpoints:

### **Main Health Check** (Use for UptimeRobot)
```
GET https://your-app.onrender.com/health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-02T10:30:00.000Z",
  "uptime": { "seconds": 3600, "human": "1h 0m 0s" },
  "memory": { "rss": "256MB", "heapUsed": "128MB" },
  "requests": 1500,
  "environment": "production"
}
```

### **Quick Ping**
```
GET https://your-app.onrender.com/ping
```

### **Detailed Status**
```
GET https://your-app.onrender.com/status
```

### **Metrics (Prometheus Format)**
```
GET https://your-app.onrender.com/metrics
```

---

## ⚡ Performance Optimizations

### **Memory Management**
- **Memory Limit**: 400MB (safe buffer for 512MB limit)
- **Garbage Collection**: Automatic GC when memory > 400MB
- **Connection Pooling**: Max 5 MongoDB connections
- **Cache Cleanup**: Interaction cache cleared every 5 minutes

### **Cold Start Mitigation**
- **Immediate Server Start**: Keep-alive server starts before Discord connection
- **Health Check Ready**: `/health` endpoint available immediately
- **Retry Logic**: Automatic reconnection for failed connections

### **Error Recovery**
- **Graceful Degradation**: Bot continues running on non-critical errors
- **Auto-Cleanup**: Battle states and caches cleaned automatically
- **Memory Monitoring**: Proactive memory management

---

## 🐛 Troubleshooting

### **Common Issues & Solutions**

#### **1. Bot Going Offline**
```bash
# Check logs in Render dashboard
# Look for memory issues or connection problems
```
**Solution**: Memory usage too high
- Check `/health` endpoint for memory status
- Force garbage collection via `/gc` endpoint
- Review commands for memory leaks

#### **2. Message Duplication**
```bash
# Check for duplicate interaction IDs in logs
```
**Solution**: Already implemented in optimization
- Interaction deduplication active
- Message ID tracking prevents duplicates

#### **3. Database Connection Issues**
```bash
# Check MongoDB connection string
# Verify IP whitelist settings
```
**Solution**: 
- Use MongoDB Atlas connection string
- Whitelist Render IP ranges
- Check connection pool settings

#### **4. Health Check Failing**
```bash
# Test health endpoint manually
curl https://your-app.onrender.com/health
```
**Solution**:
- Verify endpoint returns 200 status
- Check memory usage isn't critical (>500MB)
- Review server logs for errors

---

## 📈 Monitoring & Maintenance

### **Daily Checks**
- ✅ UptimeRobot status (should be 99%+ uptime)
- ✅ Memory usage via `/health` endpoint
- ✅ Response times under 1000ms

### **Weekly Maintenance**
- 🔄 Review Render logs for warnings
- 🔄 Check MongoDB Atlas metrics
- 🔄 Update dependencies if needed

### **Monthly Reviews**
- 📊 Analyze uptime statistics
- 📊 Review memory usage trends
- 📊 Check for any new Discord.js updates

---

## 🚨 Emergency Recovery

### **If Bot Goes Down**
1. **Check UptimeRobot alerts**
2. **Visit Render dashboard logs**
3. **Check health endpoint manually**
4. **Force restart if needed** (Render dashboard → Manual Deploy)

### **If Memory Critical**
1. **Visit `/health` endpoint**
2. **Force garbage collection** via `POST /gc`
3. **Restart service** if memory doesn't decrease

### **If Database Issues**
1. **Check MongoDB Atlas status**
2. **Verify connection string**
3. **Check IP whitelist**
4. **Restart bot service**

---

## 🎉 Success Metrics

After deployment, you should see:
- ✅ **99%+ Uptime** (UptimeRobot)
- ✅ **No Message Duplication**
- ✅ **Memory Usage < 400MB** consistently
- ✅ **Response Times < 500ms**
- ✅ **Zero Unexpected Crashes**

---

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Review Render dashboard logs
3. Test health endpoints manually
4. Check UptimeRobot status page

The optimizations implemented should resolve the vast majority of issues you were experiencing with message duplication and crashes on Render's free tier.

---

**✨ Your bot is now optimized for stable, reliable operation on Render with UptimeRobot monitoring!**