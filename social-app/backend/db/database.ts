import { prisma } from './prisma';
import { User, Post, Ad, LandingPage, Lead, Notification } from './generated/client';

export class DatabaseService {
  // User operations
  async createUser(data: {
    email: string;
    password: string;
    orgId: string;
  }): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async getUsersByOrg(orgId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { orgId },
    });
  }

  // Post operations
  async createPost(data: {
    fileUrl: string;
    caption: string;
    platforms: string[];
    scheduledDate?: Date;
    status: string;
    orgId: string;
    userId: string;
  }): Promise<Post> {
    return prisma.post.create({
      data,
    });
  }

  async getPostById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({
      where: { id },
      include: {
        user: true,
        ads: true,
      },
    });
  }

  async getPostsByOrg(orgId: string, limit = 50): Promise<Post[]> {
    return prisma.post.findMany({
      where: { orgId },
      include: {
        user: true,
        ads: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getPostsByUser(userId: string, limit = 50): Promise<Post[]> {
    return prisma.post.findMany({
      where: { userId },
      include: {
        user: true,
        ads: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async updatePostStatus(id: string, status: string): Promise<Post> {
    return prisma.post.update({
      where: { id },
      data: { status },
    });
  }

  async deletePost(id: string): Promise<void> {
    await prisma.post.delete({
      where: { id },
    });
  }

  // Ad operations
  async createAd(data: {
    postId: string;
    campaignId: string;
    budget: number;
    status: string;
  }): Promise<Ad> {
    return prisma.ad.create({
      data,
    });
  }

  async getAdsByPost(postId: string): Promise<Ad[]> {
    return prisma.ad.findMany({
      where: { postId },
    });
  }

  async getAdsByOrg(orgId: string): Promise<Ad[]> {
    return prisma.ad.findMany({
      where: {
        post: {
          orgId,
        },
      },
      include: {
        post: true,
      },
    });
  }

  async updateAdStatus(id: string, status: string): Promise<Ad> {
    return prisma.ad.update({
      where: { id },
      data: { status },
    });
  }

  // Landing Page operations
  async createLandingPage(data: {
    orgId: string;
    headline: string;
    subtext: string;
    ctaText: string;
    ctaUrl: string;
    url: string;
  }): Promise<LandingPage> {
    return prisma.landingPage.create({
      data,
    });
  }

  async getLandingPageById(id: string): Promise<LandingPage | null> {
    return prisma.landingPage.findUnique({
      where: { id },
      include: {
        leads: true,
      },
    });
  }

  async getLandingPagesByOrg(orgId: string): Promise<LandingPage[]> {
    return prisma.landingPage.findMany({
      where: { orgId },
      include: {
        leads: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLandingPageByUrl(url: string): Promise<LandingPage | null> {
    return prisma.landingPage.findUnique({
      where: { url },
      include: {
        leads: true,
      },
    });
  }

  // Lead operations
  async createLead(data: {
    name: string;
    email: string;
    phone?: string;
    landingPageId: string;
    orgId: string;
    userId: string;
  }): Promise<Lead> {
    return prisma.lead.create({
      data,
    });
  }

  async getLeadById(id: string): Promise<Lead | null> {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        user: true,
        landingPage: true,
      },
    });
  }

  async getLeadsByOrg(orgId: string, limit = 100): Promise<Lead[]> {
    return prisma.lead.findMany({
      where: { orgId },
      include: {
        user: true,
        landingPage: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getLeadsByLandingPage(landingPageId: string): Promise<Lead[]> {
    return prisma.lead.findMany({
      where: { landingPageId },
      include: {
        user: true,
        landingPage: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Notification operations
  async createNotification(data: {
    orgId: string;
    type: string;
    message: string;
    userId: string;
  }): Promise<Notification> {
    return prisma.notification.create({
      data,
    });
  }

  async getNotificationsByOrg(orgId: string, limit = 50): Promise<{
    notifications: Notification[];
    unreadCount: number;
  }> {
    const notifications = await prisma.notification.findMany({
      where: { orgId },
      include: {
        user: true,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        orgId,
        read: false,
      },
    });

    return { notifications, unreadCount };
  }

  async getNotificationsByUser(userId: string, limit = 50): Promise<{
    notifications: Notification[];
    unreadCount: number;
  }> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: {
        user: true,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return { notifications, unreadCount };
  }

  async markNotificationsAsRead(notificationIds: string[]): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
      },
      data: {
        read: true,
      },
    });

    return result.count;
  }

  async markAllNotificationsAsRead(orgId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        orgId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return result.count;
  }

  // Analytics operations
  async getPostStats(orgId: string): Promise<{
    total: number;
    published: number;
    scheduled: number;
    pending: number;
  }> {
    const [total, published, scheduled, pending] = await Promise.all([
      prisma.post.count({ where: { orgId } }),
      prisma.post.count({ where: { orgId, status: 'published' } }),
      prisma.post.count({ where: { orgId, status: 'scheduled' } }),
      prisma.post.count({ where: { orgId, status: 'pending' } }),
    ]);

    return { total, published, scheduled, pending };
  }

  async getLeadStats(orgId: string): Promise<{
    total: number;
    thisWeek: number;
    thisMonth: number;
  }> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, thisWeek, thisMonth] = await Promise.all([
      prisma.lead.count({ where: { orgId } }),
      prisma.lead.count({ where: { orgId, createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { orgId, createdAt: { gte: monthAgo } } }),
    ]);

    return { total, thisWeek, thisMonth };
  }

  async getAdStats(orgId: string): Promise<{
    total: number;
    totalBudget: number;
    active: number;
  }> {
    const ads = await prisma.ad.findMany({
      where: {
        post: {
          orgId,
        },
      },
    });

    const total = ads.length;
    const totalBudget = ads.reduce((sum, ad) => sum + ad.budget, 0);
    const active = ads.filter(ad => ad.status === 'active').length;

    return { total, totalBudget, active };
  }
}

export const db = new DatabaseService();
export default db;



