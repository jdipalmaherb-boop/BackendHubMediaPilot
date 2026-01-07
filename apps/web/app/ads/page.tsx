'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/src/lib/api';
import { firebaseAuth } from '@/src/lib/firebase';

type Campaign = {
  id: string;
  name: string;
  objective?: string | null;
  status: string;
  budgetDaily?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  variants?: Array<{ id: string }>;
};

async function getToken() {
  const user = firebaseAuth.currentUser;
  return user ? await user.getIdToken() : null;
}

export default function AdsDashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCampaigns() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(
          '/api/ads/campaigns',
          {},
          async () => await getToken()
        );
        if (!isMounted) return;
        const list = Array.isArray(response?.campaigns) ? response.campaigns : [];
        setCampaigns(list as Campaign[]);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadCampaigns();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Ads Campaigns</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track marketing performance, iterate on creatives, and launch new campaigns.
          </p>
        </div>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white shadow"
          onClick={() => router.push('/ads/new')}
        >
          Create campaign
        </button>
      </div>

      {loading ? (
        <div className="mt-8 space-y-3">
          <div className="h-12 animate-pulse rounded bg-gray-200" />
          <div className="h-12 animate-pulse rounded bg-gray-200" />
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Objective
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Daily budget
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    No campaigns yet. Create your first one to start optimizing ads.
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link className="text-blue-600 hover:underline" href={/ads//builder}>
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{campaign.objective ?? 'n/a'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {campaign.budgetDaily ? $ : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-2 text-blue-600">
                        <Link className="hover:underline" href={/ads//builder}>
                          Builder
                        </Link>
                        <Link className="hover:underline" href={/ads//performance}>
                          Performance
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
