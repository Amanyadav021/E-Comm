'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Heart, ShoppingCart, User2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import clsx from 'clsx';

const TABS = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/products', label: 'Shop', icon: LayoutGrid },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/cart', label: 'Cart', icon: ShoppingCart },
  { href: '/account', label: 'Account', icon: User2 },
];

export function BottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href) && (tab.href !== '/account' || !pathname.startsWith('/account/wishlist'));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
                active ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
              <tab.icon className="size-5.5" strokeWidth={active ? 2.4 : 2} />
              {tab.label === 'Cart' && itemCount > 0 && (
                <span className="absolute right-[22%] top-0.5 flex size-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
