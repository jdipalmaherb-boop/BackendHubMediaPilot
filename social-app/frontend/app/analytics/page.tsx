"use client";
import { useState, useEffect } from 'react';
import { socialApi, getAdCampaignStatus, getLeadList, AdCampaignStatus, LeadData } from '../../lib/api';
import { Post, LandingPage, AnalyticsFilters } from '../../lib/types';
import PostPerformanceChart from '../../components/PostPerformanceChart';
import AdPerformanceChart from '../../components/AdPerformanceChart';
import LeadConversionChart from '../../components/LeadConversionChart';

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    orgId: '',
    platform: '',
    dateFrom: '',
    dateTo: '',
  });
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaignStatus[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    if (!filters.orgId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch posts from social app backend
      const postsResponse = await socialApi<{ success: boolean; posts: Post[] }>(`/api/posts?orgId=${encodeURIComponent(filters.orgId)}`);
      if (postsResponse.success) {
        setPosts(postsResponse.posts);
      } else {
        throw new Error('Failed to fetch posts');
      }

      // Fetch ad campaign status
      try {
        const campaignsResponse = await getAdCampaignStatus(filters.orgId);
        if (campaignsResponse.success) {
          setCampaigns(campaignsResponse.campaigns);
        } else {
          console.warn('Failed to fetch ad campaigns:', campaignsResponse.error);
          setCampaigns([]);
        }
      } catch (err) {
        console.warn('Ad campaigns API not available:', err);
        setCampaigns([]);
      }

      // Fetch leads
      try {
        const leadsResponse = await getLeadList(filters.orgId);
        if (leadsResponse.success) {
          setLeads(leadsResponse.leads);
        } else {
          console.warn('Failed to fetch leads:', leadsResponse.error);
          setLeads([]);
        }
      } catch (err) {
        console.warn('Leads API not available:', err);
        setLeads([]);
      }

      // Fetch landing pages
      try {
        const landingPagesResponse = await socialApi<{ success: boolean; landingPages: LandingPage[] }>(`/api/landing?orgId=${encodeURIComponent(filters.orgId)}`);
        if (landingPagesResponse.success) {
          setLandingPages(landingPagesResponse.landingPages);
        } else {
          console.warn('Failed to fetch landing pages:', landingPagesResponse.error);
          setLandingPages([]);
        }
      } catch (err) {
        console.warn('Landing pages API not available:', err);
        setLandingPages([]);
      }

      setLastUpdated(new Date());

    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.orgId]);

  const filteredPosts = posts.filter(post => {
    if (filters.platform && !post.platforms.includes(filters.platform)) return false;
    if (filters.dateFrom && post.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && post.createdAt > filters.dateTo) return false;
    return true;
  });

  const stats = {
    totalPosts: filteredPosts.length,
    publishedPosts: filteredPosts.filter(p => p.status === 'PUBLISHED').length,
    avgAiScore: filteredPosts.filter(p => p.aiScore).reduce((sum, p) => sum + (p.aiScore || 0), 0) / filteredPosts.filter(p => p.aiScore).length || 0,
    totalLeads: leads.length,
    totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
    totalConversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
    totalClicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
    avgCtr: campaigns.length > 0 ? campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length : 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="mt-2 text-gray-600">Track your social media performance and ROI</p>
            </div>
            {lastUpdated && (
              <div className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Organization ID</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter org ID"
                value={filters.orgId}
                onChange={(e) => setFilters({ ...filters, orgId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.platform}
                onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
              >
                <option value="">All Platforms</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">Twitter</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={fetchData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Posts</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
                <p className="text-sm text-gray-600">{stats.publishedPosts} published</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Avg AI Score</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.avgAiScore.toFixed(1)}/10</p>
                <p className="text-sm text-gray-600">Content quality</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Total Leads</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
                <p className="text-sm text-gray-600">Captured</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Ad Performance</h3>
                <p className="text-2xl font-bold text-gray-900">${stats.totalSpend.toFixed(0)}</p>
                <p className="text-sm text-gray-600">{stats.totalConversions} conversions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Clicks</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.totalClicks.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Across all campaigns</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Avg CTR</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.avgCtr.toFixed(2)}%</p>
            <p className="text-sm text-gray-600">Click-through rate</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Conversion Rate</h3>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalClicks > 0 ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-sm text-gray-600">Leads per click</p>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-8">
          <PostPerformanceChart posts={filteredPosts} />
          <AdPerformanceChart campaigns={campaigns} />
          <LeadConversionChart leads={leads} />
        </div>

        {/* Recent Posts Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
            <p className="text-sm text-gray-600 mt-1">Latest posts and their performance metrics</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platforms</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPosts.slice(0, 10).map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        <div className="truncate">
                          {post.finalCaption || post.content}
                        </div>
                        {post.editedAssetUrl && (
                          <div className="text-xs text-blue-600 mt-1">✨ AI Enhanced</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(post.platforms) ? post.platforms.map((platform) => (
                          <span key={platform} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            {platform}
                          </span>
                        )) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {post.aiScore ? (
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            post.aiScore >= 8 ? 'bg-green-100 text-green-800' :
                            post.aiScore >= 6 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {post.aiScore}/10
                          </span>
                          <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                post.aiScore >= 8 ? 'bg-green-500' :
                                post.aiScore >= 6 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${(post.aiScore / 10) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        post.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                        post.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                        post.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
              <p className="text-gray-600">Create your first post to see analytics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
