import type { Post, SocialAccount } from '@prisma/client';

export type ProviderName = 'meta' | 'linkedin' | 'tiktok';

export interface PublisherAdapter {
  name: ProviderName;
  publish(post: Post, account: SocialAccount): Promise<void>;
}





