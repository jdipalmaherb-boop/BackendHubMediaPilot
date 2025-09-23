import { Notification, NotificationRequest } from '../types/notification.js';

// In-memory queue for development (replace with Redis in production)
class NotificationQueue {
  private notifications: Notification[] = [];
  private subscribers: Set<(notification: Notification) => void> = new Set();

  async add(notification: NotificationRequest): Promise<Notification> {
    const newNotification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orgId: notification.orgId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      read: false,
      createdAt: new Date().toISOString(),
      priority: notification.priority || 'medium',
    };

    this.notifications.unshift(newNotification); // Add to beginning for newest first
    
    // Notify subscribers (for real-time updates)
    this.subscribers.forEach(callback => callback(newNotification));
    
    // Keep only last 1000 notifications per org
    this.cleanup(notification.orgId);
    
    return newNotification;
  }

  async getByOrgId(orgId: string, limit: number = 50): Promise<Notification[]> {
    return this.notifications
      .filter(n => n.orgId === orgId)
      .slice(0, limit);
  }

  async markAsRead(notificationId: string, orgId: string): Promise<boolean> {
    const notification = this.notifications.find(n => n.id === notificationId && n.orgId === orgId);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }

  async markAllAsRead(orgId: string): Promise<number> {
    const count = this.notifications
      .filter(n => n.orgId === orgId && !n.read)
      .map(n => { n.read = true; return n; }).length;
    return count;
  }

  async getUnreadCount(orgId: string): Promise<number> {
    return this.notifications.filter(n => n.orgId === orgId && !n.read).length;
  }

  subscribe(callback: (notification: Notification) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private cleanup(orgId: string): void {
    const orgNotifications = this.notifications.filter(n => n.orgId === orgId);
    if (orgNotifications.length > 1000) {
      // Remove oldest notifications beyond limit
      const toRemove = orgNotifications.slice(1000);
      this.notifications = this.notifications.filter(n => !toRemove.includes(n));
    }
  }
}

export const notificationQueue = new NotificationQueue();



