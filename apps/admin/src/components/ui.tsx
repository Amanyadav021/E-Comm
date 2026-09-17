'use client';

import clsx from 'clsx';
import { Loader2, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
        variant === 'secondary' && 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900',
        variant === 'outline' && 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-sm',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const fieldClass = (error?: string) =>
  clsx(
    'w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-900',
    error
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
      : 'border-zinc-300 focus:border-brand-400 focus:ring-brand-100 dark:border-zinc-600 dark:focus:ring-brand-900/40',
  );

export function Field({ label, error, hint, children }: { label?: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function Input({ label, error, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input className={clsx(fieldClass(error), className)} {...props} />
    </Field>
  );
}

export function Select({ label, error, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      <select className={clsx(fieldClass(error), className)} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Textarea({ label, error, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <Field label={label} error={error}>
      <textarea className={clsx(fieldClass(error), className)} {...props} />
    </Field>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-5.5 w-10 rounded-full transition',
          checked ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-600',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all',
            checked ? 'left-5' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}

export function Card({ title, actions, className, children }: { title?: ReactNode; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={clsx('rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-bold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatusBadge({ status, labels }: { status: string; labels?: Record<string, string> }) {
  const tone =
    ['DELIVERED', 'SUCCESS', 'COMPLETED', 'APPROVED', 'ACTIVE', 'CONFIRMED', 'OK'].includes(status) ? 'green' :
    ['CANCELLED', 'FAILED', 'PAYMENT_FAILED', 'REJECTED', 'OUT', 'DISABLED', 'HIDDEN', 'ARCHIVED'].includes(status) ? 'red' :
    ['PENDING_PAYMENT', 'PENDING', 'REQUESTED', 'LOW', 'PROCESSING', 'REFUND_PROCESSING', 'DRAFT', 'RETURN_REQUESTED'].includes(status) ? 'amber' :
    'blue';
  return (
    <span
      className={clsx(
        'inline-flex whitespace-nowrap items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
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

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-7 animate-spin text-brand-500" />
    </div>
  );
}

export function EmptyRow({ span, text }: { span: number; text: string }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-10 text-center text-sm text-zinc-400">
        {text}
      </td>
    </tr>
  );
}

export function Modal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-zinc-900/60" onClick={onClose} />
      <div
        className={clsx(
          'relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-zinc-900',
          wide ? 'max-w-2xl' : 'max-w-md',
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  text,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{text}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-zinc-600 dark:bg-zinc-900"
      />
    </label>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm dark:border-zinc-800">
      <span className="text-zinc-400">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 font-medium">{page} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={clsx('whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-3 text-sm', className)}>{children}</td>;
}
