"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const user = await api("/api/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ email, name }),
      });
      setMessage(`Logged in as ${user.email}`);
    } catch (err: any) {
      setMessage(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-lg p-6">
        <h1 className="text-xl font-semibold">Developer Login</h1>
        <p className="text-sm text-gray-600">DO NOT USE IN PRODUCTION</p>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Name (optional)"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button disabled={loading} className="w-full bg-blue-600 text-white rounded px-3 py-2 disabled:opacity-60">
          {loading ? "Logging in..." : "Login"}
        </button>
        {message && <div className="text-sm text-gray-700">{message}</div>}
      </form>
    </div>
  );
}





