# 🏠 מטלות הבית — Family Chores Tracker

A Hebrew-language, RTL chore tracking app for families with two kids. Kids earn points for completing chores, working toward shared weekly and monthly goals with fun rewards.

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React 18 + Vite + TypeScript            |
| Backend  | Node.js + Express + TypeScript          |
| Database | PostgreSQL (hosted on Render)           |
| Deploy   | Frontend → Vercel · Backend → Render    |

---

## 📁 Project Structure

```
chores/
├── client/          # React frontend
│   ├── src/
│   │   ├── api/         # API fetch helpers
│   │   ├── components/  # Screen components
│   │   ├── context/     # Global state (AppContext)
│   │   ├── hooks/       # Custom hooks
│   │   └── types/       # Shared TypeScript types
│   └── ...
└── server/          # Express backend
    ├── src/
    │   ├── routes/      # Express route handlers
    │   ├── db.ts        # PostgreSQL pool
    │   ├── migrate.ts   # Auto-migration runner
    │   └── index.ts     # App entry point
    └── migrations/
        └── 001_initial.sql
```

---

## 🖥️ Local Development

### 1. Prerequisites

- Node.js 18+
- PostgreSQL (local or remote)

### 2. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/chores.git
cd chores

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 3. Configure environment variables

**Server** — create `server/.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/chores_db
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

**Client** — create `client/.env`:
```env
VITE_API_URL=http://localhost:3001/api
```

### 4. Create the local database

```bash
createdb chores_db
```

The app will auto-run migrations on first start.

### 5. Start both servers

In one terminal:
```bash
cd server && npm run dev
```

In another terminal:
```bash
cd client && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🐘 Database Setup on Render

1. Go to [render.com](https://render.com) → **New → PostgreSQL**
2. Name it `chores-db`, choose a free plan
3. After creation, copy the **External Database URL**
4. Use this as your `DATABASE_URL` environment variable

---

## 🚀 Backend Deployment (Render)

1. Push this repo to GitHub
2. Go to Render → **New → Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root directory:** `server`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
5. Environment variables:
   ```
   DATABASE_URL=<your Render PostgreSQL URL>
   NODE_ENV=production
   CLIENT_URL=https://your-app.vercel.app
   PORT=10000
   ```
6. Deploy — migrations run automatically on startup

---

## ▲ Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Settings:
   - **Framework preset:** Vite
   - **Root directory:** `client`
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Environment variables:
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```
5. Deploy

---

## 🐙 GitHub Repository Setup

```bash
cd /c/Users/user/chores
git init
git add .
git commit -m "Initial commit: family chores tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chores.git
git push -u origin main
```

---

## 📱 Features

| Feature | Description |
|---------|-------------|
| 🏠 Dashboard | Both kids' weekly & monthly points + shared progress bars |
| ✅ Log Chore | 3-step flow: pick child → pick chore → confirm → celebration animation |
| 📜 History | Filterable log by child, week, month |
| 🏆 Achievements | Badges: "שבוע מושלם", "חודש מושלם", "עמל רב" |
| ⚙️ Admin | PIN-protected: set goals, manage chores & kids, change PIN, reset periods |

---

## 🔐 Admin Access

Default PIN: **1234**

Change it in the app under Settings → אבטחה.

---

## 🎯 Chore Points

| Difficulty | Points |
|-----------|--------|
| קל (Easy)  | 5      |
| בינוני (Medium) | 15 |
| קשה (Hard) | 30     |

---

## 🗃️ Database Schema

| Table | Purpose |
|-------|---------|
| `family_members` | Kid profiles (name, emoji) |
| `chores` | Chore list with difficulty & points |
| `chore_logs` | Each completed chore entry |
| `goals` | Weekly/monthly point targets |
| `goal_periods` | Period achievement tracking & reward choices |
| `achievements` | Earned badges |
| `admin_config` | Admin PIN and settings |
