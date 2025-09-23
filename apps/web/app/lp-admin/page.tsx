"use client";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LandingAdminPage() {
  const [orgId, setOrgId] = useState("");
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`${API}/api/landing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, slug, headline, subtext, ctaText, ctaUrl }),
    });
    if (!res.ok) return setMsg(`Failed: ${res.status}`);
    const data = await res.json();
    setMsg(`Created landing page ${data.slug}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Landing Pages</h1>
      <form onSubmit={onSubmit} className="space-y-3 border rounded p-4">
        <input className="w-full border rounded px-3 py-2" placeholder="Organization ID" value={orgId} onChange={(e) => setOrgId(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Subtext" value={subtext} onChange={(e) => setSubtext(e.target.value)} required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="CTA Text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="CTA URL" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} required />
        </div>
        <button className="bg-blue-600 text-white rounded px-3 py-2">Create</button>
      </form>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}





