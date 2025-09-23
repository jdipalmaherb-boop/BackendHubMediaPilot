"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Post = { id: string; content: string; scheduledAt: string | null; status: string; createdAt: string };

export default function CalendarPage() {
  const [orgId, setOrgId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!orgId) return setPosts([]);
    const run = async () => {
      const res = await fetch(`${API}/posts?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) return setPosts([]);
      setPosts(await res.json());
    };
    run();
  }, [orgId]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Upcoming Posts</h1>
      <input
        className="border rounded px-3 py-2"
        placeholder="Organization ID"
        value={orgId}
        onChange={(e) => setOrgId(e.target.value)}
      />
      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="border rounded p-3">
            <div className="text-sm text-gray-600">{p.status}</div>
            <div className="font-medium">{p.content}</div>
            <div className="text-sm">{p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : 'Not scheduled'}</div>
          </div>
        ))}
        {!posts.length && <div className="text-gray-600">No posts</div>}
      </div>
    </div>
  );
}





