import admin from 'firebase-admin';

function parseServiceAccount(raw: string) {
  const trimmed = raw.trim();

  // raw JSON pasted into env
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  // base64 JSON
  const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
  return JSON.parse(decoded);
}

export function getFirebaseAdmin() {
  if (admin.apps.length) return admin;

  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_ADMIN_CREDENTIALS ||
    '';

  if (!raw) {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON or base64 JSON).'
    );
  }

  const serviceAccount = parseServiceAccount(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });

  return admin;
}
