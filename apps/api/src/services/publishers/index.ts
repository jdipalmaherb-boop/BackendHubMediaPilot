import type { PublisherAdapter, ProviderName } from './types.js';
import { metaPublisher } from './meta.js';

const adapters: Record<ProviderName, PublisherAdapter> = {
  meta: metaPublisher,
  linkedin: {
    name: 'linkedin',
    async publish() {
      throw new Error('LinkedIn publisher not implemented');
    },
  },
  tiktok: {
    name: 'tiktok',
    async publish() {
      throw new Error('TikTok publisher not implemented');
    },
  },
};

export function getPublisher(provider: string): PublisherAdapter | undefined {
  return adapters[provider as ProviderName];
}





