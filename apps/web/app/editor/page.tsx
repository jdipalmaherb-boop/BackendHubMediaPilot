"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/src/lib/api";
import { firebaseAuth } from "@/src/lib/firebase";

interface VideoDetails {
  id: string;
  originalUrl?: string | null;
  processedUrl?: string | null;
  thumbnailUrl?: string | null;
  vttUrl?: string | null;
  status: string;
  meta?: Record<string, unknown> | null;
  variants?: Array<{ label: string; url: string }>;
}

async function withToken<T>(fn: (token: string | null) => Promise<T>): Promise<T> {
  const currentUser = firebaseAuth.currentUser;
  const token = currentUser ? await currentUser.getIdToken() : null;
  return fn(token);
}

export default function VideoEditorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoId = searchParams.get("videoId");

  const [details, setDetails] = useState<VideoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [options, setOptions] = useState({
    trimSilence: true,
    captions: true,
    variants: "smart",
  });

  const variants = useMemo(() => details?.variants ?? [], [details]);

  useEffect(() => {
    if (!videoId) return;
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await withToken((token) =>
          apiFetch(/api/videos/, {}, async () => token)
        );
        setDetails(response as VideoDetails);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load video details");
      } finally {
        setLoading(false);
      }
    };

    void fetchDetails();
  }, [videoId]);

  const handleReprocess = async () => {
    if (!videoId) return;
    setMessage("Triggering reprocess...");
    setError(null);
    try {
      const payload = {
        trimSilence: options.trimSilence,
        generateCaptions: options.captions,
        variantPreset: options.variants,
      };
      const result = await withToken((token) =>
        apiFetch(
          /api/videos//reprocess,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          async () => token
        )
      );
      setMessage("Reprocess job queued. Status: " + (result?.status ?? "queued"));
    } catch (err: any) {
      setError(err?.message ?? "Failed to reprocess video");
    }
  };

  const handleGenerateAds = async () => {
    if (!videoId) return;
    setMessage("Generating ad creatives...");
    setError(null);
    try {
      const result = await withToken((token) =>
        apiFetch(
          /api/ads/generate-from-video,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId }),
          },
          async () => token
        )
      );
      setMessage("Ad generation complete! Draft campaign: " + (result?.campaignId ?? "pending"));
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate ads");
    }
  };

  if (!videoId) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-3xl font-semibold">Video Editor</h1>
        <p className="mt-4 text-sm text-gray-600">
          No video selected. Please return to the upload page and choose a processed video.
        </p>
        <button
          className="mt-6 rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => router.push("/upload")}
        >
          Go to Uploads
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Video Editor</h1>
        <p className="mt-2 text-sm text-gray-600">
          Fine-tune processing presets, review generated variants, and spin up social ads.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-4 animate-pulse rounded bg-gray-200" />
          <div className="h-4 animate-pulse rounded bg-gray-200" />
          <div className="h-4 animate-pulse rounded bg-gray-200" />
        </div>
      ) : null}

      {message ? <div className="rounded bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {details ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Original</p>
              {details.originalUrl ? (
                <video controls className="w-full rounded-md shadow">
                  <source src={details.originalUrl} type="video/mp4" />
                </video>
              ) : (
                <div className="rounded border border-dashed p-6 text-sm text-gray-500">
                  Original asset unavailable.
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Processed</p>
              {details.processedUrl ? (
                <video controls className="w-full rounded-md shadow">
                  <source src={details.processedUrl} type="video/mp4" />
                </video>
              ) : (
                <div className="rounded border border-dashed p-6 text-sm text-gray-500">
                  Processed asset not ready yet. Status: {details.status}
                </div>
              )}
            </div>
          </div>

          {variants.length ? (
            <div>
              <p className="mb-3 text-sm font-medium text-gray-700">Variants</p>
              <div className="grid gap-4 md:grid-cols-3">
                {variants.map((variant) => (
                  <div key={variant.label} className="rounded border p-3 text-sm">
                    <p className="font-medium">{variant.label}</p>
                    <video controls className="mt-2 w-full rounded">
                      <source src={variant.url} type="video/mp4" />
                    </video>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded border border-gray-200 p-4">
            <h2 className="text-lg font-semibold">Processing presets</h2>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={options.trimSilence}
                  onChange={(event) => setOptions((prev) => ({ ...prev, trimSilence: event.target.checked }))}
                />
                Trim silence aggressively
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={options.captions}
                  onChange={(event) => setOptions((prev) => ({ ...prev, captions: event.target.checked }))}
                />
                Burn captions into final video
              </label>
              <label className="text-sm">
                Variant preset:
                <select
                  className="ml-2 rounded border px-2 py-1 text-sm"
                  value={options.variants}
                  onChange={(event) => setOptions((prev) => ({ ...prev, variants: event.target.value }))}
                >
                  <option value="smart">Smart mix</option>
                  <option value="vertical">TikTok / Reels (9:16)</option>
                  <option value="square">Square (1:1)</option>
                  <option value="landscape">Landscape (16:9)</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleReprocess}
                className="rounded bg-blue-600 px-4 py-2 text-white"
              >
                Re-run processing
              </button>
              <button
                onClick={handleGenerateAds}
                className="rounded bg-emerald-600 px-4 py-2 text-white"
              >
                Generate social ads
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
