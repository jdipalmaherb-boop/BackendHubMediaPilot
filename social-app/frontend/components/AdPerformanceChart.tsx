"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { AdCampaignStatus } from '../lib/api';

interface AdPerformanceChartProps {
  campaigns: AdCampaignStatus[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export default function AdPerformanceChart({ campaigns }: AdPerformanceChartProps) {
  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ad Campaign Performance</h3>
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No ad campaigns found</h4>
          <p className="text-gray-600">Create your first ad campaign to see performance data</p>
        </div>
      </div>
    );
  }

  const spendData = campaigns.map(campaign => ({
    name: campaign.name.length > 20 ? campaign.name.slice(0, 20) + '...' : campaign.name,
    spend: campaign.spend,
    clicks: campaign.clicks,
    conversions: campaign.conversions,
    ctr: campaign.ctr,
  }));

  const statusData = campaigns.reduce((acc, campaign) => {
    acc[campaign.status] = (acc[campaign.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(statusData).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Ad Campaign Performance</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="text-md font-medium text-gray-700 mb-4">Spend vs Performance</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={spendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toLocaleString() : value,
                  name === 'spend' ? 'Spend ($)' : 
                  name === 'clicks' ? 'Clicks' : 
                  name === 'conversions' ? 'Conversions' : name
                ]}
              />
              <Bar dataKey="spend" fill="#3B82F6" name="spend" />
              <Bar dataKey="clicks" fill="#10B981" name="clicks" />
              <Bar dataKey="conversions" fill="#F59E0B" name="conversions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-700 mb-4">Campaign Status Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
