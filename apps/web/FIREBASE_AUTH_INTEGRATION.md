# Firebase Authentication Integration Guide

## Client Setup

Create pps/web/src/lib/firebase.ts:
`	s
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

export const firebaseAuth = getAuth(app);
`

## API Helper Usage

pps/web/src/lib/api.ts:
`	s
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function apiFetch(path, init = {}, tokenCallback) {
  const token = tokenCallback ? await tokenCallback() : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
    ...(token ? { Authorization: Bearer  } : {}),
  };
  const res = await fetch(${API_BASE}, { ...init, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
`

## Example Component

`	sx
import { useEffect, useState } from 'react';
import { firebaseAuth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';

export function ProtectedData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiFetch('/api/test-auth', {}, async () => {
          const user = firebaseAuth.currentUser;
          return user ? await user.getIdToken() : null;
        });
        setData(response);
      } catch (err: any) {
        setError(err?.message ?? 'Request failed');
      }
    };

    load();
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading…</p>;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
`

## Getting a Token

`	s
const user = firebaseAuth.currentUser;
const token = user ? await user.getIdToken(/* forceRefresh */) : null;
`

## Environment Variables

Set in pps/web/.env.local:
`
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_API_URL=https://fragmented-lanell-enabling.ngrok-free.dev
`

## Testing

1. Sign in with Firebase on the frontend.
2. Call piFetch('/api/test-auth', {}, async () => firebaseAuth.currentUser?.getIdToken()).
3. The API should return the decoded user or a 401 if the token is missing/invalid.
