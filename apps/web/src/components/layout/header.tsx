'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, Menu, Search, ShoppingCart, User2, X, ChevronRight, Package, Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import type { CategoryNode } from '@/lib/types';

interface Suggestions {
  products: Array<{ name: string; slug: string; price: number; image: string | null }>;
  categories: Array<{ name: string; slug: string }>;
  brands: Array<{ name: string; slug: string }>;
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const RECENT_KEY = 'sc-recent-searches';

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function pushRecent(term: string) {
  try {
    const next = [term, ...getRecent().filter((t) => t !== term)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function SearchBox({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q, 250);
  const boxRef = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState<string[]>([]);

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', debounced],
    queryFn: () => api.get<Suggestions>(`/catalog/search/suggestions?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.trim().length >= 2,
  });
  const { data: popular } = useQuery({
    queryKey: ['popular-searches'],
    queryFn: () => api.get<string[]>('/catalog/search/popular'),
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (term: string) => {
    const t = term.trim();
    if (!t) return;
    pushRecent(t);
    setOpen(false);
    onNavigate?.();
    router.push(`/products?q=${encodeURIComponent(t)}`);
  };

  const showPanel = open && (q.trim().length >= 2 ? !!suggestions : true);

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={q}
            autoFocus={autoFocus}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setRecent(getRecent());
              setOpen(true);
            }}
            placeholder="Search products, brands and more"
            aria-label="Search products"
            className="w-full rounded-full border border-zinc-200 bg-zinc-100/80 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-zinc-400 focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800/80 dark:focus:border-brand-600 dark:focus:bg-zinc-900 dark:focus:ring-brand-900/40"
          />
        </label>
      </form>

      {showPanel && (
        <div className="fade-up absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900">
          {q.trim().length < 2 ? (
            <div className="p-4">
              {recent.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Recent searches</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {recent.map((t) => (
                      <button key={t} onClick={() => go(t)} className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {popular && popular.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Popular right now</p>
                  <div className="flex flex-wrap gap-2">
                    {popular.map((t) => (
                      <button key={t} onClick={() => go(t)} className="rounded-full bg-brand-50 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50">
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : suggestions ? (
            <div className="max-h-[70vh] overflow-y-auto py-2">
              {suggestions.products.length === 0 && suggestions.categories.length === 0 && suggestions.brands.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  No matches for “{q}”. Press Enter to search anyway.
                </p>
              ) : (
                <>
                  {suggestions.products.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/product/${p.slug}`}
                      onClick={() => {
                        setOpen(false);
                        onNavigate?.();
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      {p.image ? (
                        <img src={p.image} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <div className="size-10 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                      )}
                      <span className="flex-1 truncate text-sm">{p.name}</span>
                      <span className="text-sm font-semibold">{formatINR(p.price)}</span>
                    </Link>
                  ))}
                  {[...suggestions.categories.map((c) => ({ ...c, kind: 'Category', href: `/category/${c.slug}` })),
                    ...suggestions.brands.map((b) => ({ ...b, kind: 'Brand', href: `/products?brands=${b.slug}` }))].map((s) => (
                    <Link
                      key={s.kind + s.slug}
                      href={s.href}
                      onClick={() => {
                        setOpen(false);
                        onNavigate?.();
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <Search className="size-4 text-zinc-400" />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-zinc-400">{s.kind}</span>
                    </Link>
                  ))}
                </>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { count: wishCount } = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryNode[]>('/catalog/categories'),
    staleTime: 5 * 60_000,
  });

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:gap-6">
        {/* Mobile menu */}
        <button
          className="md:hidden"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-6" />
        </button>

        <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight">
          <span className="text-brand-600">Shop</span>Craft
        </Link>

        <div className="hidden flex-1 md:block md:max-w-xl">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button className="p-2 md:hidden" aria-label="Search" onClick={() => setSearchOpen((v) => !v)}>
            <Search className="size-5.5" />
          </button>

          <Link href="/account/wishlist" aria-label="Wishlist" className="relative hidden rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:block">
            <Heart className="size-5.5" />
            {wishCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {wishCount}
              </span>
            )}
          </Link>

          <Link href="/cart" aria-label="Cart" className="relative rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <ShoppingCart className="size-5.5" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <Link href="/account" className="hidden items-center gap-2 rounded-full py-1.5 pl-2 pr-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:flex">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-24 truncate text-sm font-medium">{user.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 md:block"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="border-t border-zinc-100 p-3 dark:border-zinc-800 md:hidden">
          <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}

      {/* Desktop category bar */}
      <nav aria-label="Categories" className="hidden border-t border-zinc-100 dark:border-zinc-800/60 md:block">
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4">
          {(categories ?? []).map((c) => (
            <div key={c.id} className="group relative">
              <Link
                href={`/category/${c.slug}`}
                className="block whitespace-nowrap px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400"
              >
                {c.name}
              </Link>
              {c.children.length > 0 && (
                <div className="invisible absolute left-0 top-full z-50 min-w-48 rounded-xl border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-900">
                  {c.children.map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/category/${sub.slug}`}
                      className="flex items-center justify-between px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-brand-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {sub.name}
                      <ChevronRight className="size-3.5 text-zinc-300" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

    </header>

      {/* Mobile drawer — a SIBLING of the header: the header's backdrop-blur
          creates a containing block that would trap and clip fixed children */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-zinc-900/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4 dark:border-zinc-800">
              <span className="text-lg font-extrabold">
                <span className="text-brand-600">Shop</span>Craft
              </span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X className="size-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {user ? (
                <Link href="/account" onClick={() => setMenuOpen(false)} className="mb-2 flex items-center gap-3 rounded-xl bg-brand-50 p-3 dark:bg-brand-900/20">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-zinc-500">View your account</p>
                  </div>
                </Link>
              ) : (
                <Link href="/login" onClick={() => setMenuOpen(false)} className="mb-2 block rounded-xl bg-brand-600 p-3 text-center font-semibold text-white">
                  Sign in / Register
                </Link>
              )}
              <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Categories</p>
              {(categories ?? []).map((c) => (
                <div key={c.id}>
                  <Link href={`/category/${c.slug}`} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    {c.name}
                  </Link>
                  {c.children.map((sub) => (
                    <Link key={sub.id} href={`/category/${sub.slug}`} onClick={() => setMenuOpen(false)} className="block rounded-lg py-2 pl-7 pr-3 text-sm text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800">
                      {sub.name}
                    </Link>
                  ))}
                </div>
              ))}
              <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <Link href="/account/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Package className="size-5 text-zinc-400" /> My orders
                </Link>
                <Link href="/account/wishlist" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Heart className="size-5 text-zinc-400" /> Wishlist
                </Link>
                <Link href="/account/notifications" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Bell className="size-5 text-zinc-400" /> Notifications
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
