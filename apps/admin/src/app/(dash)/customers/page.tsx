'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { Card, EmptyRow, Pagination, SearchInput, Select, Spinner, StatusBadge, Td, Th } from '@/components/ui';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', params.toString()],
    queryFn: () => api.get<any>(`/admin/customers?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Customers</h1>
        <a href="/api/admin/customers/export" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800">
          <Download className="size-4" /> Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email, phone…" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className="w-36">
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <Th>Customer</Th>
                    <Th>Contact</Th>
                    <Th>Orders</Th>
                    <Th>Total spent</Th>
                    <Th>Status</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {data?.items.length === 0 && <EmptyRow span={6} text="No customers found." />}
                  {data?.items.map((c: any) => (
                    <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td>
                        <Link href={`/customers/${c.id}`} className="flex items-center gap-2.5 font-medium hover:text-brand-600">
                          <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                          {c.name}
                        </Link>
                      </Td>
                      <Td className="text-zinc-500">{c.email ?? c.phone ?? '—'}</Td>
                      <Td>{c.orderCount}</Td>
                      <Td className="font-semibold">{formatINR(c.totalSpent)}</Td>
                      <Td><StatusBadge status={c.status} /></Td>
                      <Td className="text-xs text-zinc-400">{formatDate(c.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
