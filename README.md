# ShopCraft — Production-Ready E-Commerce Platform

A complete e-commerce platform for a single merchant (architected so multi-vendor can be added later):

- **Customer storefront** (`apps/web`) — Next.js 15, SEO-ready, mobile-first, light/dark
- **Admin dashboard** (`apps/admin`) — Next.js 15, full store operations with RBAC
- **API** (`apps/api`) — NestJS 11 + Prisma, modular monolith
- **Shared domain** (`packages/shared`) — pricing engine, state machines, zod schemas, permissions

| App | Dev URL | Notes |
| --- | --- | --- |
| Storefront | http://localhost:3000 | customer experience |
| Admin | http://localhost:3100 | merchant dashboard |
| API | http://localhost:4000/api | REST, cookie auth |

**Dev accounts (seeded — change in production):**

- Super Admin: `admin@shopcraft.local` / `Admin@12345`
- Customer: `demo@shopcraft.local` / `Demo@12345`

---

## 1. Prerequisites

- Node.js ≥ 20 and npm ≥ 10
- A SQL Server instance (dev on this machine uses the local SQL Server with Windows integrated auth; Docker/production uses the `mcr.microsoft.com/mssql/server` image). PostgreSQL migration notes are in `docs/ARCHITECTURE.md`.

## 2. Install & set up

```bash
npm install
```

Create `apps/api/.env` (copy from `.env.example` at the repo root and adjust):

```
DATABASE_URL=sqlserver://localhost:1433;database=ecommerce_dev;integratedSecurity=true;trustServerCertificate=true
```

Create the database once (SQL auth users can skip `-E` and pass `-U/-P`):

```bash
sqlcmd -S localhost -E -Q "IF DB_ID('ecommerce_dev') IS NULL CREATE DATABASE ecommerce_dev;"
```

Then migrate + seed:

```bash
npm run db:migrate     # applies Prisma migrations (dev)
npm run db:seed        # roles, admin, demo catalog/orders — clearly labelled demo data
```

## 3. Run (three terminals, or use the .claude/launch.json presets)

```bash
npm run dev:api
```

```bash
npm run dev:web
```

```bash
npm run dev:admin
```

## 4. Testing

```bash
npm test               # unit tests: pricing engine, coupons, state machines, utils
```

An end-to-end checkout (login → cart → coupon → order → mock gateway → HMAC verify →
stock movement → cart conversion, plus idempotency-replay and forged-signature checks)
is scripted for PowerShell in the dev transcript and runs against the live dev API.

## 5. Configuration

All secrets live in environment variables — never in code or the database.
See `.env.example` for every key. Highlights:

| Area | Keys | Notes |
| --- | --- | --- |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | generate long random values for production |
| Google login | `GOOGLE_CLIENT_ID` (API) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) | create a Web OAuth Client at console.cloud.google.com; add your storefront origin to Authorized JavaScript origins |
| Phone OTP | `OTP_PROVIDER=dev\|msg91\|twilio` | `dev` logs the OTP to the API console and returns it in dev responses |
| Payments | `PAYMENT_PROVIDER=mock\|razorpay` + Razorpay keys | `mock` runs the full create→verify→webhook handshake locally with HMAC signatures; point the Razorpay webhook at `POST /api/payments/webhook` |
| Storage | `STORAGE_PROVIDER=local\|s3` | local disk in dev; S3-compatible needs `npm i @aws-sdk/client-s3 -w @shopcraft/api` plus the S3_* keys |
| Email | `EMAIL_PROVIDER=dev\|smtp` | smtp needs `npm i nodemailer -w @shopcraft/api` |

### Payment security model

An order is **never** marked paid from frontend input. The flow is:

1. `POST /api/orders/checkout` — server re-prices the cart, reserves stock in a
   transaction (oversell-proof `UPDATE … WHERE available >= qty`), creates the
   order `PENDING_PAYMENT`, and creates a gateway order.
2. The gateway checkout returns `{orderId, paymentId, signature}` to the browser.
3. `POST /api/payments/verify` — the server recomputes the HMAC with the gateway
   secret; only a valid signature confirms the payment.
4. `POST /api/payments/webhook` — signature-verified and idempotent
   (`WebhookEvent` unique on provider+eventId); captures/failures reconcile even
   if the browser never returns.
5. Unpaid orders auto-cancel after 45 minutes and their stock reservation is released.

## 6. Deployment

```bash
# with Docker (SQL Server + api + web + admin)
cp .env.example .env   # fill in MSSQL_SA_PASSWORD, JWT secrets, gateway keys…
docker compose up -d --build
```

Per-app Dockerfiles live in `apps/*/Dockerfile` (build from the repo root).
For a managed setup, host the API anywhere Node runs, the two Next.js apps on
any Node/edge host, and point `NEXT_PUBLIC_API_URL` at the API origin. Keep the
storefront and API on the same site (e.g. `shop.example.com` + `api.example.com`)
so the `SameSite=Lax` auth cookies flow.

## 7. Project layout

```
apps/api          NestJS API (modular monolith: auth, catalog, cart, checkout,
                  payments, orders, inventory, reviews, notifications, admin/*)
apps/web          Customer storefront (Next.js App Router)
apps/admin        Merchant dashboard (Next.js App Router)
packages/shared   Canonical domain layer: status unions, state machines,
                  server-authoritative pricing engine, zod request schemas, RBAC
docs/             Architecture decision record & schema notes
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
