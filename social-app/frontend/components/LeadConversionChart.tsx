"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { LeadData } from '../lib/api';
import { format, parseISO, subDays } from 'date-fns';

interface LeadConversionChartProps {
  leads: LeadData[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function LeadConversionChart({ leads }: LeadConversionChartProps) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Conversion Trends</h3>
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📈</div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No leads found</h4>
          <p className="text-gray-600">Create landing pages and capture leads to see conversion data</p>
        </div>
      </div>
    );
  }

  // Group leads by date
  const leadsByDate = leads.reduce((acc, lead) => {
    const date = format(parseISO(lead.createdAt), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = { date, count: 0, sources: {} };
    }
    acc[date].count++;
    acc[date].sources[lead.source] = (acc[date].sources[lead.source] || 0) + 1;
    return acc;
  }, {} as Record<string, { date: string; count: number; sources: Record<string, number> }>);

  // Fill in missing dates with 0
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    return leadsByDate[date] || { date, count: 0, sources: {} };
  });

  const data = last7Days.map(day => ({
    date: format(parseISO(day.date), 'MMM dd'),
    leads: day.count,
    social: day.sources.social_post || 0,
    ad: day.sources.ad_campaign || 0,
    test: day.sources.test_capture || 0,
    organic: day.sources.organic || 0,
  }));

  // Source distribution
  const sourceData = leads.reduce((acc, lead) => {
    acc[lead.source] = (acc[lead.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(sourceData).map(([source, count]) => ({
    name: source.replace('_', ' ').toUpperCase(),
    value: count,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Lead Conversion Trends</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="text-md font-medium text-gray-700 mb-4">Daily Lead Volume (Last 7 Days)</h4>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toLocaleString() : value,
                  name === 'leads' ? 'Total Leads' : 
                  name === 'social' ? 'Social Posts' : 
                  name === 'ad' ? 'Ad Campaigns' : 
                  name === 'test' ? 'Test Captures' : 
                  name === 'organic' ? 'Organic' : name
                ]}
              />
              <Area type="monotone" dataKey="leads" stackId="1" stroke="#3B82F6" fill="#3B82F6" />
              <Area type="monotone" dataKey="social" stackId="2" stroke="#10B981" fill="#10B981" />
              <Area type="monotone" dataKey="ad" stackId="2" stroke="#F59E0B" fill="#F59E0B" />
              <Area type="monotone" dataKey="test" stackId="2" stroke="#8B5CF6" fill="#8B5CF6" />
              <Area type="monotone" dataKey="organic" stackId="2" stroke="#EF4444" fill="#EF4444" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-700 mb-4">Lead Sources</h4>
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
