/**
 * ShopCraft seed — realistic demo data, clearly labelled as such.
 *
 *   npm run db:seed
 *
 * Idempotent: roles/settings/zones are upserted; catalog and demo orders are
 * only created when the database has no products yet.
 *
 * Accounts created (DEV ONLY — change in production):
 *   Super Admin : admin@shopcraft.local  / Admin@12345
 *   Customer    : demo@shopcraft.local   / Demo@12345
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ROLE_DEFINITIONS } from '@shopcraft/shared';

const prisma = new PrismaClient();
const API_URL = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
const UPLOADS = join(__dirname, '..', 'uploads', 'seed');

// ---------------- SVG image generation (offline-friendly demo images) ----------------

const PALETTES = [
  ['#6366f1', '#8b5cf6'], ['#0ea5e9', '#6366f1'], ['#10b981', '#0ea5e9'],
  ['#f59e0b', '#ef4444'], ['#ec4899', '#8b5cf6'], ['#14b8a6', '#10b981'],
  ['#f97316', '#f59e0b'], ['#64748b', '#334155'],
];

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

async function productImage(slug: string, label: string, emoji: string): Promise<string> {
  const [c1, c2] = PALETTES[hash(slug) % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#g)"/>
<circle cx="400" cy="340" r="170" fill="rgba(255,255,255,0.18)"/>
<text x="400" y="400" font-size="170" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
<text x="400" y="620" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="600" fill="rgba(255,255,255,0.95)" text-anchor="middle">${label}</text>
<text x="400" y="668" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.7)" text-anchor="middle">Demo product image</text>
</svg>`;
  await fs.writeFile(join(UPLOADS, `${slug}.svg`), svg, 'utf8');
  return `${API_URL}/uploads/seed/${slug}.svg`;
}

async function bannerImage(slug: string, title: string, subtitle: string, emoji: string, wide = true): Promise<string> {
  const [c1, c2] = PALETTES[hash(slug) % PALETTES.length];
  const w = wide ? 1600 : 800;
  const h = wide ? 520 : 520;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${w - 220}" cy="${h / 2}" r="190" fill="rgba(255,255,255,0.14)"/>
<text x="${w - 220}" y="${h / 2 + 12}" font-size="150" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
<text x="90" y="${h / 2 - 30}" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${title}</text>
<text x="90" y="${h / 2 + 40}" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="rgba(255,255,255,0.85)">${subtitle}</text>
</svg>`;
  await fs.writeFile(join(UPLOADS, `${slug}.svg`), svg, 'utf8');
  return `${API_URL}/uploads/seed/${slug}.svg`;
}

// ---------------- Seed steps ----------------

async function seedRoles() {
  for (const [name, def] of Object.entries(ROLE_DEFINITIONS)) {
    await prisma.role.upsert({
      where: { name },
      create: { name, label: def.label, permissions: JSON.stringify(def.permissions), isSystem: true },
      update: { label: def.label },
    });
  }
  console.log('✔ Roles');
}

async function findOrCreateUser(email: string, name: string, password: string, role: string) {
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerifiedAt: new Date(),
      roles: { create: { role: { connect: { name: role } } } },
    },
  });
}

async function seedUsers() {
  const admin = await findOrCreateUser('admin@shopcraft.local', 'Store Admin', 'Admin@12345', 'SUPER_ADMIN');
  const demo = await findOrCreateUser('demo@shopcraft.local', 'Demo Customer', 'Demo@12345', 'CUSTOMER');
  console.log('✔ Users (admin@shopcraft.local / demo@shopcraft.local)');
  return { admin, demo };
}

async function seedSettings() {
  const settings: Array<[string, unknown, string]> = [
    ['store.name', 'ShopCraft', 'store'],
    ['store.tagline', 'Everything you love, delivered fast', 'store'],
    ['store.supportEmail', 'support@shopcraft.local', 'store'],
    ['store.supportPhone', '+91 98765 43210', 'store'],
    ['store.currency', 'INR', 'store'],
    ['store.country', 'India', 'store'],
    ['store.timezone', 'Asia/Kolkata', 'store'],
    ['tax.pricesIncludeGst', true, 'tax'],
    ['tax.defaultGstRatePct', 18, 'tax'],
    ['tax.gstin', '', 'tax'],
    ['payment.codEnabled', true, 'payment'],
    ['payment.provider', process.env.PAYMENT_PROVIDER ?? 'mock', 'payment'],
    ['notifications.emailEnabled', true, 'notifications'],
    ['notifications.smsEnabled', false, 'notifications'],
  ];
  for (const [key, value, group] of settings) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value), group },
      update: {},
    });
  }
  console.log('✔ Settings');
}

async function seedShipping() {
  const existing = await prisma.shippingZone.count();
  if (existing > 0) return;
  const metro = await prisma.shippingZone.create({
    data: {
      name: 'Metro Cities', fee: 40, freeAbove: 499, minDeliveryDays: 2, maxDeliveryDays: 4,
      codAvailable: true, isDefault: false, isActive: true,
    },
  });
  await prisma.zonePincode.createMany({
    data: ['11*', '40*', '56*', '60*', '70*', '50*'].map((pincode) => ({ zoneId: metro.id, pincode })),
  });
  await prisma.shippingZone.create({
    data: {
      name: 'Rest of India', fee: 70, freeAbove: 999, minDeliveryDays: 4, maxDeliveryDays: 8,
      codAvailable: true, isDefault: true, isActive: true,
    },
  });
  console.log('✔ Shipping zones');
}

interface ProductSpec {
  name: string; emoji: string; category: string; brand: string;
  mrp: number; price: number; short: string; featured?: boolean; taxRate?: number;
  options?: { type: string; values: Array<{ value: string; priceDelta?: number }> };
  stock?: number;
}

async function seedCatalog(adminId: string) {
  if ((await prisma.product.count()) > 0) {
    console.log('↷ Catalog already seeded — skipping');
    return;
  }

  // Categories
  const cats: Array<{ name: string; slug: string; icon: string; featured?: boolean; children?: Array<{ name: string; slug: string; icon: string }> }> = [
    { name: 'Electronics', slug: 'electronics', icon: 'smartphone', featured: true, children: [
      { name: 'Mobiles', slug: 'mobiles', icon: 'smartphone' },
      { name: 'Laptops', slug: 'laptops', icon: 'laptop' },
      { name: 'Audio', slug: 'audio', icon: 'headphones' },
      { name: 'Wearables', slug: 'wearables', icon: 'watch' },
    ]},
    { name: 'Fashion', slug: 'fashion', icon: 'shirt', featured: true, children: [
      { name: 'Men', slug: 'men-fashion', icon: 'shirt' },
      { name: 'Women', slug: 'women-fashion', icon: 'shopping-bag' },
      { name: 'Footwear', slug: 'footwear', icon: 'footprints' },
    ]},
    { name: 'Home & Kitchen', slug: 'home-kitchen', icon: 'home', featured: true, children: [
      { name: 'Appliances', slug: 'appliances', icon: 'refrigerator' },
      { name: 'Decor', slug: 'decor', icon: 'lamp' },
    ]},
    { name: 'Beauty', slug: 'beauty', icon: 'sparkles', featured: true },
    { name: 'Sports & Fitness', slug: 'sports-fitness', icon: 'dumbbell', featured: true },
  ];
  const catIds = new Map<string, string>();
  for (const [i, c] of cats.entries()) {
    const img = await productImage(`cat-${c.slug}`, c.name, c.icon === 'smartphone' ? '📱' : c.icon === 'shirt' ? '👕' : c.icon === 'home' ? '🏠' : c.icon === 'sparkles' ? '✨' : '🏋️');
    const parent = await prisma.category.create({
      data: { name: c.name, slug: c.slug, iconName: c.icon, imageUrl: img, sortOrder: i, isFeatured: !!c.featured },
    });
    catIds.set(c.slug, parent.id);
    for (const [j, child] of (c.children ?? []).entries()) {
      const sub = await prisma.category.create({
        data: { name: child.name, slug: child.slug, iconName: child.icon, parentId: parent.id, sortOrder: j },
      });
      catIds.set(child.slug, sub.id);
    }
  }

  // Brands (fictional)
  const brandNames = ['Novex', 'AuraBeat', 'PixelForge', 'UrbanWeave', 'Stryde', 'HomeNest', 'ZenCook', 'GlowLab', 'TrailBlaze', 'CloudNine'];
  const brandIds = new Map<string, string>();
  for (const name of brandNames) {
    const slug = name.toLowerCase();
    const brand = await prisma.brand.create({
      data: { name, slug, logoUrl: await productImage(`brand-${slug}`, name, '🏷️'), isFeatured: ['Novex', 'AuraBeat', 'UrbanWeave', 'HomeNest'].includes(name) },
    });
    brandIds.set(name, brand.id);
  }

  const products: ProductSpec[] = [
    { name: 'Novex Nova 5G Smartphone', emoji: '📱', category: 'mobiles', brand: 'Novex', mrp: 24999, price: 18999, short: '6.6" AMOLED · 50MP camera · 5000mAh', featured: true,
      options: { type: 'Storage', values: [{ value: '128GB' }, { value: '256GB', priceDelta: 2000 }] } },
    { name: 'Novex Prime Max', emoji: '📱', category: 'mobiles', brand: 'Novex', mrp: 42999, price: 36999, short: 'Flagship · 120Hz · 200MP camera', featured: true,
      options: { type: 'Color', values: [{ value: 'Midnight Black' }, { value: 'Ocean Blue' }] } },
    { name: 'PixelForge Book Air 14', emoji: '💻', category: 'laptops', brand: 'PixelForge', mrp: 64999, price: 54999, short: '14" 2.8K · 16GB RAM · 512GB SSD', featured: true },
    { name: 'PixelForge Creator Pro 16', emoji: '💻', category: 'laptops', brand: 'PixelForge', mrp: 129999, price: 114999, short: '16" 4K OLED · RTX GPU · 32GB RAM' },
    { name: 'AuraBeat Pods Pro', emoji: '🎧', category: 'audio', brand: 'AuraBeat', mrp: 7999, price: 4999, short: 'ANC · 36h battery · Spatial audio', featured: true,
      options: { type: 'Color', values: [{ value: 'White' }, { value: 'Black' }] } },
    { name: 'AuraBeat Studio Headphones', emoji: '🎧', category: 'audio', brand: 'AuraBeat', mrp: 14999, price: 10999, short: 'Over-ear · Hi-Res · 50h battery' },
    { name: 'AuraBeat Boom Speaker', emoji: '🔊', category: 'audio', brand: 'AuraBeat', mrp: 5999, price: 3799, short: 'IPX7 · 24W · Party lights' },
    { name: 'Novex Fit Watch S', emoji: '⌚', category: 'wearables', brand: 'Novex', mrp: 6999, price: 3999, short: 'AMOLED · SpO2 · 14-day battery', featured: true,
      options: { type: 'Color', values: [{ value: 'Black' }, { value: 'Rose Gold' }, { value: 'Teal' }] } },
    { name: 'UrbanWeave Oxford Shirt', emoji: '👔', category: 'men-fashion', brand: 'UrbanWeave', mrp: 2499, price: 1399, short: '100% cotton · Slim fit', taxRate: 12,
      options: { type: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }] } },
    { name: 'UrbanWeave Denim Jacket', emoji: '🧥', category: 'men-fashion', brand: 'UrbanWeave', mrp: 3999, price: 2599, short: 'Washed denim · All-season', taxRate: 12,
      options: { type: 'Size', values: [{ value: 'M' }, { value: 'L' }, { value: 'XL' }] } },
    { name: 'CloudNine Floral Midi Dress', emoji: '👗', category: 'women-fashion', brand: 'CloudNine', mrp: 3299, price: 1899, short: 'Rayon · Fit & flare', taxRate: 12, featured: true,
      options: { type: 'Size', values: [{ value: 'XS' }, { value: 'S' }, { value: 'M' }, { value: 'L' }] } },
    { name: 'CloudNine Everyday Kurta Set', emoji: '👘', category: 'women-fashion', brand: 'CloudNine', mrp: 2799, price: 1499, short: 'Cotton · 3-piece set', taxRate: 12,
      options: { type: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] } },
    { name: 'Stryde Runner Flex', emoji: '👟', category: 'footwear', brand: 'Stryde', mrp: 4999, price: 2999, short: 'Foam cushioning · Breathable knit', featured: true,
      options: { type: 'Size', values: [{ value: 'UK 7' }, { value: 'UK 8' }, { value: 'UK 9' }, { value: 'UK 10' }] } },
    { name: 'Stryde Court Classic', emoji: '👟', category: 'footwear', brand: 'Stryde', mrp: 3499, price: 2099, short: 'Retro sneaker · Leather finish',
      options: { type: 'Size', values: [{ value: 'UK 7' }, { value: 'UK 8' }, { value: 'UK 9' }] } },
    { name: 'ZenCook Air Fryer 5L', emoji: '🍟', category: 'appliances', brand: 'ZenCook', mrp: 9999, price: 6499, short: '1500W · 8 presets · Digital display', featured: true },
    { name: 'ZenCook Mixer Grinder Pro', emoji: '🥤', category: 'appliances', brand: 'ZenCook', mrp: 5499, price: 3299, short: '750W · 4 jars · 5-yr motor warranty' },
    { name: 'HomeNest Cotton King Bedsheet', emoji: '🛏️', category: 'decor', brand: 'HomeNest', mrp: 2999, price: 1599, short: '300 TC · King size · 2 pillow covers', taxRate: 12 },
    { name: 'HomeNest Aroma Diffuser', emoji: '🕯️', category: 'decor', brand: 'HomeNest', mrp: 2499, price: 1299, short: 'Ultrasonic · 7 LED colors · Timer' },
    { name: 'GlowLab Vitamin C Serum', emoji: '🧴', category: 'beauty', brand: 'GlowLab', mrp: 999, price: 599, short: '20% Vit C + E · 30ml', featured: true },
    { name: 'GlowLab Sunscreen SPF50', emoji: '🌞', category: 'beauty', brand: 'GlowLab', mrp: 749, price: 449, short: 'Matte finish · No white cast · 50g' },
    { name: 'TrailBlaze Yoga Mat Pro', emoji: '🧘', category: 'sports-fitness', brand: 'TrailBlaze', mrp: 2499, price: 1399, short: '6mm TPE · Non-slip · Carry strap' },
    { name: 'TrailBlaze Adjustable Dumbbells', emoji: '🏋️', category: 'sports-fitness', brand: 'TrailBlaze', mrp: 7999, price: 5499, short: '2.5–24kg pair · Quick-lock' },
    { name: 'TrailBlaze Trekking Backpack 45L', emoji: '🎒', category: 'sports-fitness', brand: 'TrailBlaze', mrp: 4499, price: 2699, short: 'Rain cover · Ventilated back', featured: true },
    { name: 'Novex SmartTab 11', emoji: '📱', category: 'mobiles', brand: 'Novex', mrp: 28999, price: 23999, short: '11" 2K · Quad speakers · Stylus support' },
  ];

  const skuBase = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

  for (const [i, p] of products.entries()) {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const img1 = await productImage(slug, p.name, p.emoji);
    const img2 = await productImage(`${slug}-alt`, p.name, p.emoji);
    const stock = p.stock ?? 20 + ((i * 7) % 40);
    const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);

    const variants = p.options
      ? p.options.values.map((v, vi) => ({
          sku: `${skuBase(p.name)}-${v.value.replace(/[^A-Za-z0-9]+/g, '')}`.toUpperCase(),
          name: v.value,
          options: JSON.stringify({ [p.options!.type]: v.value }),
          mrp: p.mrp + (v.priceDelta ?? 0),
          price: p.price + (v.priceDelta ?? 0),
          stockOnHand: Math.max(3, stock - vi * 4),
          lowStockThreshold: 5,
          isDefault: vi === 0,
        }))
      : [{
          sku: skuBase(p.name),
          name: null as string | null,
          options: null as string | null,
          mrp: p.mrp,
          price: p.price,
          stockOnHand: stock,
          lowStockThreshold: 5,
          isDefault: true,
        }];

    await prisma.product.create({
      data: {
        name: p.name,
        slug,
        sku: `P-${skuBase(p.name)}`,
        categoryId: catIds.get(p.category)!,
        brandId: brandIds.get(p.brand)!,
        description: `${p.name} — ${p.short}. This is realistic demo data seeded for development. The ${p.name} from ${p.brand} combines thoughtful design with dependable everyday performance, backed by a standard manufacturer warranty and a hassle-free return window.`,
        shortDescription: p.short,
        specifications: JSON.stringify([
          { group: 'General', items: [
            { label: 'Brand', value: p.brand },
            { label: 'Model', value: p.name },
            { label: 'In the box', value: `1 × ${p.name}, documentation` },
          ]},
          { group: 'Highlights', items: p.short.split('·').map((s) => ({ label: '•', value: s.trim() })) },
        ]),
        features: JSON.stringify(p.short.split('·').map((s) => s.trim())),
        optionTypes: p.options ? JSON.stringify([p.options.type]) : null,
        warranty: '1 year manufacturer warranty',
        returnPolicy: '7-day easy returns',
        returnWindowDays: 7,
        taxRatePct: p.taxRate ?? 18,
        status: 'ACTIVE',
        isFeatured: !!p.featured,
        minPrice: Math.min(...variants.map((v) => v.price)),
        maxMrp: Math.max(...variants.map((v) => v.mrp)),
        discountPct: discount,
        viewCount: 40 + ((i * 37) % 400),
        publishedAt: new Date(Date.now() - i * 86400000),
        seoTitle: `${p.name} — Buy Online at Best Price | ShopCraft`,
        seoDescription: `Buy ${p.name} (${p.short}) online at ShopCraft. Fast delivery, easy returns.`,
        images: { create: [
          { url: img1, alt: p.name, sortOrder: 0, isPrimary: true },
          { url: img2, alt: `${p.name} — alternate view`, sortOrder: 1 },
        ]},
        variants: { create: variants },
      },
    });
  }

  // Initial inventory transactions + price history
  const allVariants = await prisma.productVariant.findMany();
  for (const v of allVariants) {
    await prisma.inventoryTransaction.create({
      data: { variantId: v.id, type: 'RESTOCK', qty: v.stockOnHand, balanceAfter: v.stockOnHand, actorId: adminId, reason: 'Initial stock (seed)' },
    });
    await prisma.priceHistory.create({
      data: { variantId: v.id, mrp: v.mrp, price: v.price, changedById: adminId },
    });
  }
  console.log(`✔ Catalog (${products.length} products)`);
}

async function seedMarketing() {
  if ((await prisma.coupon.count()) > 0) return;
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', description: '10% off your first order (up to ₹200)', type: 'PERCENT', value: 10, minOrderAmount: 499, maxDiscount: 200, firstOrderOnly: true, perUserLimit: 1, appliesTo: 'ALL', isActive: true },
      { code: 'FLAT100', description: '₹100 off orders above ₹999', type: 'FLAT', value: 100, minOrderAmount: 999, perUserLimit: 3, appliesTo: 'ALL', isActive: true },
      { code: 'FESTIVE20', description: '20% off (up to ₹500) — festive season', type: 'PERCENT', value: 20, minOrderAmount: 1499, maxDiscount: 500, perUserLimit: 2, appliesTo: 'ALL', isActive: true, endsAt: new Date(Date.now() + 30 * 86400000) },
    ],
  });

  const electronics = await prisma.category.findUnique({ where: { slug: 'electronics' } });
  const audio = await prisma.category.findUnique({ where: { slug: 'audio' } });
  const flash = await prisma.offer.create({
    data: {
      title: 'Electronics Flash Sale', badgeText: 'Flash Sale', type: 'PERCENT', value: 10, maxDiscount: 3000,
      appliesTo: 'CATEGORY', priority: 10, isFlashSale: true, isActive: true,
      endsAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  const ids = [electronics?.id, audio?.id].filter((x): x is string => !!x);
  // include subtree of electronics
  const children = electronics ? await prisma.category.findMany({ where: { parentId: electronics.id } }) : [];
  const allIds = Array.from(new Set([...ids, ...children.map((c) => c.id)]));
  await prisma.offerCategory.createMany({ data: allIds.map((categoryId) => ({ offerId: flash.id, categoryId })) });
  console.log('✔ Coupons & offers');
}

async function seedContent() {
  if ((await prisma.banner.count()) > 0) return;
  const heroes = [
    ['hero-festive', 'The Big Festive Sale', 'Up to 60% off across categories', '🎉', '/products?minDiscount=30'],
    ['hero-electronics', 'Electronics Flash Sale', 'Extra 10% off — this week only', '⚡', '/category/electronics'],
    ['hero-fashion', 'New Season, New Style', 'Fresh fashion drops from ₹499', '👗', '/category/fashion'],
  ] as const;
  for (const [i, [slug, title, subtitle, emoji, link]] of heroes.entries()) {
    await prisma.banner.create({
      data: {
        title, subtitle, placement: 'HERO', sortOrder: i, linkUrl: link,
        imageUrl: await bannerImage(slug, title, subtitle, emoji),
        mobileImageUrl: await bannerImage(`${slug}-m`, title, subtitle, emoji, false),
      },
    });
  }
  const promos = [
    ['promo-beauty', 'Beauty Bestsellers', 'Skincare from ₹399', '🧴', '/category/beauty'],
    ['promo-home', 'Home Makeover', 'Decor & appliances deals', '🏠', '/category/home-kitchen'],
  ] as const;
  for (const [i, [slug, title, subtitle, emoji, link]] of promos.entries()) {
    await prisma.banner.create({
      data: {
        title, subtitle, placement: 'PROMO', sortOrder: i, linkUrl: link,
        imageUrl: await bannerImage(slug, title, subtitle, emoji, false),
      },
    });
  }

  const sections = [
    { key: 'featured-categories', title: 'Shop by Category', type: 'FEATURED_CATEGORIES', sortOrder: 0 },
    { key: 'flash-deals', title: 'Flash Deals', type: 'FLASH_DEALS', sortOrder: 1, config: JSON.stringify({ minDiscount: 20, limit: 10 }) },
    { key: 'trending', title: 'Trending Now', type: 'TRENDING', sortOrder: 2 },
    { key: 'new-arrivals', title: 'New Arrivals', type: 'NEW_ARRIVALS', sortOrder: 3 },
    { key: 'best-sellers', title: 'Best Sellers', type: 'BEST_SELLERS', sortOrder: 4 },
    { key: 'top-rated', title: 'Top Rated', type: 'TOP_RATED', sortOrder: 5 },
    { key: 'featured-brands', title: 'Featured Brands', type: 'FEATURED_BRANDS', sortOrder: 6 },
    { key: 'recently-viewed', title: 'Recently Viewed', type: 'RECENTLY_VIEWED', sortOrder: 7 },
  ];
  for (const s of sections) {
    await prisma.homeSection.create({ data: s });
  }
  console.log('✔ Banners & homepage sections');
}

/** A few completed demo orders so dashboards, reviews and reports have data. */
async function seedDemoOrders(demoUserId: string) {
  if ((await prisma.order.count()) > 0) return;
  const address = await prisma.address.create({
    data: {
      userId: demoUserId, fullName: 'Demo Customer', phone: '9876543210',
      line1: '221B Residency Road', area: 'Shanti Nagar', city: 'Bengaluru', state: 'Karnataka',
      pincode: '560025', type: 'HOME', isDefault: true,
    },
  });
  const snapshot = JSON.stringify({
    fullName: address.fullName, phone: address.phone, line1: address.line1, line2: null,
    area: address.area, city: address.city, state: address.state, country: 'India',
    pincode: address.pincode, type: 'HOME',
  });

  const picks = await prisma.product.findMany({ take: 6, include: { variants: true, images: { take: 1 } } });
  let n = 1;
  for (const [i, product] of picks.entries()) {
    const variant = product.variants[0];
    const qty = 1 + (i % 2);
    const unitPrice = Number(variant.price);
    const lineTotal = unitPrice * qty;
    const shippingFee = lineTotal >= 999 ? 0 : 70;
    const total = lineTotal + shippingFee;
    const daysAgo = 25 - i * 4;
    const placedAt = new Date(Date.now() - daysAgo * 86400000);
    const delivered = i < 4;
    const status = delivered ? 'DELIVERED' : i === 4 ? 'SHIPPED' : 'PROCESSING';

    const order = await prisma.order.create({
      data: {
        orderNumber: `SC-DEMO-${String(n++).padStart(4, '0')}`,
        userId: demoUserId,
        status,
        paymentStatus: 'SUCCESS',
        paymentMethod: i % 2 === 0 ? 'upi' : 'card',
        shippingAddress: snapshot,
        subtotal: Number(variant.mrp) * qty,
        productDiscount: (Number(variant.mrp) - unitPrice) * qty,
        shippingFee,
        taxAmount: Math.round(((lineTotal * 18) / 118) * 100) / 100,
        total,
        placedAt,
        confirmedAt: placedAt,
        shippedAt: ['SHIPPED', 'DELIVERED'].includes(status) ? new Date(placedAt.getTime() + 86400000) : null,
        deliveredAt: delivered ? new Date(placedAt.getTime() + 3 * 86400000) : null,
        expectedDeliveryAt: new Date(placedAt.getTime() + 5 * 86400000),
        items: { create: [{
          productId: product.id,
          variantId: variant.id,
          nameSnapshot: product.name,
          skuSnapshot: variant.sku,
          imageSnapshot: product.images[0]?.url ?? null,
          optionsSnapshot: variant.options,
          unitMrp: variant.mrp,
          unitPrice,
          qty,
          lineTotal,
          taxRatePct: product.taxRatePct,
        }]},
        statusHistory: { create: [
          { fromStatus: null, toStatus: 'PENDING_PAYMENT', note: 'Order placed (seed)', createdAt: placedAt },
          { fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', note: 'Payment verified (seed)', createdAt: placedAt },
          ...(delivered ? [{ fromStatus: 'CONFIRMED', toStatus: 'DELIVERED' as string, note: 'Delivered (seed)', createdAt: new Date(placedAt.getTime() + 3 * 86400000) }] : []),
        ]},
        payments: { create: [{
          provider: 'mock', providerOrderId: `mockord_seed_${i}`, providerPaymentId: `mockpay_seed_${i}`,
          amount: total, status: 'SUCCESS', method: i % 2 === 0 ? 'upi' : 'card', verifiedAt: placedAt, createdAt: placedAt,
        }]},
      },
    });

    await prisma.product.update({ where: { id: product.id }, data: { soldCount: { increment: qty } } });
    await prisma.productVariant.update({ where: { id: variant.id }, data: { stockOnHand: { decrement: qty } } });
    await prisma.inventoryTransaction.create({
      data: { variantId: variant.id, type: 'SALE', qty: -qty, balanceAfter: variant.stockOnHand - qty, orderId: order.id, reason: 'Seed order' },
    });

    if (delivered) {
      const item = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
      await prisma.review.create({
        data: {
          userId: demoUserId, productId: product.id, orderItemId: item?.id,
          rating: 4 + (i % 2), title: 'Really happy with this!',
          body: `The ${product.name} exceeded my expectations. Great value for money and quick delivery. (Demo review)`,
          status: 'APPROVED', isVerified: true, createdAt: new Date(placedAt.getTime() + 4 * 86400000),
        },
      });
      const agg = await prisma.review.aggregate({ where: { productId: product.id, status: { in: ['APPROVED', 'PENDING'] }, deletedAt: null }, _avg: { rating: true }, _count: { _all: true } });
      await prisma.product.update({ where: { id: product.id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all, reviewCount: agg._count._all } });
    }
  }

  await prisma.searchQuery.createMany({
    data: [
      { term: 'smartphone', count: 42 }, { term: 'headphones', count: 31 }, { term: 'air fryer', count: 18 },
      { term: 'running shoes', count: 25 }, { term: 'serum', count: 12 }, { term: 'yoga mat', count: 9 },
    ],
  });
  console.log('✔ Demo orders, reviews & searches');
}

async function main() {
  await fs.mkdir(UPLOADS, { recursive: true });
  await seedRoles();
  const { admin, demo } = await seedUsers();
  await seedSettings();
  await seedShipping();
  await seedCatalog(admin.id);
  await seedMarketing();
  await seedContent();
  await seedDemoOrders(demo.id);
  console.log('\nSeed complete.');
  console.log('  Admin  → admin@shopcraft.local / Admin@12345');
  console.log('  Demo   → demo@shopcraft.local  / Demo@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
