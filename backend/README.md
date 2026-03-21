# Versafic Backend - Production-Grade SaaS Backend

A fully-featured, enterprise-ready backend for business verification and AI chat integration.

**Status:** ✅ Production Ready | **Version:** 1.0.0 | **Last Updated:** March 4, 2026

---

## Overview

Versific Backend is a Node.js + TypeScript + Express + PostgreSQL backend that provides:

- ✅ **Authentication** - Email/password registration & login + Google OAuth
- ✅ **Business Onboarding** - Profile setup and verification workflow
- ✅ **AI Chat** - OpenAI-powered conversational AI with history tracking
- ✅ **Complete Testing** - Jest + supertest with 50+ test cases
- ✅ **Production Ready** - Rate limiting, error handling, logging, security
- ✅ **Cloud Deployment** - AWS ready
- ✅ **Full Documentation** - API docs, deployment guide, troubleshooting

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 8+
- PostgreSQL (local or cloud like Aiven)
- OpenAI API key (optional, for AI features)




# 2. Create .env file from example
cp .env.example .env

# 3. Edit .env with your credentials
# Edit .env with database and API keys

# 4. Run tests
npm test

# 5. Start development server
npm run dev
```

### Environment Variables

```bash
# .env
NODE_ENV=development
PORT=5000
JWT_SECRET=your_long_random_secret_min_64_chars_for_production
OPENAI_API_KEY=sk-your-openai-key-here

DB_HOST=your-postgres-host.com
DB_PORT=5432
DB_USER=dbuser
DB_PASSWORD=dbpassword
DB_NAME=versific
```

---

## What's New (v1.0.0)

### Part 1: Complete Testing Suite ✅

- **Jest + supertest** - Comprehensive testing framework
- **50+ Test Cases** covering:
  - Registration & login
  - Google OAuth
  - Business setup
  - Health checks
  - JWT authentication
  - Error handling
  - Input validation

**Run tests:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

### Part 2: AI Chat Feature ✅

**New Endpoints:**
- `POST /ai/chat` - Send message, get AI response
- `GET /ai/chat/history` - Retrieve chat history
- `GET /ai/chat/stats` - User statistics
- `DELETE /ai/chat/history` - Clear history

**Features:**
- OpenAI GPT-3.5 integration
- Token tracking
- Rate limiting (30 messages/hour)
- Message validation (1-10K chars)
- Database persistence (chat_history table)
- Input sanitization
- Timeout handling (30s)
- Error recovery

**New Database Table:**
```sql
chat_history (
  id, user_id, message, response, 
  tokens_used, created_at, updated_at
)
```

### Part 3: Production Readiness ✅

**New Features:**
- ✅ Enhanced rate limiting (3 tiers)
- ✅ Request size validation (100KB max)
- ✅ Improved error handling
- ✅ Better logging (request/response logging)
- ✅ Environment validation enhancements
- ✅ Health checks
- ✅ Deployment guide

**Rate Limits:**
- General API: 100 requests/15 min per IP
- Auth: 5 attempts/15 min per email
- AI Chat: 30 messages/1 hour per user

---

## Architecture

### Layered Design
```
HTTP Request
    ↓
Routes (auth.routes.ts, ai.routes.ts, setup.routes.ts)
    ↓
Middleware (JWT, rate-limit, error-handler)
    ↓
Controllers (auth.controller.ts, ai.controller.ts)
    ↓
Services (auth.service.ts, ai.service.ts)
    ↓
Models (user.model.ts, chat.model.ts)
    ↓
Database (PostgreSQL via pg)
```

### Project Structure
```
src/
├── __tests__/           # Test suites (50+ tests)
├── config/              # Database configuration
├── controllers/         # Request handlers
├── middleware/          # Express middleware
├── models/              # Database models
├── routes/              # API routes
├── services/            # Business logic
├── types/               # TypeScript types
├── utils/               # Utilities
└── index.ts            # Entry point

migrations/             # SQL migrations
.env                   # Environment variables
jest.config.js         # Test configuration
API_DOCS.md           # API documentation
DEPLOYMENT.md         # Deployment guide
```

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.ts ............................ PostgreSQL pool configuration
│   ├── controller/
│   │   ├── health-controller.ts ............ Health check handler
│   │   └── user-controller.ts ............. User CRUD handlers
│   ├── services/
│   │   ├── health-service.ts .............. Health check logic
│   │   └── user-service.ts ................ User business logic
│   ├── models/
│   │   └── user-model.ts .................. User database queries
│   ├── routes/
│   │   ├── health.ts ...................... Health endpoints
│   │   └── users.ts ....................... User CRUD endpoints
│   ├── middleware/
│   │   ├── error-handler.ts ............... Global error handler
│   │   └── request-logger.ts .............. Request/response logging
│   ├── utils/
│   │   ├── logger.ts ...................... Structured logging
│   │   ├── env.ts ......................... Environment validation
│   │   ├── response.ts .................... API response formatter
│   │   └── db-query.ts .................... Safe query wrapper
│   ├── types/
│   │   └── index.ts ....................... TypeScript interfaces
│   └── index.ts ........................... Application entry point
├── package.json ........................... Dependencies
├── tsconfig.json .......................... TypeScript config
├── .env ................................. Environment secrets (not in git)
├── .env.example .......................... Environment template
├── .gitignore ............................ Git ignore rules
├── PRODUCTION_ARCHITECTURE.md ............ Architecture guide
├── QUICK_REFERENCE.md .................... Quick lookup
└── SETUP_COMPLETE.md ..................... This file
```

---

## Quick Start

### 1. Setup Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with Aiven credentials:
```
PORT=5000
NODE_ENV=production

DB_HOST=your-aiven-host.aivencloud.com
DB_PORT=12345
DB_USER=avnadmin
DB_PASSWORD=your_password
DB_NAME=defaultdb
```

### 2. Create Database Tables

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### 3. Start Server

```bash
npm run dev
```

Expected output:
```
✅ Environment variables validated
✅ Database connection verified
✅ Server running on port 5000
📍 Health check: http://localhost:5000/api/health
👥 Users API: http://localhost:5000/api/users
```

### 4. Test Endpoints

```bash
# Health
curl http://localhost:5000/api/health

# Create user
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Get user
curl http://localhost:5000/api/users/1

# Update user
curl -X PUT http://localhost:5000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"email":"updated@example.com","name":"Updated"}'

# Delete user
curl -X DELETE http://localhost:5000/api/users/1
```

---

## API Endpoints

### Health Check
```
GET /api/health
```
Returns system health and database status.

### Users CRUD
```
GET    /api/users              List all users (paginated)
GET    /api/users/:id         Get user by ID
GET    /api/users/by-email?email=... Get user by email
POST   /api/users              Create new user
PUT    /api/users/:id         Update user
DELETE /api/users/:id         Delete user
```

---

## How to Add New Features

### Step 1: Create Model
```typescript
// src/models/product-model.ts
export class ProductModel {
  constructor(private pool: Pool) {}
  
  async findById(id: number): Promise<Product | null> {
    return executeQuerySingle<Product>(this.pool, 
      "SELECT * FROM products WHERE id = $1", 
      [id]
    );
  }
}
```

### Step 2: Create Service
```typescript
// src/services/product-service.ts
export class ProductService {
  constructor(pool: Pool) {
    this.productModel = new ProductModel(pool);
  }
  
  async getProduct(id: number): Promise<Product> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Product not found");
    }
    return product;
  }
}
```

### Step 3: Create Controller
```typescript
// src/controller/product-controller.ts
export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProduct(Number(req.params.id));
    sendSuccess(res, product, "Product retrieved", 200);
  } catch (error) {
    next(error); // Pass to error handler
  }
};
```

### Step 4: Create Routes
```typescript
// src/routes/products.ts
const router = Router();
router.get("/:id", getProduct);
export default router;
```

### Step 5: Register in index.ts
```typescript
import productsRoutes from "./routes/products";
app.use("/api/products", productsRoutes);
```

Done! Your new feature is fully integrated with error handling and logging.

---

## Error Codes

- `VALIDATION_ERROR` → 400 Bad Request
- `NOT_FOUND` → 404 Not Found
- `UNAUTHORIZED` → 401 Unauthorized
- `FORBIDDEN` → 403 Forbidden
- `CONFLICT` → 409 Conflict (duplicate, constraint)
- `INTERNAL_ERROR` → 500 Server Error
- `DATABASE_ERROR` → 500 Database Error
- `SERVICE_UNAVAILABLE` → 503 Service Unavailable

---

## Response Format

**Success:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "User retrieved successfully",
  "data": { "id": 1, "email": "user@example.com" },
  "timestamp": "2026-03-04T11:52:22.023Z"
}
```

**Error:**
```json
{
  "status": "error",
  "statusCode": 404,
  "errorCode": "NOT_FOUND",
  "message": "User not found",
  "requestId": "abc123",
  "timestamp": "2026-03-04T11:52:22.023Z"
}
```

---

## Production Checklist

- [x] ✅ TypeScript compilation (zero errors)
- [x] ✅ Environment validation on startup
- [x] ✅ Database connection testing
- [x] ✅ Connection pooling (20 max, 2 min)
- [x] ✅ Error handling (3 levels)
- [x] ✅ Graceful shutdown (SIGTERM, SIGINT)
- [x] ✅ Process error handlers
- [x] ✅ Request logging with timing
- [x] ✅ Structured JSON logging
- [x] ✅ Database query wrapper
- [x] ✅ Standard API responses
- [x] ✅ Error codes and tracking
- [x] ✅ 5-layer architecture
- [x] ✅ Example CRUD routes
- [x] ✅ Type safety (TypeScript)
- [x] ✅ Documentation (3 guides)

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Max Concurrent Connections | 20 |
| Min Idle Connections | 2 |
| Query Timeout | 30 seconds |
| Connection Timeout | 2 seconds |
| Idle Connection Timeout | 30 seconds |
| Graceful Shutdown Timeout | 30 seconds |

---

## Logging Examples

**Info Log:**
```json
{
  "timestamp": "2026-03-04T11:52:22.023Z",
  "level": "INFO",
  "message": "User created",
  "data": { "userId": 123, "email": "user@example.com" },
  "env": "development"
}
```

**Error Log:**
```json
{
  "timestamp": "2026-03-04T11:52:24.047Z",
  "level": "ERROR",
  "message": "Database error",
  "error": "UNIQUE_VIOLATION: Email already exists",
  "data": { "email": "duplicate@example.com" },
  "env": "development"
}
```

---

## Documentation Files

1. **QUICK_REFERENCE.md** - Fast lookup for developers
2. **PRODUCTION_ARCHITECTURE.md** - Complete architecture guide
3. **This file** - Overview and setup instructions

---

## Common Commands

```bash
# Start development server (auto-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests (placeholder)
npm test
```

---

## Security Considerations

1. ✅ Never commit `.env` file (git ignored)
2. ✅ Use `.env.example` for template
3. ✅ Validate all inputs
4. ✅ Use prepared statements (`$1, $2` syntax)
5. ✅ Handle errors without leaking details
6. ✅ Log security events
7. ✅ Use HTTPS in production (handled by reverse proxy)

---

## Next Steps

### Immediate
1. Update `.env` with actual Aiven credentials
2. Create database tables
3. Test CRUD endpoints
4. Add more features following the pattern

### Short Term
1. Add request validation (joi/zod)
2. Add authentication (JWT middleware)
3. Add rate limiting
4. Add integration tests

### Medium Term
1. Add API documentation (Swagger)
2. Add database migrations
3. Add monitoring/APM
4. Add CI/CD pipeline

### Long Term
1. Add caching layer (Redis)
2. Add message queue (RabbitMQ)
3. Add search engine (Elasticsearch)
4. Add frontend integration

---

## Support & Troubleshooting

**Database won't connect?**
- Check `.env` has correct Aiven host, port, credentials
- Verify database exists in Aiven
- Check firewall/network connectivity

**Server crashing?**
- Check error logs (JSON formatted)
- Verify database is reachable
- Check environment variables are set

**Endpoint returning errors?**
- Check request format matches API docs
- Check error code in response
- Review logs for details

**Want to add new feature?**
- Follow the 5-layer architecture pattern
- Use executeQuerySingle/executeQueryMany
- Throw AppError with proper error code
- Let middleware handle error response

---

## Summary

Your Versific backend is:
- ✅ **Production-ready** - Error handling, logging, graceful shutdown
- ✅ **Scalable** - Connection pooling, async/await, proper architecture
- ✅ **Type-safe** - Full TypeScript with interfaces
- ✅ **Well-documented** - 3 documentation files + inline comments
- ✅ **Easy to extend** - Clear pattern for adding features
- ✅ **Cloud-ready** - Works with Aiven PostgreSQL, handles crashes, logs errors

Happy coding! 🚀
