// Canonical status/type unions for the whole platform.
// The database stores these as strings (SQL Server has no Prisma enums);
// this module is the single source of truth for what values are valid.

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'CONFIRMED', // payment verified (or COD accepted)
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'CREATED',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const RETURN_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'REFUND_PROCESSING',
  'COMPLETED',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DISCOUNT_TYPES = ['PERCENT', 'FLAT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const APPLIES_TO = ['ALL', 'CATEGORY', 'PRODUCT'] as const;
export type AppliesTo = (typeof APPLIES_TO)[number];

export const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'wallet', 'cod'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INVENTORY_TXN_TYPES = [
  'RESTOCK',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'RESERVE',
  'RELEASE',
] as const;
export type InventoryTxnType = (typeof INVENTORY_TXN_TYPES)[number];

export const NOTIFICATION_TYPES = [
  // customer
  'ORDER_PLACED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'ORDER_PACKED',
  'ORDER_SHIPPED',
  'ORDER_OUT_FOR_DELIVERY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'RETURN_UPDATE',
  'REFUND_PROCESSED',
  'PROMO',
  'PRICE_DROP',
  'BACK_IN_STOCK',
  // admin
  'NEW_ORDER',
  'PAYMENT_RECEIVED',
  'ADMIN_PAYMENT_FAILED',
  'ORDER_CANCELLED_ADMIN',
  'RETURN_REQUESTED_ADMIN',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'NEW_CUSTOMER',
  'NEW_REVIEW',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const BANNER_PLACEMENTS = ['HERO', 'PROMO', 'STRIP'] as const;
export const HOME_SECTION_TYPES = [
  'FLASH_DEALS',
  'TRENDING',
  'NEW_ARRIVALS',
  'BEST_SELLERS',
  'TOP_RATED',
  'FEATURED_CATEGORIES',
  'FEATURED_BRANDS',
  'CUSTOM_PRODUCTS',
  'RECENTLY_VIEWED',
] as const;

// ---------------- RBAC ----------------

export const PERMISSIONS = [
  'dashboard.view',
  'products.read', 'products.write',
  'inventory.read', 'inventory.write',
  'orders.read', 'orders.write',
  'customers.read', 'customers.write',
  'payments.read', 'payments.write',
  'refunds.write',
  'marketing.read', 'marketing.write',
  'reviews.read', 'reviews.write',
  'reports.read',
  'content.read', 'content.write',
  'shipping.read', 'shipping.write',
  'settings.read', 'settings.write',
  'roles.write',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_DEFINITIONS: Record<string, { label: string; permissions: Permission[] | '*' }> = {
  SUPER_ADMIN: { label: 'Super Admin', permissions: '*' },
  ADMIN: {
    label: 'Admin',
    permissions: [
      'dashboard.view',
      'products.read', 'products.write',
      'inventory.read', 'inventory.write',
      'orders.read', 'orders.write',
      'customers.read', 'customers.write',
      'payments.read', 'payments.write', 'refunds.write',
      'marketing.read', 'marketing.write',
      'reviews.read', 'reviews.write',
      'reports.read',
      'content.read', 'content.write',
      'shipping.read', 'shipping.write',
      'settings.read',
      'audit.read',
    ],
  },
  INVENTORY_MANAGER: {
    label: 'Inventory Manager',
    permissions: ['dashboard.view', 'products.read', 'inventory.read', 'inventory.write', 'reports.read'],
  },
  ORDER_MANAGER: {
    label: 'Order Manager',
    permissions: ['dashboard.view', 'orders.read', 'orders.write', 'customers.read', 'payments.read', 'reports.read', 'shipping.read'],
  },
  SUPPORT: {
    label: 'Customer Support',
    permissions: ['dashboard.view', 'orders.read', 'customers.read', 'reviews.read', 'reviews.write'],
  },
  MARKETING_MANAGER: {
    label: 'Marketing Manager',
    permissions: ['dashboard.view', 'marketing.read', 'marketing.write', 'content.read', 'content.write', 'products.read', 'reports.read'],
  },
  CUSTOMER: { label: 'Customer', permissions: [] },
};

export const ADMIN_ROLES = Object.keys(ROLE_DEFINITIONS).filter((r) => r !== 'CUSTOMER');

// ---------------- Misc ----------------

export const CURRENCY = 'INR';
export const DEFAULT_TAX_RATE_PCT = 18; // GST, prices are tax-INCLUSIVE
export const MAX_CART_QTY_PER_ITEM = 10;
export const ORDER_NUMBER_PREFIX = 'SC';
