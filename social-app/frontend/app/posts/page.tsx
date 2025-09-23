"use client";
import { useState, useEffect } from 'react';
import { socialApi } from '../../lib/api';
import { Post } from '../../lib/types';

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId] = useState('org_123'); // In real app, get from auth context

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await socialApi<{ success: boolean; posts: Post[] }>(`/api/posts?orgId=${orgId}`);
      if (response.success) {
        setPosts(response.posts);
      } else {
        setError('Failed to fetch posts');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading posts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchPosts}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Posts</h1>
          <p className="mt-2 text-gray-600">Manage your social media posts and boost performance</p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
            <p className="text-gray-600">Create your first post to get started</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onBoost={fetchPosts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PostCardProps {
  post: Post;
  onBoost: () => void;
}

function PostCard({ post, onBoost }: PostCardProps) {
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [boostResult, setBoostResult] = useState<{ success: boolean; campaignId?: string; error?: string } | null>(null);

  const handleBoost = async (budget: number, duration: number, platforms: string[]) => {
    setBoosting(true);
    try {
      const { boostPost } = await import('../../lib/api');
      const result = await boostPost({
        postId: post.id,
        budget,
        duration,
        platforms
      });
      
      setBoostResult(result);
      if (result.success) {
        onBoost(); // Refresh posts
      }
    } catch (error: any) {
      setBoostResult({ success: false, error: error.message });
    } finally {
      setBoosting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
      case 'PUBLISHED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Post Content */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
              {post.status}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="mb-4">
            <p className="text-gray-900 text-sm leading-relaxed">
              {post.finalCaption || post.content}
            </p>
          </div>

          {/* Platforms */}
          <div className="flex flex-wrap gap-2 mb-4">
            {post.platforms.map((platform) => (
              <span key={platform} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                {platform}
              </span>
            ))}
          </div>

          {/* AI Score */}
          {post.aiScore && (
            <div className="mb-4">
              <div className="flex items-center">
                <span className="text-sm text-gray-600 mr-2">AI Score:</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(post.aiScore / 10) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{post.aiScore}/10</span>
                </div>
              </div>
            </div>
          )}

          {/* Asset Preview */}
          {post.asset && (
            <div className="mb-4">
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                {post.asset.type.startsWith('image/') ? (
                  <img 
                    src={post.asset.url} 
                    alt="Post content" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video 
                    src={post.asset.url} 
                    controls 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowBoostModal(true)}
              disabled={post.status === 'PUBLISHED'}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Boost Post
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Boost Modal */}
      {showBoostModal && (
        <BoostModal
          post={post}
          onClose={() => {
            setShowBoostModal(false);
            setBoostResult(null);
          }}
          onBoost={handleBoost}
          boosting={boosting}
          result={boostResult}
        />
      )}
    </>
  );
}

interface BoostModalProps {
  post: Post;
  onClose: () => void;
  onBoost: (budget: number, duration: number, platforms: string[]) => void;
  boosting: boolean;
  result: { success: boolean; campaignId?: string; error?: string } | null;
}

function BoostModal({ post, onClose, onBoost, boosting, result }: BoostModalProps) {
  const [budget, setBudget] = useState(50);
  const [duration, setDuration] = useState(7);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(post.platforms);

  const platforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBoost(budget, duration, selectedPlatforms);
  };

  if (result) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="text-center">
            {result.success ? (
              <>
                <div className="text-green-600 text-6xl mb-4">✅</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Campaign Created!</h3>
                <p className="text-gray-600 mb-4">
                  Your ad campaign has been created successfully.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600">Campaign ID:</p>
                  <p className="font-mono text-sm text-gray-900">{result.campaignId}</p>
                </div>
              </>
            ) : (
              <>
                <div className="text-red-600 text-6xl mb-4">❌</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
                <p className="text-gray-600 mb-4">{result.error}</p>
              </>
            )}
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Boost Post</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget (USD)
            </label>
            <input
              type="number"
              min="10"
              max="10000"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (days)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platforms
            </label>
            <div className="space-y-2">
              {platforms.map((platform) => (
                <label key={platform} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlatforms([...selectedPlatforms, platform]);
                      } else {
                        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 capitalize">{platform}</span>
                </label>
              ))}
            </div>
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
              disabled={boosting || selectedPlatforms.length === 0}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {boosting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



