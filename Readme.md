# DumpTracker

DumpTracker is an internal insurance operations platform built for **Sama Insurance Pvt. Ltd.** to manage:

- discrepancy dump tracking
- policy-level resolution workflows
- renewal dump tracking
- renewal follow-up and customer response workflows
- RM tracking and bucket-based operations views
- admin-led user access control
- audit logging for key operational actions

The project is split into:

- `frontend/` — React + Vite application
- `backend/` — Express + PostgreSQL API

## What It Does

### Discrepancy Module

- Create and manage dump batches
- Import policy files from Excel / CSV
- Track policy resolution status
- View pending and resolved policies
- Monitor bucket aging
- Track RM-wise workload

### Renewal Module

- Create and manage renewal dump batches
- Import renewal workbooks from multiple sheets
- Normalize varying renewal file structures
- Track due soon, expired, and renewed policies
- Manage renewal statuses and customer responses
- View RM tracking, customer tracking, and renewal buckets

### Access Control

- Admin user management
- Full-access and read-only user roles
- Module-level access rights
- RM-scoped user visibility

### Audit & Governance

- User creation, update, and deletion logs
- Dump and renewal dump action logs
- Policy and renewal update/delete/import logs
- Export logs
- Login event logging

## Tech Stack

- Frontend: React, React Router, Vite
- Backend: Node.js, Express
- Database: PostgreSQL
- File handling: `xlsx`, `exceljs`, `multer`
- Auth: JWT + role/permission checks
- Deployment:
  - Frontend: Vercel
  - Backend: Render
  - Database: Supabase Postgres

## Project Structure

```text
dump-tracker/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/
│   │   ├── lib/
│   │   ├── middleware/
│   │   └── routes/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── pages/
│   └── package.json
└── package.json
```

## Local Development

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment variables

Backend example is available in `backend/.env.example`.

Recommended backend envs:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-strong-secret-at-least-32-chars
FRONTEND_URL=http://localhost:5173
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
ADMIN_ROLE=admin
```

Frontend env:

```env
VITE_API_URL=http://localhost:3001
```

### 3. Run database migration

From repo root:

```bash
npm run db:migrate
```

Optional admin seed:

```bash
npm run db:seed --prefix backend
```

### 4. Start the app

```bash
npm run dev
```

This runs:

- backend on `http://localhost:3001`
- frontend on `http://localhost:5173`

## Production Deployment

### Frontend

- Host: Vercel
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable:

```env
VITE_API_URL=https://your-backend-url
```

### Backend

- Host: Render
- Root Directory: `backend`
- Build Command:

```bash
npm install
```

- Start Command:

```bash
npm start
```

Backend environment variables:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-strong-secret-at-least-32-chars
FRONTEND_URL=https://your-frontend-domain
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
ADMIN_ROLE=admin
```

If a migration is required during deployment, temporarily use:

```bash
npm run db:migrate && npm start
```

Then change it back to:

```bash
npm start
```

## Current Key Features

- Discrepancy dump upload and tracking
- Renewal dump upload and tracking
- Flexible renewal sheet parsing
- Policy and renewal delete handling
- RM drill-down from RM tracking
- Role-based and RM-scoped access control
- Mobile-friendly layout
- Server-side pagination for list-heavy pages
- Admin audit log

## Security Notes

- `JWT_SECRET` is required and must be at least 32 characters
- Admins should be created and managed carefully
- Environment variables should never contain placeholder credentials in production
- Database credentials should be rotated if ever exposed accidentally

## Scripts

Root:

```bash
npm run install:all
npm run dev
npm run db:migrate
npm run build
```

Backend:

```bash
npm run dev --prefix backend
npm start --prefix backend
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
```

Frontend:

```bash
npm run dev --prefix frontend
npm run build --prefix frontend
```

## Notes

This system was designed and built while working at **Sama Insurance Pvt. Ltd.** as an internal operational product to improve visibility, accountability, and day-to-day execution for discrepancy and renewal handling.
