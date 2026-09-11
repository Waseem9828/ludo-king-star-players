# Mewat Play Chips - 10,000+ Concurrent User Scalability Plan

## Overview
This plan outlines the exact architectural upgrades required to make the existing **Mewat Play Chips** MongoDB & Node.js backend capable of seamlessly handling **10,000+ concurrent users** without requiring a database migration.

---

## 🏗️ Architecture Blueprint

```text
                                  ┌────────────────────────┐
                                  │   Next.js Frontend     │
                                  └───────────┬────────────┘
                                              │
                                   HTTP / WebSocket (Socket.io)
                                              │
                                              ▼
                                  ┌────────────────────────┐
                                  │   Node.js / Express    │
                                  │      API Cluster       │
                                  └─────┬───────────┬──────┘
                                        │           │
                     ┌──────────────────┘           └──────────────────┐
                     ▼                                                 ▼
          ┌─────────────────────┐                          ┌─────────────────────┐
          │     Redis Cache     │                          │    MongoDB Atlas    │
          ├─────────────────────┤                          ├─────────────────────┤
          │ - Active Lobbies    │                          │ - User & Wallet     │
          │ - Leaderboards      │                          │ - Coin Ledger       │
          │ - Rate Limit Store  │                          │ - Transactions      │
          │ - Socket.io Adapter │                          │ - Match History     │
          └─────────────────────┘                          └─────────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │   BullMQ Workers    │
          ├─────────────────────┤
          │ - Async OTP SMS     │
          │ - Match Expiry      │
          │ - Notifications     │
          └─────────────────────┘
```

---

## 🚀 Key Action Items

### 1. MongoDB Query Optimization & Compound Indexes
- Audit all schemas (`Match`, `Transaction`, `User`, `Wallet`, `Notification`, `PracticeGame`).
- Add high-performance compound indexes:
  - `Match`: `{ status: 1, createdAt: -1 }`, `{ createdBy: 1, status: 1 }`, `{ joinedBy: 1, status: 1 }`
  - `Transaction`: `{ userId: 1, createdAt: -1 }`, `{ type: 1, status: 1 }`
  - `User`: `{ phone: 1 }`, `{ referralCode: 1 }`
  - `Notification`: `{ userId: 1, read: 1, createdAt: -1 }`
- Apply `.lean()` on read-only queries across matches, leaderboard, banners, settings, and transaction history to bypass Mongoose document instantiation overhead (~70% memory reduction).

### 2. Cursor-Based Pagination Implementation
- Replace offset/skip-based pagination (`.skip(offset).limit(limit)`) with **Cursor Pagination** using `_id` / `createdAt` for:
  - Match history (`/api/history/matches`)
  - Transaction history (`/api/history/transactions`)
  - Admin user lists & audit logs (`/api/admin/logs`, `/api/admin/users`)
- Build reusable utility `utils/cursorPagination.js`.

### 3. Redis Caching Layer (With Fail-Soft Fallback)
- Create `config/redis.js` supporting both local/managed Redis instances with automatic reconnect & fail-soft fallback (if Redis is unreachable, app seamlessly falls back to MongoDB).
- Implement Redis cache for:
  - **Active Lobbies**: `matches:open` cached with 3-second TTL / invalidation on challenge create/join/cancel.
  - **Leaderboards**: Top winners cached in Redis with 60-second TTL.
  - **Global Rate Limiting**: Distributed IP rate-limiting via `rate-limit-redis`.

### 4. Real-Time WebSockets (Socket.io + Redis Adapter)
- Integrate `Socket.io` into `server.js` with optional Redis Adapter (`@socket.io/redis-adapter`) for multi-process load balancing.
- Emit instant events for room code updates, challenge status changes, match result approvals, and wallet balance changes instead of constant HTTP polling.

### 5. BullMQ Workers for Background Async Tasks
- Create queue system for background jobs (`queues/` & `workers/`):
  - **OTP Delivery Queue**: Offload SMS/gateway calls from HTTP request threads.
  - **Match Cleanup Queue**: Auto-cancel open challenges unjoined after timeout (e.g. 5 minutes).
  - **Notification Push Queue**: Batch user notifications.

---

## 🛠️ Verification & Load Testing Plan
1. **Index Verification**: Run `explain("executionStats")` on key MongoDB queries to verify index coverage (zero `COLLSCAN`).
2. **Redis Failover Test**: Simulate Redis server crash to ensure zero downtime (graceful database fallback).
3. **Concurrent Load Simulation**: Run load test targeting 10,000 simulated users across lobby listing, wallet query, and challenge creation.
