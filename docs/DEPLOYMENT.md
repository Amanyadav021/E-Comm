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

The app runs on **PostgreSQL**. Any managed Postgres works; [Neon](https://neon.tech)
and [Supabase](https://supabase.com) both have a free tier that is plenty for
launch. Create a database, copy its connection string, and set:

```
DATABASE_URL=postgresql://USER:PASS@HOST/DB?sslmode=require
```

Then apply the schema and (optionally) the demo catalog:

```bash
cd apps/api
npx prisma migrate deploy     # creates all 42 tables
npm run db:seed               # roles + admin user + demo data — optional
```

`db:seed` is what creates your first Super Admin, so either run it or create
that account another way before you try to sign in to the dashboard.

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

### Product images

Leave `STORAGE_PROVIDER=local` and every image uploaded through the admin is
gone on the next deploy — container disks are ephemeral. Use Supabase Storage:

1. Supabase dashboard → **Storage** → create a bucket named `product-images`,
   marked **Public**.
2. **Storage → S3 Access Keys** → create a key pair.
3. Set these on the API host:

```
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
S3_REGION=<project region>
S3_BUCKET=product-images
S3_ACCESS_KEY_ID=<from step 2>
S3_SECRET_ACCESS_KEY=<from step 2>
S3_PUBLIC_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/product-images
```

The same variables point at Cloudflare R2, AWS S3 or MinIO — only the endpoint
and keys change; no code does.

> **Connecting to Supabase from a network without IPv6:** the "Direct
> connection" string in the Supabase dashboard resolves to an IPv6-only host.
> If your network is IPv4-only the API simply cannot reach it (Prisma reports
> `P1001`). Use the **Session pooler** string instead — same database, IPv4,
> and unlike the transaction pooler it supports the interactive transactions
> that checkout relies on:
>
> ```
> postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
> ```
>
> A password containing `@`, `/` or `:` **must be percent-encoded** or the URL
> parses wrong (`@` → `%40`).

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
