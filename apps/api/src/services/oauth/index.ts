import type { OAuthProvider } from './types';

export function getProvider(provider: string): OAuthProvider | null {
  switch (provider) {
    case 'meta': {
      const { createMetaProvider } = require('./providers/meta');
      return createMetaProvider();
    }
    case 'tiktok': {
      const { createTikTokProvider } = require('./providers/tiktok');
      return createTikTokProvider();
    }
    case 'youtube': {
      const { createYouTubeProvider } = require('./providers/youtube');
      return createYouTubeProvider();
    }
    case 'linkedin': {
      const { createLinkedInProvider } = require('./providers/linkedin');
      return createLinkedInProvider();
    }
    default:
      return null;
  }
}
