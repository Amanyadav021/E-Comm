'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Moon, Sun, ShieldCheck, Truck, RotateCcw, BadgeIndianRupee } from 'lucide-react';

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('sc-theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

const TRUST = [
  { icon: Truck, title: 'Fast delivery', text: 'Across India' },
  { icon: RotateCcw, title: 'Easy returns', text: '7-day return window' },
  { icon: ShieldCheck, title: 'Secure payments', text: 'UPI · Cards · COD' },
  { icon: BadgeIndianRupee, title: 'Best prices', text: 'Deals every day' },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4">
        {TRUST.map((t) => (
          <div key={t.title} className="flex items-center gap-3">
            <t.icon className="size-6 shrink-0 text-brand-600" />
            <div>
              <p className="text-sm font-semibold">{t.title}</p>
              <p className="text-xs text-zinc-500">{t.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-100 dark:border-zinc-800/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-lg font-extrabold">
              <span className="text-brand-600">Shop</span>Craft
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Everything you love, delivered fast. Quality products at honest prices.
            </p>
            <div className="mt-4">
              <ThemeToggle />
            </div>
          </div>
          <nav aria-label="Shop">
            <p className="mb-3 text-sm font-semibold">Shop</p>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link className="hover:text-brand-600" href="/products?sort=newest">New arrivals</Link></li>
              <li><Link className="hover:text-brand-600" href="/products?minDiscount=30">Top deals</Link></li>
              <li><Link className="hover:text-brand-600" href="/products?sort=popular">Best sellers</Link></li>
              <li><Link className="hover:text-brand-600" href="/products?sort=rating">Top rated</Link></li>
            </ul>
          </nav>
          <nav aria-label="Account">
            <p className="mb-3 text-sm font-semibold">Account</p>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link className="hover:text-brand-600" href="/account/orders">Track your order</Link></li>
              <li><Link className="hover:text-brand-600" href="/account/returns">Returns</Link></li>
              <li><Link className="hover:text-brand-600" href="/account/wishlist">Wishlist</Link></li>
              <li><Link className="hover:text-brand-600" href="/account">Profile</Link></li>
            </ul>
          </nav>
          <div>
            <p className="mb-3 text-sm font-semibold">Support</p>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li>support@shopcraft.local</li>
              <li>+91 98765 43210</li>
              <li>Mon–Sat, 9am–7pm IST</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-100 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800/60">
        © {new Date().getFullYear()} ShopCraft. All prices include GST.
      </div>
    </footer>
  );
}
