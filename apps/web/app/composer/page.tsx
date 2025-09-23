"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Asset = { id: string; key: string; url: string };

export default function ComposerPage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
  const [orgId, setOrgId] = useState(params?.get('orgId') || "");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState(params?.get('assetId') || "");
  const [content, setContent] = useState(params?.get('content') || "");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return setAssets([]);
    const run = async () => {
      const res = await fetch(`${API}/assets?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) return setAssets([]);
      setAssets(await res.json());
    };
    run();
  }, [orgId]);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const body = {
      orgId,
      assetId: assetId || undefined,
      content,
      platforms,
      scheduledAt: scheduledAt || undefined,
    };
    const res = await fetch(`${API}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return setMessage(`Failed: ${res.status}`);
    const post = await res.json();
    setMessage(`Saved post ${post.id}`);
    setContent("");
    setScheduledAt("");
    setAssetId("");
    setPlatforms([]);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Composer</h1>
      <form onSubmit={onSubmit} className="space-y-3 border rounded p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Organization ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
          />
          <select
            className="border rounded px-3 py-2"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="">No Asset</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.key}</option>
            ))}
          </select>
        </div>

        <textarea
          className="w-full border rounded px-3 py-2"
          placeholder="Write caption..."
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />

        <div className="flex items-center gap-4">
          {['meta', 'linkedin', 'tiktok'].map((p) => (
            <label key={p} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
              <span className="capitalize">{p}</span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="datetime-local"
            className="border rounded px-3 py-2"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        <button className="bg-blue-600 text-white rounded px-3 py-2">Save</button>
      </form>

      {message && <p className="text-sm text-gray-700">{message}</p>}
    </div>
  );
}


