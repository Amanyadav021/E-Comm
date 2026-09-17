'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
        variant === 'secondary' && 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
        variant === 'outline' && 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ label, error, className, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const inputId = id ?? props.name;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:ring-4 dark:bg-zinc-900',
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 dark:border-rose-800 dark:focus:ring-rose-900/30'
            : 'border-zinc-200 focus:border-brand-300 focus:ring-brand-100 dark:border-zinc-700 dark:focus:border-brand-600 dark:focus:ring-brand-900/40',
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 [&>svg]:size-8">
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function StatusBadge({ status, labels }: { status: string; labels?: Record<string, string> }) {
  const tone =
    ['DELIVERED', 'SUCCESS', 'COMPLETED', 'APPROVED', 'ACTIVE', 'CONFIRMED'].includes(status) ? 'green' :
    ['CANCELLED', 'FAILED', 'PAYMENT_FAILED', 'REJECTED', 'OUT', 'DISABLED', 'HIDDEN'].includes(status) ? 'red' :
    ['PENDING_PAYMENT', 'PENDING', 'REQUESTED', 'LOW', 'PROCESSING', 'REFUND_PROCESSING', 'DRAFT'].includes(status) ? 'amber' :
    'blue';
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'green' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        tone === 'red' && 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        tone === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        tone === 'blue' && 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
      )}
    >
      {labels?.[status] ?? status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center py-16', className)}>
      <Loader2 className="size-7 animate-spin text-brand-500" />
    </div>
  );
}
