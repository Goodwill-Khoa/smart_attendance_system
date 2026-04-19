# Smart Multi-Modal Classroom Attendance

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

## 📂 Repository Structure
This is a monorepo. The codebase is split into two primary domains:

* `/frontend` - Contains the React application, QR scanner (`html5-qrcode`), and lecturer dashboard UI.
* `/backend` - Contains the FastAPI application, RESTful endpoints (`/auth`, `/sessions`, `/attendance`, `/export`), and SQLAlchemy database schemas.

## 🚀 Getting Started

### For Frontend Developers (Li)
1. `cd frontend`
2. Run `npm install` to install dependencies.
3. Run `npm run start` (or `npm run dev`) to start the local Vercel/React server.

### For Backend Developers (Kevin)
1. `cd backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `source venv/bin/activate` (Mac/Linux) or `venv\Scripts\activate` (Windows)
4. Install requirements: `pip install fastapi uvicorn sqlalchemy psycopg2-binary`
5. Run the server: `uvicorn main:app --reload`