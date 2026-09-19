# Deploying ShopCraft

## What runs where

Vercel is the right home for the two Next.js apps. It is **not** a suitable home
for the API, for three concrete reasons in this codebase:

| Constraint | Where it lives | Why Vercel can't host it |
| --- | --- | --- |
| 3 cron jobs (expire unpaid orders, abandon carts, purge tokens) | `apps/api/src/tasks/tasks.service.ts` | `@nestjs/schedule` needs a process that stays alive; Vercel functions are ephemeral |
| Product/banner image uploads written to disk | `apps/api/src/uploads/uploads.controller.ts` | Vercel's filesystem is read-only and per-invocation |
| Long-running NestJS server + Prisma connection pool | `apps/api` | designed as a persistent server, not a serverless handler |

So the target topology is:

```
  Vercel  ──►  apps/web    (storefront)   ──┐
  Vercel  ──►  apps/admin  (dashboard)    ──┤ /api/* proxied (Next rewrites)
                                            ▼
        Railway / Render / Fly.io  ──►  apps/api   (Docker, always-on)
                                            ▼
              Managed database (see "Database" below)
```

The `/api/*` proxy is already configured in each app's `next.config.ts`, which
keeps the auth cookies **first-party** on the Vercel domain. Do not bypass it by
calling the API origin directly from the browser, or `SameSite=Lax` cookies stop
working.

---

## 1. Push to GitHub

```bash
git remote add origin https://github.com/<you>/shopcraft.git
git push -u origin master
```

Make the repository **private** — it contains your store's business logic.
No secrets are committed (only `.env.example` placeholders), but keep it private anyway.

## 2. Database

The dev database is a **local SQL Server instance with Windows integrated auth**,
which is not reachable from the internet. Production needs a managed database.
Two options:

**Option A — stay on SQL Server (zero schema work)**
Provision Azure SQL Database, then:
```
DATABASE_URL=sqlserver://<server>.database.windows.net:1433;database=shopcraft;user=<u>;password=<p>;encrypt=true
```
Existing migrations in `apps/api/prisma/migrations` apply as-is.

**Option B — switch to Postgres (cheaper/simpler hosting: Neon, Supabase)**
The schema was written to be portable (see `docs/ARCHITECTURE.md`), but this is
not a config flip — it needs `provider = "postgresql"`, regenerated migrations,
and the filtered-unique-index workaround reverted to plain `@unique`.

Either way, run migrations once against the new database:
```bash
cd apps/api && npx prisma migrate deploy && npm run db:seed   # seed is optional
```

## 3. Deploy the API

The repo ships a production `apps/api/Dockerfile` that runs `prisma migrate deploy`
on boot. On Railway/Render/Fly, point the service at that Dockerfile with build
context = repository root, then set:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | from step 2 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `COOKIE_SECURE` | `true` |
| `CORS_ORIGINS` | `https://<your-web>.vercel.app,https://<your-admin>.vercel.app` |
| `API_PUBLIC_URL` | the API's own public URL |
| `PAYMENT_PROVIDER` | `razorpay` (plus `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) |
| `STORAGE_PROVIDER` | `s3` + the `S3_*` keys — local disk does not survive a redeploy |
| `GOOGLE_CLIENT_ID`, `OTP_PROVIDER`, `EMAIL_PROVIDER` | as configured |

Then point the Razorpay webhook at `https://<api-host>/api/payments/webhook`.

> `STORAGE_PROVIDER=s3` currently raises a clear error until you run
> `npm i @aws-sdk/client-s3 -w @shopcraft/api` and implement the S3 branch in
> `uploads.controller.ts`. Until then uploaded images vanish on redeploy.

## 4. Deploy the frontends to Vercel

Import the same GitHub repo **twice** — once per app. Vercel auto-detects the
`vercel.json` in each app directory, so the only thing you set by hand is the
root directory and one env var.

| Setting | Storefront | Admin |
| --- | --- | --- |
| Root Directory | `apps/web` | `apps/admin` |
| Env: `NEXT_PUBLIC_API_URL` | `https://<api-host>` | `https://<api-host>` |
| Env: `NEXT_PUBLIC_WEB_URL` | `https://<your-web>.vercel.app` | — |
| Env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | your OAuth client id | — |

Both apps build successfully even when the API is unreachable (data fetches fall
back to empty states), so you can deploy the frontends first and point them at
the API afterwards.

Finally, add the Vercel domains to the API's `CORS_ORIGINS` and to your Google
OAuth client's authorized JavaScript origins.

## 5. Post-deploy checklist

- [ ] `https://<api-host>/api/catalog/products` returns JSON
- [ ] Storefront loads products (proxy works)
- [ ] Sign-in sets a cookie on the Vercel domain and survives a refresh
- [ ] A test order completes and the Razorpay webhook marks it paid
- [ ] Admin sign-in works and a non-staff account is rejected
