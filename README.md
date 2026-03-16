# Poll App 🗳️

A real-time polling application built with React and Cloudflare Workers.

## 🚀 Live Demo

- **Frontend:** https://poll-app.pages.dev
- **Backend:** https://poll-app-worker.urlcut01.workers.dev

## 🛠️ Tech Stack

**Frontend**
- React 18 + Vite
- React Router DOM
- CSS Modules
- Google Fonts (DM Sans + DM Serif Display)

**Backend**
- Cloudflare Workers
- Cloudflare Durable Objects (real-time state)
- Cloudflare KV (poll storage)

**Deployment**
- Cloudflare Pages (frontend)
- Cloudflare Workers (backend)

## ✨ Features

- ✅ Create polls with up to 6 options
- ✅ Real-time vote updates (polling every 2s)
- ✅ One vote per user per poll (localStorage)
- ✅ Share poll via full URL or Poll ID
- ✅ Join existing poll by ID
- ✅ Responsive design (mobile + tablet + desktop)
- ✅ Beautiful dark UI with animations

## 🏗️ Architecture

```
Frontend (React)
      ↓
Cloudflare Worker (routing + CORS)
      ↓
Durable Object (stateful vote counting + broadcast)
      ↓
KV Storage (poll data persistence)
```

**Why Durable Objects?**
Cloudflare Workers are stateless by default. Durable Objects provide a single stateful instance per poll — all users connect to the same "room" ensuring consistent vote counts across concurrent requests.

**Why KV?**
Simple key-value storage is ideal for poll data where the key is `pollId` and value is JSON. No complex queries needed. KV handles read-heavy workloads efficiently with edge caching.

## 📁 Project Structure

```
poll-app/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx        # Create / join poll
│   │   │   ├── Home.css
│   │   │   ├── Poll.jsx        # Vote + live results
│   │   │   └── Poll.css
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js # Polling hook (2s interval)
│   │   │   └── useWindowSize.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── vite.config.js
└── backend/
    ├── src/
    │   ├── index.js            # Worker entrypoint + routing
    │   └── PollRoom.js         # Durable Object class
    └── wrangler.toml
```

## 🏃 Local Development

**Prerequisites:** Node.js 18+, Wrangler CLI

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Run both servers
cd .. && npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:8787
```

## 📦 Deploy

```bash
# Deploy backend
cd backend
npx wrangler kv namespace create "POLLS_KV"
# Update wrangler.toml with returned KV id
npx wrangler deploy

# Deploy frontend
cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name poll-app
```

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/polls` | Create new poll |
| GET | `/api/polls/:id` | Get poll data |
| POST | `/api/polls/:id/room/vote` | Submit vote |
| GET | `/api/polls/:id/room/websocket` | WebSocket upgrade |
