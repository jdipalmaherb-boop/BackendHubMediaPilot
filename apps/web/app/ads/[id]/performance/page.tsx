'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/src/lib/api';
import { firebaseAuth } from '@/src/lib/firebase';

interface MetricRow {
  date: string;
  variantId?: string | null;
  variantName?: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  cpa?: number | null;
}

async function getToken() {
  const user = firebaseAuth.currentUser;
  return user ? await user.getIdToken() : null;
}

export default function CampaignPerformancePage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;

  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let isMounted = true;

    async function loadMetrics() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(
          `/api/ads/${campaignId}/metrics`,
          {},
          async () => await getToken()
        );
        if (!isMounted) return;
        const rows = Array.isArray(response?.metrics) ? response.metrics : [];
        setMetrics(rows as MetricRow[]);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadMetrics();
    return () => {
      isMounted = false;
    };
  }, [campaignId]);

  const totals = useMemo(() => {
    if (metrics.length === 0) {
      return null;
    }
    const aggregate = metrics.reduce(
      (acc, row) => {
        acc.impressions += row.impressions ?? 0;
        acc.clicks += row.clicks ?? 0;
        acc.conversions += row.conversions ?? 0;
        acc.spend += row.spend ?? 0;
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
    );
    const cpa = aggregate.conversions > 0 ? aggregate.spend / aggregate.conversions : null;
    const ctr = aggregate.impressions > 0 ? (aggregate.clicks / aggregate.impressions) * 100 : 0;
    const conversionRate = aggregate.clicks > 0 ? (aggregate.conversions / aggregate.clicks) * 100 : 0;
    return { ...aggregate, cpa, ctr, conversionRate };
  }, [metrics]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href={`/ads/${campaignId}/builder`} className="text-sm text-blue-600 hover:underline">
        &larr; Back to builder
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Campaign performance</h1>
      <p className="mt-1 text-sm text-gray-600">
        Review paid media results across impressions, clicks, spend, and conversions.
      </p>

      {loading ? (
        <div className="mt-8 space-y-3">
          <div className="h-20 animate-pulse rounded bg-gray-200" />
          <div className="h-20 animate-pulse rounded bg-gray-200" />
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-8 space-y-8">
          {totals ? (
            <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-4">
              <SummaryCard label="Impressions" value={totals.impressions.toLocaleString()} />
              <SummaryCard label="Clicks" value={totals.clicks.toLocaleString()} />
              <SummaryCard label="Conversions" value={totals.conversions.toLocaleString()} />
              <SummaryCard
                label="Spend"
                value={`$${totals.spend.toFixed(2)}`}
                sublabel={totals.cpa ? `CPA $${totals.cpa.toFixed(2)}` : 'CPA n/a'}
              />
              <SummaryCard
                label="CTR"
                value={`${totals.ctr.toFixed(2)}%`}
                sublabel={`${totals.conversionRate.toFixed(2)}% CVR`}
              />
            </section>
          ) : (
            <p className="rounded border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No performance data yet. Metrics will appear once ad platforms report back.
            </p>
          )}

          <section className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <HeaderCell>Date</HeaderCell>
                  <HeaderCell>Variant</HeaderCell>
                  <HeaderCell align="right">Impressions</HeaderCell>
                  <HeaderCell align="right">Clicks</HeaderCell>
                  <HeaderCell align="right">Conversions</HeaderCell>
                  <HeaderCell align="right">Spend</HeaderCell>
                  <HeaderCell align="right">CPA</HeaderCell>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {metrics.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                      No metric rows yet.
                    </td>
                  </tr>
                ) : (
                  metrics.map((row, index) => {
                    const date = row.date ? new Date(row.date) : null;
                    const formattedDate = date ? date.toLocaleDateString() : '—';
                    const cpa = row.cpa ?? (row.conversions > 0 ? row.spend / row.conversions : null);
                    return (
                      <tr key={`${row.variantId ?? 'variant'}-${index}`} className="hover:bg-gray-50">
                        <Cell>{formattedDate}</Cell>
                        <Cell>{row.variantName ?? row.variantId ?? '—'}</Cell>
                        <Cell align="right">{row.impressions?.toLocaleString?.() ?? row.impressions ?? 0}</Cell>
                        <Cell align="right">{row.clicks?.toLocaleString?.() ?? row.clicks ?? 0}</Cell>
                        <Cell align="right">{row.conversions?.toLocaleString?.() ?? row.conversions ?? 0}</Cell>
                        <Cell align="right">${row.spend.toFixed(2)}</Cell>
                        <Cell align="right">{cpa ? `$${cpa.toFixed(2)}` : '—'}</Cell>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-gray-500">{sublabel}</p> : null}
    </div>
  );
}

function HeaderCell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  const alignmentClass = align === 'right' ? 'text-right' : 'text-left';
  return (
    <th className={`px-4 py-3 ${alignmentClass} text-xs font-medium uppercase tracking-wider text-gray-500`} scope="col">
      {children}
    </th>
  );
}

function Cell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  const alignmentClass = align === 'right' ? 'text-right' : 'text-left';
  return <td className={`px-4 py-3 ${alignmentClass} text-sm text-gray-600`}>{children}</td>;
}
