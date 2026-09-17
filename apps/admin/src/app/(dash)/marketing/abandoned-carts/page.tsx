'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime, formatINR } from '@/lib/format';
import { Card, EmptyRow, Pagination, Spinner, Td, Th } from '@/components/ui';

export default function AbandonedCartsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['abandoned-carts', page],
    queryFn: () => api.get<any>(`/admin/marketing/abandoned-carts?page=${page}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Abandoned carts</h1>
        <p className="text-sm text-zinc-400">Carts with items and no activity for 24+ hours — prime candidates for reminder campaigns.</p>
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 dark:border-zinc-800">
                  <tr><Th>Customer</Th><Th>Contact</Th><Th>Items</Th><Th>Cart value</Th><Th>Last activity</Th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {data?.items.length === 0 && <EmptyRow span={5} text="No abandoned carts right now. 🎉" />}
                  {data?.items.map((c: any) => (
                    <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td className="font-medium">{c.customer}</Td>
                      <Td className="text-zinc-500">{c.contact ?? '—'}</Td>
                      <Td>
                        <div className="max-w-72 space-y-0.5">
                          {c.items.slice(0, 3).map((i: any, idx: number) => (
                            <p key={idx} className="truncate text-xs text-zinc-500">{i.name} × {i.qty}</p>
                          ))}
                          {c.items.length > 3 && <p className="text-xs text-zinc-400">+{c.items.length - 3} more</p>}
                        </div>
                      </Td>
                      <Td className="font-semibold">{formatINR(c.cartValue, true)}</Td>
                      <Td className="whitespace-nowrap text-xs text-zinc-400">{formatDateTime(c.lastActivityAt)}</Td>
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
