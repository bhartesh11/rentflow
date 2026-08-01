# RentFlow API — Node.js port

This is a Node.js/Express port of the original FastAPI (Python) backend.
It preserves the same routes, request/response shapes, MongoDB schema, and
business logic (occupancy syncing, bill status computation, invoice/receipt
numbering, dashboard aggregates, etc).

## Stack

| Concern            | Python original          | Node.js port                  |
|---------------------|---------------------------|--------------------------------|
| Web framework        | FastAPI                  | Express                        |
| MongoDB driver        | Motor (async)             | `mongodb` (official async driver) |
| Password hashing      | passlib (bcrypt)          | `bcryptjs`                     |
| JWT                    | python-jose                | `jsonwebtoken`                 |
| Request validation     | Pydantic                    | `zod`                           |
| PDF generation          | reportlab                  | `pdfkit`                        |

## Setup

```bash
npm install
cp .env.example .env   # edit as needed
npm start               # or: npm run dev (auto-restart on changes)
```

Requires a running MongoDB instance reachable at `MONGO_URI`.

## Project layout

```
src/
  config.js            environment settings (mirrors app/config.py)
  database.js          Mongo client, collections, counters, indexes
  auth.js              password hashing, JWT, auth middleware
  app.js               Express app + route mounting (mirrors app/main.py)
  server.js            startup: connect DB, seed owner account, listen
  middleware/
    validate.js         zod request-body validation
    errorHandler.js      central error -> HTTP response mapping
  utils/
    helpers.js           Mongo document serialization
    httpError.js          HttpError class (mirrors HTTPException)
    asyncHandler.js        wraps async route handlers
    pdf.js                 invoice/receipt PDF generation
  validation/
    schemas.js            zod schemas (mirrors app/models.py)
  routes/
    auth.js, rooms.js, tenants.js, bills.js, payments.js,
    requests.js, dashboard.js
```

## Behavioral notes

- **Auth**: same JWT payload shape (`sub`, `role`, `tenant_id`), same
  `Authorization: Bearer <token>` header, same 401/403 semantics.
- **IDs**: Mongo `_id` is always exposed to clients as `id` (string), exactly
  as in the original `serialize()` helper.
- **Bill status** (`unpaid` / `partial` / `paid` / `overdue` / `partial_overdue`)
  is computed identically, comparing `YYYY-MM-DD` due-date strings against
  today's date as strings (avoids timezone edge cases that a `Date` object
  comparison could introduce).
- **PDF invoices/receipts**: functionally equivalent output (same fields,
  same computed totals) generated with `pdfkit` instead of `reportlab`;
  since the two libraries lay out tables differently, the pixel-level
  styling isn't identical, but the content and structure match.
- **Owner auto-seeding**: on startup, if no user with `role: "owner"`
  exists, one is created from `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NAME`,
  same as the FastAPI `@app.on_event("startup")` hook.
- One deliberate improvement: invalid MongoDB ObjectId strings passed to a
  route now consistently return `400 Invalid id format` instead of a raw
  server error (the original `delete_room` route, for example, didn't catch
  that case and would have raised an unhandled 500).
