export interface Notification {
  id: string;
  orgId: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

export type NotificationType = 
  | 'post_published'
  | 'post_failed'
  | 'ad_campaign_completed'
  | 'ad_campaign_failed'
  | 'lead_captured'
  | 'landing_page_created'
  | 'boost_post_created'
  | 'ai_processing_completed'
  | 'ai_processing_failed';

export interface CreateNotificationRequest {
  orgId: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any>;
}

export interface GetNotificationsResponse {
  success: boolean;
  notifications: Notification[];
  unreadCount: number;
  error?: string;
}

export interface MarkReadRequest {
  notificationIds: string[];
}

export interface MarkReadResponse {
  success: boolean;
  updatedCount: number;
  error?: string;
}

export interface NotificationEvent {
  orgId: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any>;
}