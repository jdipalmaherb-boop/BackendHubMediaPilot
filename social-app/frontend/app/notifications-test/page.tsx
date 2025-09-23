"use client";
import { useState } from 'react';
import { api } from '../../lib/api';

export default function NotificationsTestPage() {
  const [orgId, setOrgId] = useState('org_123');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const createTestNotification = async (type: string, message: string) => {
    setLoading(true);
    try {
      const response = await api('/api/notifications/test', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          type,
          message,
        }),
      });

      if (response.success) {
        setResult(`✅ Test notification created: ${message}`);
      } else {
        setResult(`❌ Failed to create notification: ${response.error}`);
      }
    } catch (error: any) {
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testNotifications = [
    {
      type: 'post_published',
      message: 'Post published successfully to Instagram, Facebook',
    },
    {
      type: 'post_failed',
      message: 'Post failed to publish: Rate limit exceeded',
    },
    {
      type: 'ad_campaign_completed',
      message: 'Ad campaign "Summer Sale" completed successfully',
    },
    {
      type: 'ad_campaign_failed',
      message: 'Ad campaign "Product Launch" failed: Insufficient budget',
    },
    {
      type: 'lead_captured',
      message: 'New lead captured: John Doe from social_post',
    },
    {
      type: 'landing_page_created',
      message: 'Landing page created: "Get Started Today"',
    },
    {
      type: 'boost_post_created',
      message: 'Post boosted with ad campaign',
    },
    {
      type: 'ai_processing_completed',
      message: 'AI caption processing completed for post',
    },
    {
      type: 'ai_processing_failed',
      message: 'AI edit processing failed: Invalid file format',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Notifications Test Page</h1>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization ID
            </label>
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter organization ID"
            />
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Notifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testNotifications.map((notification, index) => (
                <button
                  key={index}
                  onClick={() => createTestNotification(notification.type, notification.message)}
                  disabled={loading}
                  className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium text-gray-900 mb-1">
                    {notification.type.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-600">
                    {notification.message}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {result && (
            <div className="p-4 bg-gray-100 rounded-lg">
              <pre className="text-sm text-gray-700">{result}</pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Enter an organization ID (default: org_123)</li>
              <li>2. Click any test notification button to create a sample notification</li>
              <li>3. Check the notification bell icon in the top navigation</li>
              <li>4. Click the bell to see the dropdown with notifications</li>
              <li>5. Click on unread notifications to mark them as read</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}



