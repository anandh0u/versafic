# Versafic Backend - Deployment Checklist

**Project Version:** 1.0.0  
**Last Updated:** March 15, 2026  
**Status:** ✅ Production Ready

---

## Pre-Deployment Verification ✅

- [x] TypeScript compiles without errors
- [x] All unit tests pass
- [x] Production build created (`npm run build`)
- [x] dependencies installed (`npm install`)
- [x] Environment variables documented (.env.example)
- [x] Database migrations created
- [x] API endpoints tested and working
- [x] Twilio integration configured
- [x] Authentication (JWT) implemented
- [x] Error handling and logging in place
- [x] CORS configured
- [x] Rate limiting enabled
- [x] Security headers (Helmet) enabled

---

## Environment Variables Setup

Required environment variables (copy to production .env):

```env
# Node Environment
NODE_ENV=production
PORT=5000

# JWT Authentication
JWT_SECRET=<change_in_production_min_32_chars>
JWT_REFRESH_SECRET=<change_in_production_min_32_chars>

# Database (PostgreSQL)
DB_HOST=<your_db_host>
DB_PORT=5432
DB_USER=<your_db_user>
DB_PASSWORD=<your_db_password>
DB_NAME=versafic

# AI Services
OPENAI_API_KEY=<your_openai_key>
SARVAM_API_KEY=<your_sarvam_key>

# Google OAuth (optional)
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>
GOOGLE_CALLBACK_URL=<your_callback_url>

# Twilio
TWILIO_ACCOUNT_SID=<your_twilio_sid>
TWILIO_AUTH_TOKEN=<your_twilio_token>
TWILIO_PHONE_NUMBER=<your_twilio_number>
PUBLIC_BASE_URL=<your_production_domain>

# Email (optional)
SMTP_HOST=<your_smtp_host>
SMTP_PORT=587
SMTP_USER=<your_email>
SMTP_PASSWORD=<your_password>
SMTP_FROM=noreply@versafic.com
```

---

## Database Setup

1. **Create Database:**
   ```sql
   CREATE DATABASE versafic;
   ```

2. **Run Migrations:**
   ```bash
   npm run db:init
   ```

3. **Verify Tables:**
   - `users` - User accounts
   - `business_profiles` - Business information
   - `chat_history` - Chat conversations
   - `call_recordings` - Twilio call data

---

## Deployment Steps

### Local Testing
```bash
# Install dependencies
npm install

# Build project
npm run build

# Start production server
node dist/index.js

# Or development with auto-reload
npm run dev
```

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

### Production Server Deployment

1. **Upload files to server:**
   ```bash
   scp -r dist/ migrations/ package.json .env <user>@<host>:/app/
   npm install --production
   ```

2. **Start with PM2:**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name "versafic-api"
   pm2 save
   pm2 startup
   ```

3. **Configure Reverse Proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable HTTPS (Let's Encrypt):**
   ```bash
   sudo certbot certonly --standalone -d your-domain.com
   ```

---

## API Endpoints Summary

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user

### Business Management
- `GET /business/profile` - Get business profile
- `PUT /business/profile` - Update business profile
- `POST /business/setup` - Setup business account

### AI Features
- `POST /ai/chat` - Chat with AI
- `GET /ai/conversation/:id` - Get conversation history

### Voice/Calls
- `POST /call/start` - Initiate call
- `POST /call/recording` - Handle recording webhook
- `GET /call/recordings` - Get call recordings

### Health
- `GET /health` - System health check
- `GET /` - API info

---

## Monitoring & Maintenance

### Logs
- Real-time logs: Check PM2 dashboard
- Winston logger enabled for all operations
- Log rotation recommended for production

### Backup Strategy
- Daily automated database backups
- Keep migration files version controlled
- Backup .env file separately (NOT in git)

### Scaling Considerations
- Implement Redis for caching
- Use connection pooling for database
- Consider load balancing for multiple instances
- Monitor CPU and memory usage

---

## Security Checklist

- [x] HTTPS/TLS enabled
- [x] CORS properly configured
- [x] Rate limiting implemented
- [x] JWT tokens secure
- [x] Password hashing (bcrypt)
- [x] Input validation
- [x] SQL injection prevention (parameterized queries)
- [x] XSS protection (Helmet)
- [x] CSRF tokens ready
- [x] Environment variables not exposed
- [x] SQL migrations tracked
- [x] Error messages don't leak sensitive info

---

## Performance Targets

- API Response Time: < 500ms
- Database Queries: < 100ms
- Throughput: 1000+ req/sec
- Uptime Target: 99.9%
- Memory Usage: < 500MB
- CPU Usage: < 70%

---

## Post-Deployment Verification

1. **Test all endpoints:**
   ```bash
   npm run test
   ```

2. **Load testing (optional):**
   ```bash
   npm install -g artillery
   artillery quick -c 10 -n 100 http://your-domain.com/health
   ```

3. **Monitor logs for errors**

4. **Setup alerts for critical errors**

5. **Document any issues for future reference**

---

## Support & Troubleshooting

If experiencing issues:
1. Check logs: `pm2 logs versafic-api`
2. Verify environment variables: `cat .env`
3. Test database connection: Check logs for "Database connected" message
4. Restart service: `pm2 restart versafic-api`

---

**Deployment completed successfully!** 🚀  
For issues, contact: support@versafic.com
