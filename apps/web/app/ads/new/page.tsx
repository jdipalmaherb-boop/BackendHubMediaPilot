'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/src/lib/api';
import { firebaseAuth } from '@/src/lib/firebase';

const objectives = [
  'conversions',
  'traffic',
  'engagement',
  'awareness',
  'lead_generation',
];

async function getToken() {
  const user = firebaseAuth.currentUser;
  return user ? await user.getIdToken() : null;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('conversions');
  const [budget, setBudget] = useState('100');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name,
        objective,
        budgetDaily: budget ? Number(budget) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const response = await apiFetch(
        '/api/ads/campaigns',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        async () => await getToken()
      );

      const campaignId = response?.campaign?.id;
      if (!campaignId) {
        throw new Error('Campaign created but ID missing in response');
      }

      router.push(`/ads/${campaignId}/builder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/ads" className="text-sm text-blue-600 hover:underline">&larr; Back to campaigns</Link>
      <h1 className="mt-4 text-3xl font-semibold">Create a new campaign</h1>
      <p className="mt-2 text-sm text-gray-600">
        Define your campaign goal and budget. You can upload creatives and launch tests in the next step.
      </p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="campaign-name">
            Campaign name
          </label>
          <input
            id="campaign-name"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            placeholder="Spring launch push"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="objective">
              Objective
            </label>
            <select
              id="objective"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
            >
              {objectives.map((value) => (
                <option key={value} value={value}>
                  {value.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="budget">
              Daily budget (USD)
            </label>
            <input
              id="budget"
              type="number"
              min="0"
              step="10"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="start-date">
              Start date
            </label>
            <input
              id="start-date"
              type="date"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="end-date">
              End date
            </label>
            <input
              id="end-date"
              type="date"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>

        {error ? <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white shadow disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Creating…' : 'Create campaign'}
        </button>
      </form>
    </div>
  );
}
