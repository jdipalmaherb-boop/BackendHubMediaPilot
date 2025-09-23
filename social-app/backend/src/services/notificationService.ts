import { Notification, NotificationType, CreateNotificationRequest, NotificationEvent } from '../types/notification';
import { schedulerDbService } from './schedulerDbService';
import { logger } from './logger';

export class NotificationService {
  private static instance: NotificationService;
  private eventQueue: NotificationEvent[] = [];
  private processing = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification
   */
  async createNotification(request: CreateNotificationRequest): Promise<Notification> {
    try {
      const notification = await schedulerDbService.createNotification({
        orgId: request.orgId,
        type: request.type,
        message: request.message,
        metadata: request.metadata || {},
      });

      logger.info('Notification created', {
        notificationId: notification.id,
        orgId: request.orgId,
        type: request.type,
      });

      return notification;
    } catch (error) {
      logger.error('Failed to create notification', { error, request });
      throw error;
    }
  }

  /**
   * Queue a notification event for processing
   */
  queueNotification(event: NotificationEvent): void {
    this.eventQueue.push(event);
    this.processQueue();
  }

  /**
   * Process queued notification events
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (!event) continue;

      try {
        await this.createNotification({
          orgId: event.orgId,
          type: event.type,
          message: event.message,
          metadata: event.metadata,
        });
      } catch (error) {
        logger.error('Failed to process notification event', { error, event });
        // Re-queue the event for retry
        this.eventQueue.unshift(event);
        break;
      }
    }

    this.processing = false;
  }

  /**
   * Get notifications for an organization
   */
  async getNotifications(orgId: string, limit = 50): Promise<{ notifications: Notification[]; unreadCount: number }> {
    try {
      const result = await schedulerDbService.getNotifications(orgId, limit);
      return result;
    } catch (error) {
      logger.error('Failed to get notifications', { error, orgId });
      throw error;
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(notificationIds: string[]): Promise<number> {
    try {
      const updatedCount = await schedulerDbService.markNotificationsAsRead(notificationIds);
      
      logger.info('Notifications marked as read', {
        notificationIds,
        updatedCount,
      });

      return updatedCount;
    } catch (error) {
      logger.error('Failed to mark notifications as read', { error, notificationIds });
      throw error;
    }
  }

  /**
   * Create notification for post events
   */
  async notifyPostPublished(orgId: string, postId: string, platforms: string[]): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'post_published',
      message: `Post published successfully to ${platforms.join(', ')}`,
      metadata: { postId, platforms },
    });
  }

  async notifyPostFailed(orgId: string, postId: string, error: string): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'post_failed',
      message: `Post failed to publish: ${error}`,
      metadata: { postId, error },
    });
  }

  /**
   * Create notification for ad campaign events
   */
  async notifyAdCampaignCompleted(orgId: string, campaignId: string, campaignName: string): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'ad_campaign_completed',
      message: `Ad campaign "${campaignName}" completed successfully`,
      metadata: { campaignId, campaignName },
    });
  }

  async notifyAdCampaignFailed(orgId: string, campaignId: string, campaignName: string, error: string): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'ad_campaign_failed',
      message: `Ad campaign "${campaignName}" failed: ${error}`,
      metadata: { campaignId, campaignName, error },
    });
  }

  /**
   * Create notification for lead capture events
   */
  async notifyLeadCaptured(orgId: string, leadId: string, leadName: string, source: string): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'lead_captured',
      message: `New lead captured: ${leadName} from ${source}`,
      metadata: { leadId, leadName, source },
    });
  }

  /**
   * Create notification for landing page events
   */
  async notifyLandingPageCreated(orgId: string, landingPageId: string, headline: string): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'landing_page_created',
      message: `Landing page created: "${headline}"`,
      metadata: { landingPageId, headline },
    });
  }

  /**
   * Create notification for boost post events
   */
  async notifyBoostPostCreated(orgId: string, postId: string, campaignId: string): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'boost_post_created',
      message: `Post boosted with ad campaign`,
      metadata: { postId, campaignId },
    });
  }

  /**
   * Create notification for AI processing events
   */
  async notifyAiProcessingCompleted(orgId: string, postId: string, type: 'caption' | 'edit' | 'feedback'): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'ai_processing_completed',
      message: `AI ${type} processing completed for post`,
      metadata: { postId, type },
    });
  }

  async notifyAiProcessingFailed(orgId: string, postId: string, type: 'caption' | 'edit' | 'feedback', error: string): Promise<void> {
    this.queueNotification({
      orgId,
      type: 'ai_processing_failed',
      message: `AI ${type} processing failed: ${error}`,
      metadata: { postId, type, error },
    });
  }
}

export const notificationService = NotificationService.getInstance();