'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, Bell, Boxes, CreditCard, FolderTree, Home, LogOut, Megaphone, Menu, Moon,
  Package, RotateCcw, ScrollText, Settings, ShoppingBag, Star, Sun, Tag, Truck, Users, X,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useAdmin } from '@/hooks/useAdmin';
import { Spinner } from '@/components/ui';

const NAV: Array<{ group: string; items: Array<{ href: string; label: string; icon: any }> }> = [
  {
    group: '',
    items: [{ href: '/', label: 'Dashboard', icon: Home }],
  },
  {
    group: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: ShoppingBag },
      { href: '/categories', label: 'Categories', icon: FolderTree },
      { href: '/brands', label: 'Brands', icon: Tag },
      { href: '/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    group: 'Sales',
    items: [
      { href: '/orders', label: 'Orders', icon: Package },
      { href: '/returns', label: 'Returns', icon: RotateCcw },
      { href: '/payments', label: 'Payments', icon: CreditCard },
      { href: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { href: '/marketing', label: 'Coupons & Offers', icon: Megaphone },
      { href: '/content', label: 'Homepage & Banners', icon: Star },
      { href: '/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    group: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { href: '/shipping', label: 'Shipping', icon: Truck },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  return (
    <button
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle('dark', next);
        try { localStorage.setItem('sc-admin-theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
      }}
      aria-label="Toggle theme"
      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const { user, isStaff, isLoading, logout } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const qc = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => api.get<{ unread: number; items: Array<{ id: string; title: string; body: string | null; readAt: string | null; createdAt: string }> }>('/admin/notifications'),
    enabled: !!user && isStaff,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!isLoading && (!user || !isStaff)) router.replace('/login');
  }, [isLoading, user, isStaff, router]);

  useEffect(() => setSidebarOpen(false), [pathname]);

  if (isLoading || !user || !isStaff) return <div className="min-h-dvh"><Spinner /></div>;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200/80 px-5 dark:border-zinc-800">
        <span className="text-lg font-extrabold tracking-tight">
          <span className="text-brand-600">Shop</span>Craft
        </span>
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500 dark:bg-zinc-800">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map((section) => (
          <div key={section.group} className="mb-2">
            {section.group && (
              <p className="px-2.5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {section.group}
              </p>
            )}
            {section.items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={clsx(
                    'mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                    active
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  <item.icon className="size-4.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-200/80 p-3 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-[11px] text-zinc-400">{user.roles.join(', ')}</p>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            aria-label="Sign out"
            className="text-zinc-400 hover:text-rose-600"
          >
            <LogOut className="size-4.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-zinc-200/80 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-zinc-900/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl dark:bg-zinc-900">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-6" />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Bell className="size-5" />
                {(notifications?.unread ?? 0) > 0 && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {notifications!.unread > 9 ? '9+' : notifications!.unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="fade-up absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                    <span className="text-sm font-bold">Notifications</span>
                    <button
                      onClick={async () => {
                        await api.post('/admin/notifications/read-all');
                        qc.invalidateQueries({ queryKey: ['admin-notifications'] });
                      }}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {(notifications?.items ?? []).length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-zinc-400">All caught up!</p>
                    ) : (
                      notifications!.items.map((n) => (
                        <div key={n.id} className={clsx('border-b border-zinc-50 px-4 py-2.5 dark:border-zinc-800/60', !n.readAt && 'bg-brand-50/50 dark:bg-brand-900/10')}>
                          <p className={clsx('text-sm', !n.readAt && 'font-semibold')}>{n.title}</p>
                          {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{n.body}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
