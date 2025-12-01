# Koyeb Deployment Guide

## Prerequisites
- External MySQL database (e.g., 82.25.121.49)
- Database credentials
- Koyeb account

## Step 1: Prepare Environment Variables

Create a `.env` file with the following variables:

```env
# Database Configuration
DB_HOST=82.25.121.49
DB_NAME=whatsapp_bot
DB_USER=your_database_user
DB_PASSWORD=your_database_password
PORT=5000
NODE_ENV=production
```

## Step 2: Deploy to Koyeb

### Using Git
1. Push your code to GitHub
2. Connect your GitHub repository to Koyeb
3. Set Build Command: `node build.mjs`
4. Set Run Command: `npm start`

### Environment Variables in Koyeb
1. Go to your Koyeb app settings
2. Add environment variables:
   - `DB_HOST`: Your MySQL host
   - `DB_NAME`: Your database name
   - `DB_USER`: Database user
   - `DB_PASSWORD`: Database password
   - `NODE_ENV`: production
   - `PORT`: 5000
   - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`: true
   - `PUPPETEER_SKIP_DOWNLOAD`: true

## Step 3: Database Setup
The application will automatically create required tables on first run:
- `whatsapp_session` - Stores WhatsApp connection status
- `contacts` - Stores WhatsApp contacts
- `messages` - Stores message history

## Step 4: Important Configuration

### Browser Configuration
The app uses **Baileys** (WebSocket-based WhatsApp), not browser automation. Chromium is not needed.

**Configuration Files:**
- `.puppeteerrc.cjs` - Disables Chromium download during build
- Environment variables - Prevent Puppeteer attempts at runtime

**If you see Puppeteer errors:**
These are safe to ignore. The app continues working. If you want to eliminate them:
1. Ensure `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` is set in Koyeb environment
2. Rebuild your instance on Koyeb

## Step 5: Access Your App
Once deployed, your WhatsApp Bot will be available at your Koyeb app URL.

### Default Credentials
- Username: `admin`
- Password: `admin123`

⚠️ **Important:** Change the default password in production by modifying `client/src/lib/auth-context.tsx`

## Troubleshooting

### Database Connection Error
- Verify your database is accessible from Koyeb
- Check firewall rules allow connections from Koyeb's IP range
- Ensure credentials are correct

### QR Code Not Appearing
- Check browser console for WebSocket connection errors
- Verify Socket.io is not blocked by firewall
- Ensure `/ws` path is accessible

### Session Not Persisting
- Verify database tables were created successfully
- Check database credentials have proper permissions
- Ensure database server is running

## Production Checklist
- [ ] Change default authentication password
- [ ] Update database credentials
- [ ] Test WhatsApp login flow
- [ ] Verify message sending works
- [ ] Test API endpoints with external tools
- [ ] Monitor application logs for errors
- [ ] Set up backup strategy for database
