# Smart Multi-Modal Attendance

A lightweight, serverless Progressive Web App (PWA) designed to eliminate the 10-15 minute "Time-Leak" of manual classroom attendance, equipped with anti-cheating mechanisms like 10-second dynamic QR hashes and device tracking.

## 👥 The Team
* **Khoa Goodwill** - System Architect & Project Manager
* **Zsombók Kevin** - Backend Developer
* **Li Xuetao** - Frontend Engineer
* **Curos Maxim** - DevOps & QA Engineer
* **Naat Yacine** - AI/Data Specialist

## 🏗️ Architecture Stack
This project follows a TOGAF-aligned Microservices Architecture:
* **Frontend (Client Presentation):** React.js / Web App (Deployed on Vercel)
* **Backend (Application Services):** Python FastAPI 
* **Database (Data Architecture):** PostgreSQL (Hosted on Supabase) with SQLAlchemy ORM
* **External Services:** Supabase OAuth (ELTE Google/Microsoft Single Sign-On)

## 🌐 Live Deployment

Current published endpoints:

- **Production Frontend:** https://smartattendancesystem2.vercel.app
- **Preview Frontend (dev branch):** https://smartattendancesystem2dev.vercel.app
- **Production Backend API:** https://smart-attendance-system-z26x.onrender.com

Quick links:
- Production home: https://smartattendancesystem2.vercel.app/home
- Production student login flow: https://smartattendancesystem2.vercel.app/login
- Production teacher login: https://smartattendancesystem2.vercel.app/teacher-login
- Production admin login: https://smartattendancesystem2.vercel.app/admin-login

Notes:
- Preview deployments may be protected by Vercel access control. If OAuth callback testing is required on preview, ensure preview protection is disabled or configured to allow callback completion.
- Student social sign-in is validated for ELTE domains (`@elte.hu` and subdomains such as `@inf.elte.hu`).

## 📂 Repository Structure
This is a monorepo. The codebase is split into two primary domains:

* `/frontend` - Contains the React application, QR scanner (`html5-qrcode`), and lecturer dashboard UI.
* `/backend` - Contains the FastAPI application, RESTful endpoints (`/auth`, `/sessions`, `/attendance`, `/export`), and SQLAlchemy database schemas.

## 🚀 Launch Guide

### Local Development (Windows)
Use two terminals from the repository root.

1. Prepare environment files.

Backend uses `backend/.env`:
```env
DATABASE_URL=sqlite:///./attendance.db
SUPABASE_URL=https://your-project.supabase.co
SUPERUSER_KEY=admin123
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_optional_for_admin_provisioning
```

Frontend uses `frontend/.env`:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ENABLE_AZURE_SSO=true
VITE_OAUTH_REDIRECT_URL=http://127.0.0.1:5173/auth/callback
```

If the files do not exist yet, copy from `backend/.env.example` and `frontend/.env.example`.

2. Start the backend.
```powershell
cd backend
python -m venv ..\.venv
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

3. Start the frontend.
```powershell
cd frontend
cmd /c npm install
cmd /c npm run dev -- --host 127.0.0.1 --port 5173
```

4. Open the app.
- Frontend landing page: `http://127.0.0.1:5173/home`
- Frontend root redirect: `http://127.0.0.1:5173/`
- Backend API: `http://127.0.0.1:8000`

5. Main routes during local testing.
- Public home: `/home`
- Student landing: `/student`
- Student courses: `/courses`
- Teacher login: `/teacher-login`
- Admin login: `/admin-login`
- Admin dashboard: `/admin`

Notes:
- If npm commands are blocked by PowerShell execution policy, keep using `cmd /c npm ...`.
- Restart the backend after backend model changes so SQLite schema upgrades run.
- `SUPABASE_SERVICE_ROLE_KEY` is only required for admin actions that create lecturers or reset lecturer passwords in Supabase.

### Deploy Frontend With Vercel
This repository contains a Vercel config only for the React frontend in `frontend/vercel.json`.

1. Ensure the backend API is already deployed somewhere reachable from the public internet.

Examples:
- Render
- Railway
- Fly.io
- Azure App Service
- Any VM or container host running FastAPI

2. In Vercel, import the `frontend` directory as the project root.

Recommended Vercel project settings:
- Framework Preset: `Vite`
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

3. Add frontend environment variables in Vercel.
- `VITE_API_BASE_URL=https://your-backend-host.example.com`
- `VITE_SUPABASE_URL=https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`
- `VITE_ENABLE_AZURE_SSO=true` if Azure SSO should be visible
- `VITE_OAUTH_REDIRECT_URL=https://your-frontend-domain/auth/callback`

Use environment-scoped values for redirect URLs:
- **Production environment:** `VITE_OAUTH_REDIRECT_URL=https://smartattendancesystem2.vercel.app/auth/callback`
- **Preview environment:** `VITE_OAUTH_REDIRECT_URL=https://smartattendancesystem2dev.vercel.app/auth/callback`

For your live deployment, use the actual frontend domain here:
- `https://smartattendancesystem2.vercel.app/auth/callback`

In Supabase Auth settings, add the same redirect URL to the allowed callback URLs for both Google and Microsoft providers. Keep the local callback URL as well if you still run the app from `localhost`.

Recommended Supabase redirect allow-list:
- `https://smartattendancesystem2.vercel.app/auth/callback`
- `https://smartattendancesystem2dev.vercel.app/auth/callback`
- `http://127.0.0.1:5173/auth/callback`

For Microsoft SSO specifically:
- In Microsoft Entra app registration, use the Supabase callback as the Web redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
- In Supabase Auth URL settings, set the Site URL to `https://smartattendancesystem2.vercel.app`
- Add `https://smartattendancesystem2.vercel.app/auth/callback` and your local callback to Supabase redirect URLs
- If Microsoft returns `Error getting user email from external provider`, add the `email` optional claim to the ID token in Entra and make sure the ELTE account has a usable mailbox/UPN

4. Deploy.

The included `frontend/vercel.json` rewrites all frontend routes back to `/`, which allows direct navigation to routes like `/home`, `/teacher-login`, `/courses`, and `/admin-login` after deployment.

### Deploy Backend Separately
The backend is a FastAPI application under `backend/`. It is not configured as a Vercel serverless backend in this repository.

Deploy it separately with environment variables such as:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPERUSER_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Example backend start command:
```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Quick Verification After Launch
- Teacher can log in at `/teacher-login` and open `/teacher-courses`
- Student can log in and use `/courses` then `/scan`
- Admin can log in at `/admin-login` and open `/admin`
- Frontend API calls resolve to the configured `VITE_API_BASE_URL`

### One-Command Recap
Backend:
```powershell
cd backend
python -m venv ..\.venv
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:
```powershell
cd frontend
cmd /c npm install
cmd /c npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend production build check:
```powershell
cd frontend
cmd /c npm run build
```

Vercel deploy flow:
```powershell
cd frontend
npm install -g vercel
vercel
vercel --prod
```

Vercel deploy prerequisites:
- Run the commands from the `frontend` directory.
- Configure `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in the Vercel project.
- Deploy the backend separately before using `vercel --prod`.

### End-to-End Test Steps

Lecturer steps:
1. Open frontend at `/home` and sign in as teacher.
2. Go to Teacher Dashboard (`/teacher-courses`).
3. Select semester from the dropdown.
4. Select course from the course dropdown (`Course Name, Type, Code`).
5. Verify selected course card shows only:
	- Course name
	- Course type and code
	- `Start Session` button
6. Click `Start Session`.
7. Verify QR page opens and QR refreshes every 8 seconds.
8. Keep the QR visible for student scans.
9. Click `End Session` when lecture is done.
10. Click `Export` to download CSV attendance log.

Student steps:
1. Open frontend at `/home` and sign in as student.
2. Go to Courses page (`/courses`).
3. Click active course and open scan page.
4. Scan lecturer QR with phone camera/browser scanner.
5. Verify success message: attendance recorded.
6. Re-scan same device in same session and verify duplicate rejection.
7. Optionally test with a second device token/browser profile and verify valid scan.

Checklist for complete validation:
- Session appears as active in admin dashboard.
- Student scan records appear in export CSV.
- Duplicate device is blocked in same session.
- Ended session no longer accepts fresh attendance scans.

Environment files included:
- `backend/.env` and `backend/.env.example`
- `frontend/.env` and `frontend/.env.example`

## Deliverables Document (Outside Repo)
Submission-ready documentation is stored one folder above this repository:

- `../project_deliverables/Deliverables_to_Advanced_Software_Technology_course_at_ELTE.md`

This keeps reporting artifacts separate from source-code commits.

## Go Live Plan (Separate from Demo Push)

### A. Live Demo Push (fast path)
1. Confirm local backend and frontend run cleanly.
2. Use demo env values and `SUPERUSER_KEY` for controlled walkthrough.
3. Run the E2E checklist in this README.
4. Deploy frontend preview on Vercel and backend instance on your chosen API host for demo session only.

### B. Production Go Live (separate release track)
1. Create a release branch and freeze feature changes.
2. Set production secrets:
	- Backend: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPERUSER_KEY`.
	- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENABLE_AZURE_SSO=true`, `VITE_OAUTH_REDIRECT_URL=https://your-frontend-domain/auth/callback`.
    - Frontend also needs `VITE_API_BASE_URL` pointing to the deployed backend.
3. In Supabase Auth settings:
	- Enable Google provider.
	- Enable Azure provider (if required).
	- Configure production redirect URLs.
4. Run production smoke tests:
	- Teacher start/end/export.
	- Student login and scan.
	- Admin emergency protocol.
	- Lecturer onboarding and password request cycle.
5. Add domain, TLS, and monitoring alerts.
6. Tag release and deploy to production.

This production sequence should be executed independently from the demo push.

### Developer Shortcuts
Frontend:
1. `cd frontend`
2. `cmd /c npm install`
3. `cmd /c npm run dev`

Backend:
1. `cd backend`
2. `python -m venv ..\.venv`
3. `..\.venv\Scripts\python.exe -m pip install -r requirements.txt`
4. `..\.venv\Scripts\python.exe -m uvicorn main:app --reload`