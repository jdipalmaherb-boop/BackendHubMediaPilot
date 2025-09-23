import { OAuthProvider } from './types';
import { createMetaProvider } from './providers/meta';

const providers: Record<string, OAuthProvider> = {
  meta: createMetaProvider(),
};

export function getProvider(name: string): OAuthProvider | undefined {
  return providers[name];
}





