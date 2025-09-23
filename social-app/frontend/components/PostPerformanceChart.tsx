"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Post } from '../lib/types';

interface PostPerformanceChartProps {
  posts: Post[];
}

export default function PostPerformanceChart({ posts }: PostPerformanceChartProps) {
  const data = posts
    .filter(post => post.aiScore)
    .map(post => ({
      id: post.id.slice(-6),
      score: post.aiScore,
      status: post.status,
      platform: Array.isArray(post.platforms) ? post.platforms[0] : 'unknown',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Top Performing Posts (AI Score)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="id" />
          <YAxis domain={[0, 10]} />
          <Tooltip 
            formatter={(value, name) => [value, 'AI Score']}
            labelFormatter={(label) => `Post ${label}`}
          />
          <Bar dataKey="score" fill="#3B82F6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}



