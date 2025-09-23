import axios from 'axios';
import { logger } from './logger.js';
import { Post, SavePostRequest, SavePostResponse, GetPostsResponse } from '../types/post.js';
import { CreateLandingRequest, GoHighLevelResponse, LandingPage, GetLandingPagesResponse } from '../types/landing.js';
import { LeadCaptureRequest, GoHighLevelLeadResponse, Lead } from '../types/lead.js';
import { Notification, CreateNotificationRequest } from '../types/notification.js';

const SCHEDULER_API_BASE_URL = process.env.SCHEDULER_API_BASE_URL || 'http://localhost:4000';

export class SchedulerDbService {
  async saveDraftPost(request: SavePostRequest): Promise<SavePostResponse> {
    try {
      logger.info('Saving draft post', { orgId: request.orgId, platforms: request.platforms });

      const response = await axios.post(`${SCHEDULER_API_BASE_URL}/api/posts`, {
        orgId: request.orgId,
        content: request.caption,
        platforms: request.platforms,
        scheduledAt: request.scheduledDate ? new Date(request.scheduledDate).toISOString() : null,
        status: 'DRAFT', // Save as draft initially
        // Note: In a real implementation, you'd need to handle fileUrl -> assetId conversion
        // For now, we'll store the fileUrl in a custom field or handle it separately
      });

      const post = response.data;
      
      logger.info('Draft post saved successfully', { 
        draftId: post.id, 
        orgId: request.orgId 
      });

      return {
        success: true,
        draftId: post.id,
        message: 'Draft post saved successfully'
      };

    } catch (error: any) {
      logger.error('Failed to save draft post', { 
        error: error.message, 
        orgId: request.orgId 
      });

      return {
        success: false,
        draftId: '',
        message: 'Failed to save draft post',
        error: error.response?.data?.error || error.message
      };
    }
  }

  async getPosts(orgId: string): Promise<GetPostsResponse> {
    try {
      logger.info('Fetching posts for organization', { orgId });

      const response = await axios.get(`${SCHEDULER_API_BASE_URL}/api/posts`, {
        params: { orgId }
      });

      const posts = response.data;

      logger.info('Posts fetched successfully', { 
        orgId, 
        count: posts.length 
      });

      return {
        success: true,
        posts: posts.map((post: any) => ({
          id: post.id,
          orgId: post.orgId,
          content: post.content,
          platforms: post.platforms,
          scheduledAt: post.scheduledAt,
          status: post.status,
          assetId: post.assetId,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        }))
      };

    } catch (error: any) {
      logger.error('Failed to fetch posts', { 
        error: error.message, 
        orgId 
      });

      return {
        success: false,
        posts: [],
        error: error.response?.data?.error || error.message
      };
    }
  }

  async updatePostStatus(postId: string, status: string): Promise<boolean> {
    try {
      logger.info('Updating post status', { postId, status });

      await axios.patch(`${SCHEDULER_API_BASE_URL}/api/posts/${postId}`, {
        status
      });

      logger.info('Post status updated successfully', { postId, status });
      return true;

    } catch (error: any) {
      logger.error('Failed to update post status', { 
        error: error.message, 
        postId, 
        status 
      });
      return false;
    }
  }

  async storeLandingPage(request: CreateLandingRequest, goHighLevelResponse: GoHighLevelResponse): Promise<LandingPage> {
    try {
      logger.info('Storing landing page in database', { 
        orgId: request.orgId, 
        slug: goHighLevelResponse.slug 
      });

      const response = await axios.post(`${SCHEDULER_API_BASE_URL}/api/landing`, {
        orgId: request.orgId,
        slug: goHighLevelResponse.slug,
        headline: request.headline,
        subtext: request.subtext,
        ctaText: request.ctaText,
        ctaUrl: request.ctaUrl,
      });

      const landingPage = response.data;
      
      logger.info('Landing page stored successfully', { 
        landingPageId: landingPage.id, 
        orgId: request.orgId 
      });

      return {
        id: landingPage.id,
        orgId: landingPage.orgId,
        slug: landingPage.slug,
        headline: landingPage.headline,
        subtext: landingPage.subtext,
        ctaText: landingPage.ctaText,
        ctaUrl: landingPage.ctaUrl,
        url: goHighLevelResponse.url,
        status: landingPage.status || 'active',
        createdAt: landingPage.createdAt,
        updatedAt: landingPage.updatedAt
      };

    } catch (error: any) {
      logger.error('Failed to store landing page', { 
        error: error.message, 
        orgId: request.orgId 
      });
      throw new Error(`Failed to store landing page: ${error.message}`);
    }
  }

  async getLandingPages(orgId: string): Promise<GetLandingPagesResponse> {
    try {
      logger.info('Fetching landing pages for organization', { orgId });

      const response = await axios.get(`${SCHEDULER_API_BASE_URL}/api/landing`, {
        params: { orgId }
      });

      const landingPages = response.data;

      logger.info('Landing pages fetched successfully', { 
        orgId, 
        count: landingPages.length 
      });

      return {
        success: true,
        landingPages: landingPages.map((lp: any) => ({
          id: lp.id,
          orgId: lp.orgId,
          slug: lp.slug,
          headline: lp.headline,
          subtext: lp.subtext,
          ctaText: lp.ctaText,
          ctaUrl: lp.ctaUrl,
          url: lp.url || `https://example.com/lp/${lp.slug}`, // Fallback URL
          status: lp.status,
          createdAt: lp.createdAt,
          updatedAt: lp.updatedAt
        }))
      };

    } catch (error: any) {
      logger.error('Failed to fetch landing pages', { 
        error: error.message, 
        orgId 
      });

      return {
        success: false,
        landingPages: [],
        error: error.response?.data?.error || error.message
      };
    }
  }

  async storeLead(request: LeadCaptureRequest, goHighLevelResponse: GoHighLevelLeadResponse): Promise<Lead> {
    try {
      logger.info('Storing lead in database', { 
        email: request.email, 
        landingPageId: request.landingPageId 
      });

      const response = await axios.post(`${SCHEDULER_API_BASE_URL}/api/leads`, {
        name: request.name,
        email: request.email,
        phone: request.phone,
        landingPageId: request.landingPageId,
        source: request.source || 'social_post',
        status: goHighLevelResponse.status,
        goHighLevelContactId: goHighLevelResponse.contactId,
        metadata: request.metadata || {}
      });

      const lead = response.data;
      
      logger.info('Lead stored successfully', { 
        leadId: lead.id, 
        email: request.email 
      });

      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        landingPageId: lead.landingPageId,
        source: lead.source,
        status: lead.status,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt
      };

    } catch (error: any) {
      logger.error('Failed to store lead', { 
        error: error.message, 
        email: request.email 
      });
      throw new Error(`Failed to store lead: ${error.message}`);
    }
  }

  async createNotification(request: CreateNotificationRequest): Promise<Notification> {
    try {
      logger.info('Creating notification', { 
        orgId: request.orgId, 
        type: request.type 
      });

      const response = await axios.post(`${SCHEDULER_API_BASE_URL}/api/notifications`, {
        orgId: request.orgId,
        type: request.type,
        message: request.message,
        metadata: request.metadata || {},
      });

      const notification = response.data;
      
      logger.info('Notification created successfully', { 
        notificationId: notification.id, 
        orgId: request.orgId 
      });

      return {
        id: notification.id,
        orgId: notification.orgId,
        type: notification.type,
        message: notification.message,
        timestamp: notification.timestamp,
        read: notification.read,
        metadata: notification.metadata
      };

    } catch (error: any) {
      logger.error('Failed to create notification', { 
        error: error.message, 
        orgId: request.orgId 
      });
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  async getNotifications(orgId: string, limit = 50): Promise<{ notifications: Notification[]; unreadCount: number }> {
    try {
      logger.info('Fetching notifications for organization', { orgId, limit });

      const response = await axios.get(`${SCHEDULER_API_BASE_URL}/api/notifications`, {
        params: { orgId, limit }
      });

      const data = response.data;
      
      logger.info('Notifications fetched successfully', { 
        orgId, 
        count: data.notifications.length,
        unreadCount: data.unreadCount
      });

      return {
        notifications: data.notifications.map((n: any) => ({
          id: n.id,
          orgId: n.orgId,
          type: n.type,
          message: n.message,
          timestamp: n.timestamp,
          read: n.read,
          metadata: n.metadata
        })),
        unreadCount: data.unreadCount
      };

    } catch (error: any) {
      logger.error('Failed to fetch notifications', { 
        error: error.message, 
        orgId 
      });
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }
  }

  async markNotificationsAsRead(notificationIds: string[]): Promise<number> {
    try {
      logger.info('Marking notifications as read', { notificationIds });

      const response = await axios.post(`${SCHEDULER_API_BASE_URL}/api/notifications/mark-read`, {
        notificationIds
      });

      const updatedCount = response.data.updatedCount;
      
      logger.info('Notifications marked as read successfully', { 
        notificationIds, 
        updatedCount 
      });

      return updatedCount;

    } catch (error: any) {
      logger.error('Failed to mark notifications as read', { 
        error: error.message, 
        notificationIds 
      });
      throw new Error(`Failed to mark notifications as read: ${error.message}`);
    }
  }
}

export const schedulerDbService = new SchedulerDbService();