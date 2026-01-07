'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/src/lib/api';
import { firebaseAuth } from '@/src/lib/firebase';

interface CampaignDetails {
  id: string;
  name: string;
  status: string;
  objective?: string | null;
  budgetDaily?: number | null;
  meta?: Record<string, unknown> | null;
  creatives?: AdCreative[];
  variants?: AdVariant[];
}

interface AdCreative {
  id: string;
  originalUrl?: string | null;
  processedUrl?: string | null;
  text?: string | null;
  cta?: string | null;
  createdAt?: string;
}

interface AdVariant {
  id: string;
  variantName?: string | null;
  status?: string;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
}

async function getToken() {
  const user = firebaseAuth.currentUser;
  return user ? await user.getIdToken() : null;
}

export default function CampaignBuilderPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;

  const [campaign, setCampaign] = useState<CampaignDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateTranscript, setGenerateTranscript] = useState('');
  const [generateContext, setGenerateContext] = useState('Launch campaign refresh');
  const [generateIndustry, setGenerateIndustry] = useState('General');

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const tokenCallback = useCallback(async () => await getToken(), []);

  const refreshCampaign = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        '/api/ads/campaigns',
        {},
        tokenCallback
      );
      const list: CampaignDetails[] = Array.isArray(response?.campaigns) ? response.campaigns : [];
      const match = list.find((item) => item.id === campaignId) ?? null;
      if (!match) {
        throw new Error('Campaign not found');
      }
      setCampaign(match);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [campaignId, tokenCallback]);

  useEffect(() => {
    void refreshCampaign();
  }, [refreshCampaign]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !campaignId) {
      setUploadError('Select a file first');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setActionMessage(null);

    try {
      const presign = await apiFetch(
        '/api/uploads/presign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: selectedFile.name,
            contentType: selectedFile.type || 'application/octet-stream',
            folder: `ads/${campaignId}`,
          }),
        },
        tokenCallback
      );

      const { signedUrl, key, publicUrl } = presign;
      if (!signedUrl || !key) {
        throw new Error('Failed to generate upload URL');
      }

      await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
        body: selectedFile,
      });

      await apiFetch(
        '/api/uploads/complete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            meta: {
              originalFilename: selectedFile.name,
              size: selectedFile.size,
              uploadedFrom: 'ads-builder',
            },
          }),
        },
        tokenCallback
      );

      await apiFetch(
        `/api/ads/campaigns/${campaignId}/creatives`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalUrl: publicUrl ?? undefined,
            text: `Creative uploaded on ${new Date().toLocaleDateString()}`,
            cta: 'Learn More',
          }),
        },
        tokenCallback
      );

      setActionMessage('Creative uploaded successfully');
      setSelectedFile(null);
      await refreshCampaign();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload creative');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateVariants = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!campaignId) return;
    setGenerateError(null);
    setGenerateLoading(true);
    setActionMessage(null);

    try {
      await apiFetch(
        `/api/ads/campaigns/${campaignId}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: generateTranscript,
            context: generateContext,
            industry: generateIndustry,
          }),
        },
        tokenCallback
      );
      setActionMessage('Variant generation started. Optimizer will populate results shortly.');
      await refreshCampaign();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate variants');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!campaignId) return;
    setActionMessage(null);
    try {
      await apiFetch(
        `/api/ads/campaigns/${campaignId}/start`,
        { method: 'POST' },
        tokenCallback
      );
      setActionMessage('Campaign activation queued.');
      await refreshCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start campaign');
    }
  };

  const handleStopCampaign = async () => {
    if (!campaignId) return;
    setActionMessage(null);
    try {
      await apiFetch(
        `/api/ads/campaigns/${campaignId}/stop`,
        { method: 'POST' },
        tokenCallback
      );
      setActionMessage('Campaign pause queued.');
      await refreshCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop campaign');
    }
  };

  const variants = useMemo(() => campaign?.variants ?? [], [campaign]);
  const creatives = useMemo(() => campaign?.creatives ?? [], [campaign]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/ads" className="text-sm text-blue-600 hover:underline">
            &larr; Back to campaigns
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">Campaign builder</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload creatives, experiment with AI-generated variants, and control launch status.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={handleStartCampaign}
            disabled={!campaignId || loading}
          >
            Start campaign
          </button>
          <button
            className="rounded bg-slate-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={handleStopCampaign}
            disabled={!campaignId || loading}
          >
            Stop campaign
          </button>
        </div>
      </div>

      {actionMessage ? (
        <div className="mt-4 rounded bg-green-50 p-3 text-sm text-green-700">{actionMessage}</div>
      ) : null}
      {error ? <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="mt-8 space-y-3">
          <div className="h-6 animate-pulse rounded bg-gray-200" />
          <div className="h-6 animate-pulse rounded bg-gray-200" />
          <div className="h-32 animate-pulse rounded bg-gray-200" />
        </div>
      ) : null}

      {!loading && campaign ? (
        <div className="mt-8 space-y-10">
          <section className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Creative uploader</h2>
            <p className="mt-1 text-sm text-gray-600">
              Upload raw assets. They will sync to the campaign and can be used for variant generation.
            </p>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="creative-upload">
                  Select file
                </label>
                <input
                  id="creative-upload"
                  type="file"
                  className="mt-1 block w-full text-sm"
                  onChange={handleFileChange}
                />
              </div>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={uploading || !selectedFile}
                onClick={handleUpload}
                type="button"
              >
                {uploading ? 'Uploading…' : 'Upload creative'}
              </button>
            </div>
            {uploadError ? <p className="mt-2 text-sm text-red-600">{uploadError}</p> : null}
          </section>

          <section className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Generate variants with AI</h2>
            <p className="mt-1 text-sm text-gray-600">
              Provide context and a transcript so our GPT strategist can craft hooks, captions, and CTA tests.
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleGenerateVariants}>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="transcript">
                  Transcript / script (optional)
                </label>
                <textarea
                  id="transcript"
                  rows={4}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Paste a short transcript or talking points to drive copy..."
                  value={generateTranscript}
                  onChange={(event) => setGenerateTranscript(event.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="context">
                    Context
                  </label>
                  <input
                    id="context"
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                    value={generateContext}
                    onChange={(event) => setGenerateContext(event.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="industry">
                    Industry
                  </label>
                  <input
                    id="industry"
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                    value={generateIndustry}
                    onChange={(event) => setGenerateIndustry(event.target.value)}
                  />
                </div>
              </div>
              {generateError ? <p className="text-sm text-red-600">{generateError}</p> : null}
              <button
                type="submit"
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={generateLoading}
              >
                {generateLoading ? 'Generating…' : 'Generate variants'}
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Creatives</h2>
            <CreativeGrid creatives={creatives} />
          </section>

          <section className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Variants</h2>
            {variants.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No variants yet. Generate variants or upload creatives to get started.</p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {variants.map((variant) => {
                  const caption = typeof variant.meta?.caption === 'string' ? variant.meta.caption : undefined;
                  const hashtags = Array.isArray(variant.meta?.hashtags)
                    ? (variant.meta?.hashtags as string[])
                    : [];
                  return (
                    <div key={variant.id} className="rounded-lg border border-gray-200 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{variant.variantName ?? 'Variant'}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs uppercase tracking-wide text-slate-600">
                          {variant.status ?? 'PENDING'}
                        </span>
                      </div>
                      {caption ? (
                        <p className="mt-2 line-clamp-3 text-sm text-gray-700">{caption}</p>
                      ) : null}
                      {hashtags.length ? (
                        <p className="mt-3 text-xs text-gray-500">{hashtags.join(' ')}</p>
                      ) : null}
                      <p className="mt-4 text-xs text-gray-400">
                        Created {variant.createdAt ? new Date(variant.createdAt).toLocaleString() : 'recently'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function CreativeGrid({ creatives }: { creatives: AdCreative[] }) {
  if (!creatives || creatives.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">No creatives uploaded yet.</p>;
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {creatives.map((creative) => (
        <article key={creative.id} className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          {creative.originalUrl ? (
            <div className="aspect-video bg-black/5">
              <video controls className="h-full w-full object-cover">
                <source src={creative.originalUrl} />
              </video>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center bg-slate-100 text-sm text-slate-500">
              Preview unavailable
            </div>
          )}
          <div className="space-y-2 p-4">
            <p className="text-sm font-medium text-gray-900">
              {creative.text ?? 'Untitled creative'}
            </p>
            {creative.cta ? (
              <p className="text-xs uppercase tracking-wide text-emerald-600">CTA: {creative.cta}</p>
            ) : null}
            <p className="text-xs text-gray-500">
              Uploaded {creative.createdAt ? new Date(creative.createdAt).toLocaleString() : 'recently'}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
