# ShopCraft — Architecture

## Stack decision

| Layer | Choice | Why |
| --- | --- | --- |
| API | NestJS 11 (modular monolith) | strong structure/DI, one deployable, domain folders keep boundaries clean |
| ORM | Prisma 6 | typed queries, migrations, interactive transactions |
| Database | **SQL Server** (dev: local instance w/ integrated auth; prod: container or managed) | the spec allows "PostgreSQL or SQL Server"; SQL Server was already installed & running on the dev machine, giving a real RDBMS with zero setup. Schema is kept portable — see below |
| Storefront/Admin | Next.js 15 + Tailwind v4 | SSR/SEO for the storefront, fast DX, shared design tokens |
| Shared domain | `@shopcraft/shared` TS package | ONE source of truth for statuses, state machines, pricing math, zod schemas, permissions — used by API and both frontends |
| Auth | JWT access (15 min) + rotating refresh tokens (hashed in DB), httpOnly cookies | Bearer header also accepted for API clients |
| Payments | Gateway interface → Razorpay adapter + MockPay dev adapter | new gateways (Cashfree/Stripe) = one new adapter |
| Notifications | Hub service → in-app + email senders | SMS/push/WhatsApp plug in at one point |
| Storage | Provider interface → local disk (dev) / S3-compatible | DB stores URLs only |

## SQL Server portability notes (→ PostgreSQL later)

- **No Prisma enums** on SQL Server → all status/type columns are strings; the
  canonical unions + state machines live in `@shopcraft/shared` and are enforced
  in services. On Postgres you may convert them to native enums.
- **Unique + NULL**: SQL Server unique constraints allow a single NULL, so the
  nullable unique columns (`User.email/phone/googleId`, `Payment.providerPaymentId`,
  `Order.idempotencyKey`) are enforced by **filtered unique indexes**
  (`WHERE col IS NOT NULL`) created in migration `20260917170428`. Postgres
  handles NULLs natively; restore plain `@unique` there.
- **Referential actions**: all relations use `NoAction` (SQL Server rejects
  multiple cascade paths). Deletion is soft (`deletedAt`) everywhere it matters.
- JSON payloads are `NVarChar(max)` strings ((de)serialized in `common/utils.ts`);
  on Postgres switch to `Json` columns if desired.

## Money flow (server-authoritative)

```
Cart display ──┐
Checkout    ───┼──► PricingService.priceLines()
Order create ──┘        │
                        ▼
        @shopcraft/shared priceCart()  (pure, unit-tested)
        MRP → product discount → best offer per line → coupon
        (scoped, capped, per-user/total limits) → shipping zone fee
        → GST extracted from inclusive prices → total
```

Nothing price-related is ever read from the client. Coupons re-validate at
order time; totals are recomputed from the DB.

## Order lifecycle

```
PENDING_PAYMENT ──► PAYMENT_FAILED ──► (retry → PENDING_PAYMENT)
      │  reserve stock (atomic, oversell-proof)
      ▼
  CONFIRMED  ◄─ signature/webhook verified (or COD)
      │  reservation → sale, soldCount++, coupon redemption, cart CONVERTED
      ▼
 PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
      │                                     │
   CANCELLED (restock + auto-refund)   RETURN_REQUESTED → RETURNED → REFUNDED
```

Transitions are validated by `canTransitionOrder`; every change writes
`OrderStatusHistory` (+ audit log for admin actions). A 5-minute cron cancels
unpaid orders after 45 min and releases their reservations; a daily cron marks
stale carts ABANDONED and purges expired tokens.

## Inventory model

`stockOnHand` / `stockReserved` on ProductVariant; `available = onHand − reserved`.
Every movement goes through `InventoryService` (RESERVE / RELEASE / SALE /
RETURN / RESTOCK / ADJUSTMENT) inside the surrounding transaction and writes an
`InventoryTransaction` row with the running available balance. Reservation uses
a conditional raw `UPDATE … WHERE stockOnHand - stockReserved >= qty`, so two
concurrent checkouts can never oversell.

## RBAC

Roles (SUPER_ADMIN, ADMIN, INVENTORY_MANAGER, ORDER_MANAGER, SUPPORT,
MARKETING_MANAGER, CUSTOMER) carry a JSON permission list editable by the Super
Admin. JWTs carry role names; `PermissionsGuard` resolves permissions from the
DB (60 s cache) and enforces `@RequirePerms(...)` on every admin route.

## Future multi-vendor path

Kept in mind per the product plan: add a `Merchant` table, `merchantId` on
Product/Order-item level, scope admin queries by merchant role, and split
settlement out of `Payment`. No current table needs restructuring for that.
