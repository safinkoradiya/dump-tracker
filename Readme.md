# Dump Policy Tracker — Full Stack

Insurance operations tool for tracking dump policy discrepancies.

## Project Structure

```
dump-tracker/
├── backend/          Node.js + Express API
├── frontend/         React + Vite UI
└── package.json      Root scripts (run both together)
```

---

## Local Development (First Time)

### 1. Prerequisites
- Node.js 18+
- A PostgreSQL database (local or cloud)

### 2. Install dependencies
```bash
npm run install:all
```

### 3. Set up backend environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set your DATABASE_URL
```

### 4. Run database migrations (creates tables)
```bash
npm run db:migrate
```

### 5. Start both servers
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

---

## Deploy to Railway (Recommended — Free Tier Available)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/dump-tracker.git
git push -u origin main
```

### Step 2 — Create PostgreSQL on Railway
1. Go to https://railway.app and sign in
2. New Project → Add a Service → Database → PostgreSQL
3. Copy the `DATABASE_URL` from the Connect tab

### Step 3 — Deploy Backend on Railway
1. New Service → GitHub Repo → select your repo
2. Set Root Directory: `backend`
3. Add environment variables:
   ```
   DATABASE_URL    = <paste from step 2>
   NODE_ENV        = production
   FRONTEND_URL    = https://YOUR-FRONTEND.onrender.com   (add after frontend is deployed)
   PORT            = 3001
   ```
4. Start command: `npm start`
5. After first deploy, run migration once:
   Railway → your backend service → Settings → Deploy → Add a one-off command:
   `node src/db/migrate.js`

### Step 4 — Deploy Frontend on Render (Free Static Site)
1. Go to https://render.com → New → Static Site
2. Connect your GitHub repo
3. Settings:
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
4. Add environment variable:
   ```
   VITE_API_URL = https://YOUR-BACKEND.railway.app
   ```
5. Deploy

### Step 5 — Connect them
- Copy your frontend URL → go back to Railway backend → update `FRONTEND_URL`
- Redeploy backend

---

## Alternative: Deploy Both on Render

### Backend (Web Service)
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: same as Railway step 3

### Database
- Render → New → PostgreSQL (free tier available)

### Frontend (Static Site)
- Same as step 4 above

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/dumps | List all dumps (with progress) |
| POST | /api/dumps | Create a dump |
| GET | /api/dumps/:id | Get single dump |
| PATCH | /api/dumps/:id | Update dump |
| DELETE | /api/dumps/:id | Delete dump (cascades) |
| GET | /api/policies | List policies (filter: dump_id, rm_name, status, company, bucket, search) |
| POST | /api/policies | Add single policy |
| PATCH | /api/policies/:id | Update policy fields |
| POST | /api/policies/import | Upload Excel/CSV (multipart: file + dump_id) |
| GET | /api/stats | Dashboard counts |
| GET | /api/stats/buckets | Aging bucket counts |
| GET | /api/stats/rm | Per-RM breakdown |

---

## Excel Import Column Mapping

The import endpoint auto-detects these column names from your insurer files:

| Your Column | Maps To |
|-------------|---------|
| `PolicyNo` or `Policy Number` | Policy number |
| `LOGINID` or `RM Name` | RM name |
| `INTERMEDIARYNAME` or `IMD Name` | IMD name |
| `PolicyIssueDate` or `Dump Received Date` | Received date |
| `QCRejectionRemarks` or `RM Response` | QC remarks |
| `Ageing` or `Remarks` | Remarks |
| `BRANCHNAME` | Branch (stored in extra) |
| `Product_Name` | Product (stored in extra) |
| `RegistrationNo` | Reg. number (stored in extra) |
| `FinalPremium` | Premium (stored in extra) |
| `CustomerFirstName` + `CustomerLastName` | Customer name (stored in extra) |