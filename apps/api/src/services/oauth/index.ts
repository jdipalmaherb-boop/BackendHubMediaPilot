import type { OAuthProvider } from './types.js';
import { createMetaProvider } from './providers/meta.js';

const providers: Record<string, OAuthProvider> = {
  meta: createMetaProvider(),
};

export function getProvider(name: string): OAuthProvider | undefined {
  return providers[name];
}





