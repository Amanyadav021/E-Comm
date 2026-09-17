import { z } from 'zod';
import { DISCOUNT_TYPES, APPLIES_TO, PRODUCT_STATUSES, BANNER_PLACEMENTS, HOME_SECTION_TYPES } from './constants';

// ---------------- Auth ----------------

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(10),
});

export const otpRequestSchema = z.object({
  phone: phoneSchema,
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  name: z.string().trim().min(2).max(80).optional(),
});

// ---------------- Address ----------------

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  area: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  country: z.string().trim().max(60).default('India'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  type: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
  isDefault: z.boolean().default(false),
});

// ---------------- Cart / checkout ----------------

export const cartAddSchema = z.object({
  variantId: z.string().min(1),
  qty: z.number().int().min(1).max(10).default(1),
});

export const cartUpdateSchema = z.object({
  qty: z.number().int().min(0).max(10),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(2).max(40).toUpperCase(),
});

export const checkoutSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(['upi', 'card', 'netbanking', 'wallet', 'cod']),
  customerNote: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().min(8).max(80),
});

export const paymentVerifySchema = z.object({
  orderId: z.string().min(1),
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

// ---------------- Reviews ----------------

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(4000).optional(),
});

// ---------------- Returns ----------------

export const returnRequestSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
  comments: z.string().trim().max(2000).optional(),
  items: z
    .array(z.object({ orderItemId: z.string().min(1), qty: z.number().int().min(1) }))
    .min(1),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3).max(200),
});

// ---------------- Admin: catalog ----------------

export const variantInputSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(2).max(60),
  name: z.string().trim().max(120).optional().nullable(),
  options: z.record(z.string(), z.string()).optional().nullable(),
  mrp: z.number().positive(),
  price: z.number().positive(),
  costPrice: z.number().positive().optional().nullable(),
  weightGrams: z.number().int().positive().optional().nullable(),
  dimensions: z.string().max(80).optional().nullable(),
  stockOnHand: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).refine((v) => v.price <= v.mrp, { message: 'Selling price cannot exceed MRP', path: ['price'] });

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(220).optional(),
  sku: z.string().trim().min(2).max(60),
  categoryId: z.string().min(1),
  brandId: z.string().optional().nullable(),
  description: z.string().min(10),
  shortDescription: z.string().max(500).optional().nullable(),
  specifications: z
    .array(z.object({
      group: z.string().max(80),
      items: z.array(z.object({ label: z.string().max(80), value: z.string().max(400) })),
    }))
    .optional()
    .nullable(),
  features: z.array(z.string().max(300)).optional().nullable(),
  optionTypes: z.array(z.string().max(40)).optional().nullable(),
  warranty: z.string().max(200).optional().nullable(),
  returnPolicy: z.string().max(500).optional().nullable(),
  returnWindowDays: z.number().int().min(0).max(90).default(7),
  isReturnable: z.boolean().default(true),
  codAvailable: z.boolean().default(true),
  taxRatePct: z.number().min(0).max(28).default(18),
  status: z.enum(PRODUCT_STATUSES).default('DRAFT'),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().max(120).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  seoKeywords: z.string().max(300).optional().nullable(),
  variants: z.array(variantInputSchema).min(1),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  iconName: z.string().max(40).optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(),
  logoUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

// ---------------- Admin: inventory ----------------

export const stockAdjustSchema = z.object({
  variantId: z.string().min(1),
  qty: z.number().int().refine((n) => n !== 0, 'Quantity cannot be zero'),
  type: z.enum(['RESTOCK', 'ADJUSTMENT']),
  reason: z.string().trim().max(300).optional(),
});

// ---------------- Admin: marketing ----------------

export const couponInputSchema = z.object({
  code: z.string().trim().min(2).max(40).toUpperCase(),
  description: z.string().max(300).optional().nullable(),
  type: z.enum(DISCOUNT_TYPES),
  value: z.number().positive(),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscount: z.number().positive().optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().default(1),
  firstOrderOnly: z.boolean().default(false),
  appliesTo: z.enum(APPLIES_TO).default('ALL'),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export const offerInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  badgeText: z.string().max(40).optional().nullable(),
  type: z.enum(DISCOUNT_TYPES),
  value: z.number().positive(),
  maxDiscount: z.number().positive().optional().nullable(),
  appliesTo: z.enum(APPLIES_TO).default('ALL'),
  priority: z.number().int().default(0),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  isFlashSale: z.boolean().default(false),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export const bannerInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().max(200).optional().nullable(),
  imageUrl: z.string().min(1),
  mobileImageUrl: z.string().optional().nullable(),
  linkUrl: z.string().optional().nullable(),
  placement: z.enum(BANNER_PLACEMENTS).default('HERO'),
  sortOrder: z.number().int().default(0),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const homeSectionInputSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]+$/).max(60),
  title: z.string().trim().min(2).max(120),
  type: z.enum(HOME_SECTION_TYPES),
  config: z.record(z.string(), z.any()).optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// ---------------- Admin: shipping ----------------

export const shippingZoneInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  fee: z.number().min(0),
  freeAbove: z.number().min(0).optional().nullable(),
  minDeliveryDays: z.number().int().min(0).max(60).default(3),
  maxDeliveryDays: z.number().int().min(0).max(60).default(7),
  codAvailable: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  pincodes: z.array(z.string().trim().regex(/^\d{2,6}\*?$/)).default([]),
});

// ---------------- Admin: order/status ----------------

export const orderStatusUpdateSchema = z.object({
  status: z.string().min(1),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(80).optional(),
  courierName: z.string().max(80).optional(),
});

export const refundInputSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().max(300).optional(),
});

// ---------------- Shared query helpers ----------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type CouponInputDto = z.infer<typeof couponInputSchema>;
export type OfferInputDto = z.infer<typeof offerInputSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
