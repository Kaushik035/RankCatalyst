# RankCatalyst – Attention-Aware ITS (JEE Chemistry)

Dark-themed, production-ready mono-repo with React + Vite + TS + Tailwind (frontend) and Django REST + JWT (backend), wired via Docker and PostgreSQL.

## Stack
- Frontend: Vite + React + TypeScript + TailwindCSS, Zustand, React Hook Form, Zod
- Backend: Django + DRF + SimpleJWT, PostgreSQL, django-cors-headers
- Tooling: ESLint/Prettier, Black/isort/Ruff/mypy, pytest, Jest/RTL
- Docker services: frontend, backend, db

## Getting Started

Prerequisites:
- Docker Desktop
- Node 20 and Python 3.12 are optional (only if running outside Docker)

Setup:
1. Copy envs
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
2. Start services
   - `make up` or `docker compose up -d --build`
3. Migrate DB
   - `make migrate`
4. Create superuser (optional)
   - `make superuser`
5. Visit
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8000

## Environment
- Frontend `.env`
  - `VITE_API_BASE_URL=http://localhost:8000/api`
- Backend `.env`
  - `DJANGO_SECRET_KEY=changeme`
  - `DJANGO_DEBUG=True`
  - `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1`
  - `DJANGO_CORS_ORIGINS=http://localhost:5173`
  - `POSTGRES_DB=rankcatalyst`
  - `POSTGRES_USER=rank_user`
  - `POSTGRES_PASSWORD=rank_pass`
  - `POSTGRES_HOST=db`
  - `POSTGRES_PORT=5432`
  - `ACCESS_TOKEN_LIFETIME_MIN=15`
  - `REFRESH_TOKEN_LIFETIME_DAYS=7`
  - `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`

## Auth Flows
- Email/password signup (inactive until email verified)
- Email verification via token (console backend for dev)
- Login/Logout, Refresh token
- Password reset via token email
- `GET /api/secure/ping` protected endpoint

## Commands
- `make up|down|logs|ps`
- `make migrate|makemigrations|superuser`
- `make test-front|test-back`
- `make lint-front|lint-back|fmt-back`

## Testing
- Backend: `pytest`
- Frontend: `jest` + `@testing-library/react`

## Production Notes (later)
- Configure SMTP (SendGrid/SES) for emails
- Enable HTTPS and reverse-proxy via Nginx
- Harden SimpleJWT settings and Django `SECURE_*`

## Roadmap
- Eye-gaze attention via WebGazer.js/MediaPipe
- Adaptive content generator and analytics
