"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { socialApi, createLandingPage, CreateLandingPageRequest, captureLead, LeadCaptureRequest } from '../../lib/api';

export default function ComposerPage() {
  const searchParams = useSearchParams();
  const [orgId] = useState('org_123'); // In real app, get from auth context
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [assetId, setAssetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Landing page state
  const [showLandingPageForm, setShowLandingPageForm] = useState(false);
  const [landingPageData, setLandingPageData] = useState({
    headline: '',
    subtext: '',
    ctaText: '',
    ctaUrl: ''
  });
  const [creatingLandingPage, setCreatingLandingPage] = useState(false);
  const [landingPageResult, setLandingPageResult] = useState<{ success: boolean; url?: string; error?: string; landingPageId?: string } | null>(null);
  const [testingLeadCapture, setTestingLeadCapture] = useState(false);
  const [leadCaptureResult, setLeadCaptureResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  // Pre-fill from URL params
  useEffect(() => {
    const contentParam = searchParams.get('content');
    const assetIdParam = searchParams.get('assetId');
    const mediaUrlParam = searchParams.get('mediaUrl');
    const aiScoreParam = searchParams.get('aiScore');
    
    if (contentParam) setContent(decodeURIComponent(contentParam));
    if (assetIdParam) setAssetId(assetIdParam);
  }, [searchParams]);

  const handlePlatformChange = (platform: string) => {
    setPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleCreateLandingPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingLandingPage(true);
    setMessage(null);

    try {
      const request: CreateLandingPageRequest = {
        orgId,
        headline: landingPageData.headline,
        subtext: landingPageData.subtext,
        ctaText: landingPageData.ctaText,
        ctaUrl: landingPageData.ctaUrl
      };

      const result = await createLandingPage(request);
      
      if (result.success) {
        setLandingPageResult({
          success: true,
          url: result.url,
          landingPageId: result.landingPageId
        });
        setShowLandingPageForm(false);
        setMessage(`Landing page created successfully! URL: ${result.url}`);
      } else {
        setLandingPageResult({
          success: false,
          error: result.error || 'Failed to create landing page'
        });
      }
    } catch (error: any) {
      setLandingPageResult({
        success: false,
        error: error.message || 'Failed to create landing page'
      });
    } finally {
      setCreatingLandingPage(false);
    }
  };

  const handleTestLeadCapture = async () => {
    if (!landingPageResult?.landingPageId) {
      setMessage('Please create a landing page first');
      return;
    }

    setTestingLeadCapture(true);
    setMessage(null);

    try {
      const request: LeadCaptureRequest = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        landingPageId: landingPageResult.landingPageId,
        source: 'test_capture',
        metadata: {
          testMode: true,
          timestamp: new Date().toISOString()
        }
      };

      const result = await captureLead(request);
      
      if (result.success) {
        setLeadCaptureResult({
          success: true,
          message: result.message || 'Lead captured successfully!'
        });
        setMessage(`Test lead captured! Lead ID: ${result.leadId}`);
      } else {
        setLeadCaptureResult({
          success: false,
          error: result.error || 'Failed to capture lead'
        });
      }
    } catch (error: any) {
      setLeadCaptureResult({
        success: false,
        error: error.message || 'Failed to capture lead'
      });
    } finally {
      setTestingLeadCapture(false);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || platforms.length === 0) {
      setMessage('Please fill in content and select at least one platform');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await socialApi<{ success: boolean; draftId: string; message: string }>('/api/posts/save', {
        method: 'POST',
        body: JSON.stringify({
          fileUrl: '', // Will be populated from assetId in real implementation
          caption: content,
          platforms,
          scheduledDate: scheduledDate || undefined,
          orgId
        })
      });

      if (response.success) {
        setMessage(`Post saved successfully! Draft ID: ${response.draftId}`);
        // Reset form
        setContent('');
        setPlatforms([]);
        setScheduledDate('');
        setAssetId('');
      } else {
        setMessage('Failed to save post');
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to save post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Post Composer</h1>
          <p className="mt-2 text-gray-600">Create and schedule your social media posts</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSavePost} className="space-y-6">
            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Post Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What's on your mind?"
                required
              />
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platforms
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter'].map((platform) => (
                  <label key={platform} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={platforms.includes(platform)}
                      onChange={() => handlePlatformChange(platform)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{platform}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Landing Page Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Landing Page</h3>
                <div className="flex gap-2">
                  {landingPageResult?.success && (
                    <button
                      type="button"
                      onClick={handleTestLeadCapture}
                      disabled={testingLeadCapture}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingLeadCapture ? 'Testing...' : 'Test Lead Capture'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLandingPageForm(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    Create Landing Page
                  </button>
                </div>
              </div>
              
              {landingPageResult && (
                <div className={`p-4 rounded-md ${
                  landingPageResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {landingPageResult.success ? (
                    <div>
                      <p className="text-green-800 font-medium">Landing page created successfully!</p>
                      <p className="text-green-700 text-sm mt-1">
                        URL: <a href={landingPageResult.url} target="_blank" rel="noopener noreferrer" className="underline">
                          {landingPageResult.url}
                        </a>
                      </p>
                    </div>
                  ) : (
                    <p className="text-red-800">{landingPageResult.error}</p>
                  )}
                </div>
              )}

              {leadCaptureResult && (
                <div className={`mt-4 p-4 rounded-md ${
                  leadCaptureResult.success 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {leadCaptureResult.success ? (
                    <div>
                      <p className="text-blue-800 font-medium">Lead capture test successful!</p>
                      <p className="text-blue-700 text-sm mt-1">{leadCaptureResult.message}</p>
                    </div>
                  ) : (
                    <p className="text-red-800">{leadCaptureResult.error}</p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading || !content || platforms.length === 0}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Post'}
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {message && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-800">{message}</p>
          </div>
        )}
      </div>

      {/* Landing Page Creation Modal */}
      {showLandingPageForm && (
        <LandingPageModal
          data={landingPageData}
          onChange={setLandingPageData}
          onSubmit={handleCreateLandingPage}
          onClose={() => {
            setShowLandingPageForm(false);
            setLandingPageResult(null);
          }}
          loading={creatingLandingPage}
        />
      )}
    </div>
  );
}

interface LandingPageModalProps {
  data: {
    headline: string;
    subtext: string;
    ctaText: string;
    ctaUrl: string;
  };
  onChange: (data: typeof LandingPageModalProps.prototype.data) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  loading: boolean;
}

function LandingPageModal({ data, onChange, onSubmit, onClose, loading }: LandingPageModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create Landing Page</h3>
        
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Headline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Headline
            </label>
            <input
              type="text"
              value={data.headline}
              onChange={(e) => onChange({ ...data, headline: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your compelling headline"
              required
            />
          </div>

          {/* Subtext */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subtext
            </label>
            <textarea
              value={data.subtext}
              onChange={(e) => onChange({ ...data, subtext: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Supporting text that explains your offer"
              required
            />
          </div>

          {/* CTA Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call-to-Action Text
            </label>
            <input
              type="text"
              value={data.ctaText}
              onChange={(e) => onChange({ ...data, ctaText: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Get Started Now"
              required
            />
          </div>

          {/* CTA URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call-to-Action URL
            </label>
            <input
              type="url"
              value={data.ctaUrl}
              onChange={(e) => onChange({ ...data, ctaUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/signup"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Landing Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
