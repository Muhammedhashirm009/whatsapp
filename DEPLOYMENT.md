# Deployment Guide for WhatsApp Bot (Koyeb Free Tier)

This application is optimized to run on **Koyeb's free tier** (512MB RAM, 2GB disk) by using the lightweight Baileys library instead of Chromium-based solutions.

## Architecture Overview

- **WhatsApp Library**: Baileys (@whiskeysockets/baileys)
  - WebSocket-based WhatsApp Web API
  - No browser required
  - Memory usage: ~100-150MB
  
- **Backend**: Express.js + Socket.IO
  - REST API for sending messages
  - WebSocket for real-time updates
  - Memory usage: ~50-100MB

- **Frontend**: React + Vite
  - QR code authentication interface
  - Message dashboard
  - Contact management

**Total Expected Memory**: ~150-250MB (well within 512MB limit)

## Prerequisites

1. Koyeb account (free tier)
2. GitHub account (for repository connection)
3. WhatsApp account for testing

## Deployment Steps

### 1. Push Code to GitHub

```bash
git add .
git commit -m "Optimized for Koyeb deployment"
git push origin main
```

### 2. Deploy on Koyeb

1. **Sign in to Koyeb**: https://app.koyeb.com/
2. **Create New App**:
   - Click "Create App"
   - Select "GitHub" as deployment method
   - Connect your repository
   - Select branch: `main`

3. **Configure Build**:
   - **Builder**: Docker
   - **Dockerfile path**: `Dockerfile` (default)

4. **Configure Instance**:
   - **Instance type**: Nano (512MB RAM, 0.1 CPU)
   - **Regions**: Choose closest to your location
   - **Scaling**: 1 instance (free tier)

5. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=5000
   ```

6. **Health Check** (optional but recommended):
   - Path: `/api/session`
   - Port: 5000
   - Initial delay: 60s
   - Period: 30s

7. **Deploy**: Click "Deploy"

### 3. Wait for Deployment

The deployment process takes approximately 3-5 minutes:
1. Building Docker image (~2 mins)
2. Starting container (~1 min)
3. Health checks (~1 min)

### 4. Access Your Application

Once deployed, Koyeb provides a URL like:
```
https://your-app-name-your-org.koyeb.app
```

### 5. Connect WhatsApp

1. Open the provided URL in your browser
2. Scan the QR code with WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code

3. Once connected, your WhatsApp session persists in container storage

## Important Notes

### Session Persistence

- **Development**: Sessions are stored in `.sessions/baileys/` directory
- **Production**: Sessions persist in container filesystem
- **Warning**: If container restarts, you'll need to scan QR code again
- **Solution**: For persistent sessions, consider adding volume storage (paid feature)

### Memory Management

The application is optimized for low memory:
- Baileys uses WebSocket (no browser)
- Minimal dependencies
- Alpine Linux base image (~50MB)

### Limitations on Free Tier

- **RAM**: 512MB (sufficient for this app)
- **Disk**: 2GB (sufficient for sessions and media)
- **Sleep**: App may sleep after inactivity (requires wake-up)
- **Sessions**: Lost on container restart (need to re-authenticate)

### Monitoring

Check logs in Koyeb dashboard:
1. Go to your app
2. Click "Logs" tab
3. Look for:
   - "Baileys WhatsApp client initialized"
   - "WhatsApp connected successfully"
   - "Loaded X contacts"

## Troubleshooting

### App won't start

**Check logs for**:
- Port conflicts (ensure PORT=5000)
- Memory issues (shouldn't happen with Baileys)
- Build errors

**Solution**: Review Koyeb logs and ensure Dockerfile builds correctly

### QR Code not appearing

**Check**:
- Frontend is loading (visit app URL)
- Backend is connected (check `/api/session` endpoint)
- WebSocket connection is active

**Solution**: Hard refresh browser (Ctrl+Shift+R)

### WhatsApp disconnects frequently

**Possible causes**:
- Container restarts
- Network issues
- WhatsApp rate limiting

**Solution**: 
- Check Koyeb instance status
- Reduce message frequency
- Add auto-reconnect logic (already included)

### Out of Memory errors

**Unlikely with Baileys**, but if it happens:
- Check logs for memory usage
- Consider upgrading to Eco plan (1GB RAM)

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Access at http://localhost:5000
```

## Production Build (Local Testing)

```bash
# Build the app
npm run build

# Run production server
npm start
```

## Docker Build (Local Testing)

```bash
# Build image
docker build -t whatsapp-bot .

# Run container
docker run -p 5000:5000 whatsapp-bot

# Access at http://localhost:5000
```

## Cost Estimate

**Koyeb Free Tier**:
- ✅ Suitable for this application
- ✅ 512MB RAM is sufficient
- ✅ 2GB disk is sufficient
- ⚠️ Sessions lost on restart

**Koyeb Eco ($5/month)**:
- 1GB RAM
- Persistent volumes available
- Better for production use

## Security Considerations

1. **API Keys**: Store in environment variables
2. **Rate Limiting**: Implement if exposing publicly
3. **Authentication**: Add auth layer for production
4. **HTTPS**: Koyeb provides automatic SSL

## Next Steps

1. ✅ Deploy to Koyeb
2. ✅ Connect WhatsApp
3. ⚠️ Add persistent volume (optional, paid)
4. ⚠️ Add authentication (recommended for production)
5. ⚠️ Set up monitoring/alerts

## Support

- **Baileys Docs**: https://github.com/WhiskeySockets/Baileys
- **Koyeb Docs**: https://www.koyeb.com/docs
- **Issues**: Check GitHub repository issues

---

**Memory Comparison**:
- Old (whatsapp-web.js + Chromium): ~500-650MB ❌ Exceeds free tier
- New (Baileys WebSocket): ~150-250MB ✅ Fits free tier perfectly
