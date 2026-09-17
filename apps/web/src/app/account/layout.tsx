'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Bell, Heart, LogOut, MapPin, Package, RotateCcw, Star, User2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui';

const NAV = [
  { href: '/account', label: 'Profile', icon: User2, exact: true },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/returns', label: 'Returns', icon: RotateCcw },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/reviews', label: 'My reviews', icon: Star },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${pathname}`);
  }, [isLoading, user, router, pathname]);

  if (isLoading || !user) return <Spinner />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:py-8">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside>
          <div className="mb-4 hidden items-center gap-3 md:flex">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-xs text-zinc-400">{user.email ?? (user.phone ? `+91 ${user.phone}` : '')}</p>
            </div>
          </div>
          <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  <item.icon className="size-4.5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={async () => {
                await logout();
                router.push('/');
              }}
              className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              <LogOut className="size-4.5" />
              Sign out
            </button>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
