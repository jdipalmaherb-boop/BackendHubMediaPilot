import { createWorker } from '../lib/queue';
import { prisma } from '../lib/prisma';
import { getPublisher } from '../services/publishers';

// Worker to consume publish jobs and mark posts as published
createWorker(async (job) => {
  const { postId } = job.data as { postId: string };
  // Load post and org social account for Meta (placeholder selection)
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post not found');

  const account = await prisma.socialAccount.findFirst({ where: { orgId: post.orgId, provider: 'meta' } });
  if (!account) throw new Error('No Meta account connected for org');

  const publisher = getPublisher('meta');
  if (!publisher) throw new Error('Meta publisher not available');

  // Use AI-enhanced content if available, otherwise fall back to original
  const contentToPublish = post.finalCaption || post.content;
  const mediaUrl = post.editedAssetUrl || (post.asset ? post.asset.url : null);

  // Create enhanced post object for publisher
  const enhancedPost = {
    ...post,
    content: contentToPublish,
    // Add media URL to post data for publisher
    mediaUrl,
    aiScore: post.aiScore,
    aiTips: post.aiTips,
  };

  await publisher.publish(enhancedPost, account);

  await prisma.post.update({ where: { id: postId }, data: { status: 'PUBLISHED' as any } });
});


