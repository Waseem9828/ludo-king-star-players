# Ludo Chips (New Project)

Foundation-only scaffold for a new virtual-coins Ludo/gaming website. This is a
separate, standalone project — not connected to any previous project, database,
or credentials.

## Structure

```
frontend/   React + Vite app (placeholder pages, routing)
backend/    Node.js + Express API (placeholder routes, auth/role architecture)
```

## Status

Only the project foundation has been built:
- Routing and placeholder pages/components on the frontend
- Placeholder route structure, middleware, and DB config on the backend
- No authentication, payments, game logic, or real data yet

## Local development

### Backend

```
cd backend
npm install
copy .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm run dev
```

Runs on http://localhost:5000 (health check at `/api/health`).

### Frontend

```
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173.
