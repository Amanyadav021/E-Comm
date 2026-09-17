'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { formatDateTime, formatINR } from '@/lib/format';
import { Card, EmptyRow, Pagination, SearchInput, Select, Spinner, StatusBadge, Td, Th } from '@/components/ui';

export default function PaymentsPage() {
  const [tab, setTab] = useState<'transactions' | 'refunds'>('transactions');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (method) params.set('method', method);

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['admin-payments', params.toString()],
    queryFn: () => api.get<any>(`/admin/payments?${params}`),
    placeholderData: keepPreviousData,
    enabled: tab === 'transactions',
  });
  const { data: refunds, isLoading: loadingRefunds } = useQuery({
    queryKey: ['admin-refunds', page],
    queryFn: () => api.get<any>(`/admin/payments/refunds?page=${page}`),
    placeholderData: keepPreviousData,
    enabled: tab === 'refunds',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Payments</h1>
        <a href="/api/admin/payments/export" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800">
          <Download className="size-4" /> Export CSV
        </a>
      </div>

      <div className="flex gap-2">
        {(['transactions', 'refunds'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-semibold capitalize transition',
              tab === t ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-52 flex-1">
              <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Payment ID, order #, customer…" />
            </div>
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className="w-40">
              <option value="">All statuses</option>
              {['SUCCESS', 'FAILED', 'PENDING', 'CREATED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((s) => (
                <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
              ))}
            </Select>
            <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} aria-label="Method" className="w-36">
              <option value="">All methods</option>
              {['upi', 'card', 'netbanking', 'wallet', 'cod'].map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </Select>
          </div>

          <Card>
            {loadingPayments ? (
              <Spinner />
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead className="border-b border-zinc-100 dark:border-zinc-800">
                      <tr>
                        <Th>Order</Th><Th>Customer</Th><Th>Gateway ID</Th><Th>Method</Th><Th>Amount</Th><Th>Status</Th><Th>Date</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                      {payments?.items.length === 0 && <EmptyRow span={7} text="No transactions match." />}
                      {payments?.items.map((p: any) => (
                        <tr key={p.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                          <Td><Link href={`/orders/${p.orderId}`} className="font-semibold text-brand-600 hover:underline">{p.orderNumber}</Link></Td>
                          <Td>{p.customer}</Td>
                          <Td className="max-w-44 truncate font-mono text-xs text-zinc-500">{p.providerPaymentId ?? '—'}</Td>
                          <Td className="uppercase text-zinc-500">{p.method ?? p.provider}</Td>
                          <Td className="font-semibold">{formatINR(p.amount, true)}</Td>
                          <Td>
                            <StatusBadge status={p.status} />
                            {p.errorReason && <p className="mt-0.5 max-w-40 truncate text-[11px] text-rose-500">{p.errorReason}</p>}
                          </Td>
                          <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDateTime(p.createdAt)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {payments && <Pagination page={page} total={payments.total} pageSize={payments.pageSize} onPage={setPage} />}
              </>
            )}
          </Card>
        </>
      )}

      {tab === 'refunds' && (
        <Card>
          {loadingRefunds ? (
            <Spinner />
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <thead className="border-b border-zinc-100 dark:border-zinc-800">
                    <tr><Th>Order</Th><Th>Customer</Th><Th>Amount</Th><Th>Status</Th><Th>Reason</Th><Th>By</Th><Th>Date</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                    {refunds?.items.length === 0 && <EmptyRow span={7} text="No refunds yet." />}
                    {refunds?.items.map((r: any) => (
                      <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                        <Td><Link href={`/orders/${r.orderId}`} className="font-semibold text-brand-600 hover:underline">{r.orderNumber}</Link></Td>
                        <Td>{r.customer}</Td>
                        <Td className="font-semibold">{formatINR(r.amount, true)}</Td>
                        <Td><StatusBadge status={r.status} /></Td>
                        <Td className="max-w-52 truncate text-zinc-500">{r.reason ?? '—'}</Td>
                        <Td className="text-zinc-500">{r.initiatedBy}</Td>
                        <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDateTime(r.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {refunds && <Pagination page={page} total={refunds.total} pageSize={refunds.pageSize} onPage={setPage} />}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
