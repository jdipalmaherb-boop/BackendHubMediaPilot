import type { Post, SocialAccount } from '@prisma/client';
import type { PublisherAdapter } from './types.js';

export const metaPublisher: PublisherAdapter = {
  name: 'meta',
  async publish(post: Post, account: SocialAccount): Promise<void> {
    // Placeholder: implement Meta Graph API publish here
    // eslint-disable-next-line no-console
    console.log('Publishing to Meta', {
      postId: post.id,
      orgId: post.orgId,
      accountId: account.id,
      providerAccountId: account.providerAccountId,
    });
  },
};





