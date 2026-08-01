# RentFlow

A self-hosted rent billing system with a separate **Owner Portal** and **Tenant Portal**.

- Owner: manage rooms, tenants, generate monthly bills, record payments, track dues and occupancy, download invoices/receipts, handle maintenance requests.
- Tenant: log in (or self-register with an invite code), view bills and running balance, download invoice/receipt PDFs, raise maintenance requests.

**Stack:** React + TypeScript + Tailwind (frontend) · FastAPI (backend) · MongoDB (database) · JWT auth · ReportLab PDF generation.

---

## 1. Quick start (Docker — recommended)

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
# 1. Copy env templates and edit values
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Edit backend/.env — at minimum change JWT_SECRET and the OWNER_* credentials
nano backend/.env

# 3. Start everything (Mongo + API + frontend)
docker compose up -d --build

# 4. Open the app
# Frontend:  http://localhost:4173
# API docs:  http://localhost:8000/docs
```

On first boot the backend automatically seeds one **owner** account using the
`OWNER_EMAIL` / `OWNER_PASSWORD` from `backend/.env`. Log in with those
credentials, then start adding rooms and tenants.

To stop: `docker compose down` (add `-v` to also wipe the Mongo volume).

---

## 2. Manual / local development setup

### Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env — set MONGO_URI to your MongoDB instance, e.g.
#   MONGO_URI=mongodb://localhost:27017   (local Mongo)
#   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net (Atlas)

uvicorn app.main:app --reload --port 8000
```

You need a running MongoDB instance. Easiest local option:
```bash
docker run -d -p 27017:27017 --name rentflow-mongo mongo:7
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env
# edit .env — set VITE_API_URL to your backend URL (default http://localhost:8000)

npm run dev
# open http://localhost:5173
```

Production build:
```bash
npm run build      # outputs static files to frontend/dist
npm run preview    # serves the production build locally on :4173
```
Deploy the contents of `frontend/dist` to any static host (Nginx, S3+CloudFront, Netlify, Vercel, etc.) if you don't want to use the Docker frontend container.

---

## 3. Environment variables

### backend/.env
| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `MONGO_DB_NAME` | Database name (default `rentflow`) |
| `JWT_SECRET` | **Change this.** Long random string used to sign JWTs |
| `JWT_ALGORITHM` | Default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Login session length in minutes |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |
| `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NAME` | Seeded on first run if no owner account exists yet |
| `SMTP_*` | Optional — for future email notifications (not required to run the app) |

### frontend/.env
| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

---

## 4. How the tenant "Join" flow works

1. The owner creates a **Room** in the Rooms tab and clicks **Copy Invite Code** (this is the room's internal ID).
2. The owner shares that code with the tenant (message, email, WhatsApp — however you like).
3. The tenant visits `/join`, fills in their details, and pastes the invite code.
4. Their account is created and automatically linked to that room. If the owner had already pre-added the tenant (same email) via the Tenants tab, the self-registration links to that existing profile instead of creating a duplicate.

Alternatively, the owner can add a tenant directly from the **Tenants** tab and optionally set a login password there — no self-registration needed.

---

## 5. Core flows implemented

- **Auth:** Owner login, tenant login, tenant self-registration ("Join"), JWT-based role access.
- **Rooms:** Create / edit / delete, occupancy status auto-tracked from tenant assignments.
- **Tenants:** Add / edit / delete, KYC fields (ID proof, address), room assignment, active/vacated status.
- **Bills:** Bulk-generate monthly bills for all active tenants (rent pulled from the room + optional utility line items), or create a single custom bill. Auto invoice numbering.
- **Payments:** Record full or partial payments against a bill; balance and status (unpaid/partial/paid/overdue) update automatically. Auto receipt numbering.
- **Dashboard:** Occupancy rate, active tenants, this month's billed/collected, total dues, overdue count, 6-month collections chart, recent payments.
- **Tenant portal:** View all bills with line-item breakdown and running balance, download invoice PDFs, view payment history and download receipt PDFs, raise and track maintenance requests.
- **PDF export:** Server-generated invoice and receipt PDFs (ReportLab).
- **Maintenance requests:** Tenant raises a request; owner updates status (open → in progress → resolved) with an optional note.

### Not included in this build (documented, easy to add later)
- Online payment gateway (Stripe/Razorpay) — payments are recorded manually by the owner, per the original assumption.
- Automated email/WhatsApp reminders — SMTP settings are scaffolded in `.env` but no scheduler/cron is wired up yet.

---

## 6. Project structure

```
rentflow/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + startup seeding
│   │   ├── config.py          # Settings from env
│   │   ├── database.py        # Mongo collections + indexes
│   │   ├── auth.py            # JWT + password hashing + role dependencies
│   │   ├── models.py          # Pydantic request/response schemas
│   │   ├── routers/           # auth, rooms, tenants, bills, payments, requests, dashboard
│   │   └── utils/              # pdf.py (ReportLab), helpers.py (serialization)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/owner/        # Dashboard, Rooms, Tenants, Bills, Payments, Requests
│   │   ├── pages/tenant/       # TenantBills, TenantPayments, TenantRequests
│   │   ├── pages/              # Login, Join
│   │   ├── components/         # Navbar, ProtectedRoute, Common (Modal/Badge/Spinner/etc.)
│   │   ├── context/AuthContext.tsx
│   │   └── api/                # client.ts (axios), types.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
└── README.md
```

---

## 7. Security notes before going to production

- Change `JWT_SECRET` and the seeded `OWNER_PASSWORD` immediately.
- Put the app behind HTTPS (e.g. an Nginx/Caddy reverse proxy or your hosting provider's TLS).
- Restrict `CORS_ORIGINS` to your real frontend domain.
- Take regular backups of the `mongo_data` Docker volume (or your managed MongoDB service).
