# ShopCraft — Architecture

## Stack decision

| Layer | Choice | Why |
| --- | --- | --- |
| API | NestJS 11 (modular monolith) | strong structure/DI, one deployable, domain folders keep boundaries clean |
| ORM | Prisma 6 | typed queries, migrations, interactive transactions |
| Database | **PostgreSQL 16** | started on SQL Server (it was already running on the dev machine), migrated to Postgres for cheap managed hosting — Neon/Supabase have free tiers, hosted SQL Server does not |
| Storefront/Admin | Next.js 15 + Tailwind v4 | SSR/SEO for the storefront, fast DX, shared design tokens |
| Shared domain | `@shopcraft/shared` TS package | ONE source of truth for statuses, state machines, pricing math, zod schemas, permissions — used by API and both frontends |
| Auth | JWT access (15 min) + rotating refresh tokens (hashed in DB), httpOnly cookies | Bearer header also accepted for API clients |
| Payments | Gateway interface → Razorpay adapter + MockPay dev adapter | new gateways (Cashfree/Stripe) = one new adapter |
| Notifications | Hub service → in-app + email senders | SMS/push/WhatsApp plug in at one point |
| Storage | Provider interface → local disk (dev) / S3-compatible | DB stores URLs only |

## Database notes

- **No native enums.** Status/type columns are plain strings; the canonical
  unions and state machines live in `@shopcraft/shared` and are enforced in the
  services. This lets a new status ship without a schema migration.
- **Referential actions are `NoAction`** — inherited from the SQL Server origin
  (it rejects multiple cascade paths) and kept deliberately: deletion is soft
  (`deletedAt`) everywhere it matters, so cascades would be wrong anyway.
- **JSON payloads are `@db.Text`**, (de)serialized in `common/utils.ts`. They
  could become `Json` columns now that the target is Postgres; they are left as
  text because nothing queries inside them.
- **Raw SQL quotes every identifier** (`UPDATE "ProductVariant" SET "stockOnHand" …`).
  Postgres folds unquoted identifiers to lowercase, so the camelCase table and
  column names Prisma creates *must* stay quoted. Same for output aliases that
  the TypeScript reads back by name.

### Migrating from the original SQL Server schema

The SQL Server migrations are in git history before the Postgres switch. The
changes required were: the datasource provider, `NVarChar(Max)` → `Text`,
dropping the filtered-unique-index workaround (SQL Server permits only one NULL
per unique constraint, so nullable uniques like `User.email` needed
`WHERE col IS NOT NULL` indexes — Postgres allows many NULLs natively), and
rewriting `[bracket]`/`TOP n` raw SQL as quoted identifiers with `LIMIT`.

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
