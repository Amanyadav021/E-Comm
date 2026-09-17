'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyRow, Pagination, SearchInput, Select, Spinner, Td, Th } from '@/components/ui';

const ENTITIES = ['', 'Product', 'Order', 'Coupon', 'Offer', 'Category', 'Brand', 'User', 'Role', 'Setting', 'ShippingZone', 'Banner', 'Review', 'ProductVariant', 'ReturnRequest'];

export default function AuditPage() {
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set('q', q);
  if (entity) params.set('entity', entity);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', params.toString()],
    queryFn: () => api.get<any>(`/admin/audit?${params}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Audit log</h1>
        <p className="text-sm text-zinc-400">Every admin action is recorded — who, what, and when.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Filter by action, e.g. product.update" />
        </div>
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Entity" className="w-44">
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{e || 'All entities'}</option>
          ))}
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
                  <tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {data?.items.length === 0 && <EmptyRow span={5} text="No audit entries match." />}
                  {data?.items.map((l: any) => (
                    <tr key={l.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDateTime(l.at)}</Td>
                      <Td className="font-medium">{l.by}</Td>
                      <Td><code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{l.action}</code></Td>
                      <Td className="text-zinc-500">{l.entity}</Td>
                      <Td className="max-w-72 truncate font-mono text-[11px] text-zinc-400">{l.metadata ?? '—'}</Td>
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
