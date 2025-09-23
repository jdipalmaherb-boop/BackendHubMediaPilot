import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create organizations
  const org1 = await prisma.user.create({
    data: {
      email: 'admin@socialapp.com',
      password: 'hashed_password_123', // In production, this should be properly hashed
      orgId: 'org_123',
    },
  });

  const org2 = await prisma.user.create({
    data: {
      email: 'user@company.com',
      password: 'hashed_password_456',
      orgId: 'org_456',
    },
  });

  console.log('✅ Created users:', { org1: org1.id, org2: org2.id });

  // Create sample posts
  const post1 = await prisma.post.create({
    data: {
      fileUrl: 'https://example.com/images/post1.jpg',
      caption: 'Check out our new product launch! 🚀 #innovation #startup',
      platforms: ['instagram', 'facebook', 'twitter'],
      status: 'published',
      orgId: 'org_123',
      userId: org1.id,
      scheduledDate: new Date(),
    },
  });

  const post2 = await prisma.post.create({
    data: {
      fileUrl: 'https://example.com/videos/post2.mp4',
      caption: 'Behind the scenes of our team working hard 💪 #teamwork #motivation',
      platforms: ['instagram', 'tiktok'],
      status: 'scheduled',
      orgId: 'org_123',
      userId: org1.id,
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    },
  });

  console.log('✅ Created posts:', { post1: post1.id, post2: post2.id });

  // Create sample ads
  const ad1 = await prisma.ad.create({
    data: {
      postId: post1.id,
      campaignId: 'campaign_123',
      budget: 100.50,
      status: 'active',
    },
  });

  const ad2 = await prisma.ad.create({
    data: {
      postId: post2.id,
      campaignId: 'campaign_456',
      budget: 250.75,
      status: 'pending',
    },
  });

  console.log('✅ Created ads:', { ad1: ad1.id, ad2: ad2.id });

  // Create sample landing pages
  const landingPage1 = await prisma.landingPage.create({
    data: {
      orgId: 'org_123',
      headline: 'Get Started Today',
      subtext: 'Join thousands of users who are already growing their business',
      ctaText: 'Sign Up Now',
      ctaUrl: 'https://app.socialapp.com/signup',
      url: 'https://socialapp.com/get-started',
    },
  });

  const landingPage2 = await prisma.landingPage.create({
    data: {
      orgId: 'org_456',
      headline: 'Free Trial Available',
      subtext: 'Try our premium features for 14 days, no credit card required',
      ctaText: 'Start Free Trial',
      ctaUrl: 'https://app.socialapp.com/trial',
      url: 'https://socialapp.com/free-trial',
    },
  });

  console.log('✅ Created landing pages:', { 
    landingPage1: landingPage1.id, 
    landingPage2: landingPage2.id 
  });

  // Create sample leads
  const lead1 = await prisma.lead.create({
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      landingPageId: landingPage1.id,
      orgId: 'org_123',
      userId: org1.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      name: 'Jane Smith',
      email: 'jane@company.com',
      phone: '+0987654321',
      landingPageId: landingPage2.id,
      orgId: 'org_456',
      userId: org2.id,
    },
  });

  const lead3 = await prisma.lead.create({
    data: {
      name: 'Bob Johnson',
      email: 'bob@startup.io',
      landingPageId: landingPage1.id,
      orgId: 'org_123',
      userId: org1.id,
    },
  });

  console.log('✅ Created leads:', { 
    lead1: lead1.id, 
    lead2: lead2.id, 
    lead3: lead3.id 
  });

  // Create sample notifications
  const notification1 = await prisma.notification.create({
    data: {
      orgId: 'org_123',
      type: 'post_published',
      message: 'Post published successfully to Instagram, Facebook',
      userId: org1.id,
    },
  });

  const notification2 = await prisma.notification.create({
    data: {
      orgId: 'org_123',
      type: 'lead_captured',
      message: 'New lead captured: John Doe from landing page',
      userId: org1.id,
    },
  });

  const notification3 = await prisma.notification.create({
    data: {
      orgId: 'org_456',
      type: 'ad_campaign_completed',
      message: 'Ad campaign "Summer Sale" completed successfully',
      userId: org2.id,
      read: true,
    },
  });

  console.log('✅ Created notifications:', { 
    notification1: notification1.id, 
    notification2: notification2.id, 
    notification3: notification3.id 
  });

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



