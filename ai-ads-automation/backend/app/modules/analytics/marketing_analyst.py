"""
Marketing analyst for analyzing performance data and providing actionable insights.
"""

import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict, Counter
from app.core.logging import logger
from app.modules.ad_copy.llm_client import get_llm_client, AbstractLLMClient


class MarketingAnalyst:
    """AI-powered marketing analyst for performance data analysis and insights generation."""

    def __init__(self, llm_client: Optional[AbstractLLMClient] = None):
        self.llm_client = llm_client if llm_client else get_llm_client()
        logger.info("MarketingAnalyst initialized")

    async def analyze_performance_data(
        self,
        json_metrics: Dict[str, Any],
        analysis_period: str = "6_weeks"
    ) -> Dict[str, Any]:
        """
        Analyze marketing performance data and generate actionable insights.
        
        Args:
            json_metrics: JSON data containing performance metrics
            analysis_period: Period for analysis (e.g., "6_weeks", "30_days")
            
        Returns:
            Dict containing analysis results with wins, problems, actions, and predictions
        """
        logger.info("Analyzing marketing performance data")
        
        try:
            # Parse and validate the metrics data
            metrics = self._parse_metrics_data(json_metrics)
            
            # Analyze performance patterns
            analysis = {
                'analysis_period': analysis_period,
                'data_summary': self._summarize_data(metrics),
                'top_3_wins': self._identify_top_wins(metrics),
                'bottom_2_problems': self._identify_bottom_problems(metrics),
                'next_actions': self._generate_next_actions(metrics),
                'optimal_posting_times': self._predict_optimal_posting_times(metrics),
                'performance_trends': self._analyze_trends(metrics),
                'recommendations': self._generate_recommendations(metrics)
            }
            
            return analysis
        except Exception as e:
            logger.error(f"Error analyzing performance data: {e}", exc_info=True)
            return self._create_fallback_analysis()

    def _parse_metrics_data(self, json_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Parse and validate the incoming metrics data."""
        try:
            # Handle different data formats
            if isinstance(json_metrics, str):
                metrics = json.loads(json_metrics)
            else:
                metrics = json_metrics
            
            # Ensure required fields exist
            required_fields = ['posts', 'engagement', 'metrics']
            for field in required_fields:
                if field not in metrics:
                    metrics[field] = {}
            
            # Normalize the data structure
            normalized_metrics = {
                'posts': metrics.get('posts', []),
                'engagement': metrics.get('engagement', {}),
                'metrics': metrics.get('metrics', {}),
                'time_series': metrics.get('time_series', []),
                'platforms': metrics.get('platforms', {}),
                'audience': metrics.get('audience', {}),
                'content_types': metrics.get('content_types', {}),
                'hashtags': metrics.get('hashtags', []),
                'campaigns': metrics.get('campaigns', [])
            }
            
            return normalized_metrics
        except Exception as e:
            logger.error(f"Error parsing metrics data: {e}")
            return self._create_sample_metrics()

    def _create_sample_metrics(self) -> Dict[str, Any]:
        """Create sample metrics for testing when data is invalid."""
        return {
            'posts': [
                {
                    'id': 'post_1',
                    'content': 'Sample post 1',
                    'platform': 'instagram',
                    'engagement_rate': 0.045,
                    'reach': 10000,
                    'likes': 450,
                    'comments': 25,
                    'shares': 15,
                    'created_at': '2023-10-20T10:00:00Z'
                }
            ],
            'engagement': {
                'total_posts': 1,
                'avg_engagement_rate': 0.045,
                'total_reach': 10000
            },
            'metrics': {
                'impressions': 15000,
                'clicks': 300,
                'conversions': 15,
                'revenue': 1500.00
            },
            'time_series': [],
            'platforms': {'instagram': 1},
            'audience': {},
            'content_types': {},
            'hashtags': [],
            'campaigns': []
        }

    def _summarize_data(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize the key metrics data."""
        posts = metrics.get('posts', [])
        engagement = metrics.get('engagement', {})
        metrics_data = metrics.get('metrics', {})
        
        return {
            'total_posts': len(posts),
            'total_reach': engagement.get('total_reach', 0),
            'avg_engagement_rate': engagement.get('avg_engagement_rate', 0),
            'total_impressions': metrics_data.get('impressions', 0),
            'total_clicks': metrics_data.get('clicks', 0),
            'total_conversions': metrics_data.get('conversions', 0),
            'total_revenue': metrics_data.get('revenue', 0),
            'platforms_used': list(metrics.get('platforms', {}).keys()),
            'analysis_date': datetime.utcnow().isoformat()
        }

    def _identify_top_wins(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify the top 3 performing wins."""
        posts = metrics.get('posts', [])
        
        if not posts:
            return [
                {
                    'title': 'No data available',
                    'description': 'Insufficient data to identify wins',
                    'metric': 'N/A',
                    'value': 0,
                    'improvement': 0
                }
            ]
        
        # Sort posts by engagement rate
        sorted_posts = sorted(posts, key=lambda x: x.get('engagement_rate', 0), reverse=True)
        
        wins = []
        for i, post in enumerate(sorted_posts[:3]):
            win = {
                'title': f'Top Performing Post #{i+1}',
                'description': f"Post with {post.get('engagement_rate', 0):.1%} engagement rate",
                'metric': 'Engagement Rate',
                'value': post.get('engagement_rate', 0),
                'improvement': self._calculate_improvement(post, posts),
                'post_id': post.get('id', ''),
                'platform': post.get('platform', ''),
                'content_preview': post.get('content', '')[:100] + '...' if len(post.get('content', '')) > 100 else post.get('content', '')
            }
            wins.append(win)
        
        return wins

    def _identify_bottom_problems(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify the bottom 2 performance problems."""
        posts = metrics.get('posts', [])
        
        if not posts:
            return [
                {
                    'title': 'No data available',
                    'description': 'Insufficient data to identify problems',
                    'metric': 'N/A',
                    'value': 0,
                    'impact': 'Unknown'
                }
            ]
        
        # Sort posts by engagement rate (ascending)
        sorted_posts = sorted(posts, key=lambda x: x.get('engagement_rate', 0))
        
        problems = []
        for i, post in enumerate(sorted_posts[:2]):
            problem = {
                'title': f'Underperforming Post #{i+1}',
                'description': f"Post with only {post.get('engagement_rate', 0):.1%} engagement rate",
                'metric': 'Engagement Rate',
                'value': post.get('engagement_rate', 0),
                'impact': self._calculate_impact(post, posts),
                'post_id': post.get('id', ''),
                'platform': post.get('platform', ''),
                'content_preview': post.get('content', '')[:100] + '...' if len(post.get('content', '')) > 100 else post.get('content', ''),
                'suggested_improvements': self._suggest_improvements(post)
            }
            problems.append(problem)
        
        return problems

    def _generate_next_actions(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate 5 prioritized next actions."""
        posts = metrics.get('posts', [])
        engagement = metrics.get('engagement', {})
        
        actions = []
        
        # Action 1: Content Strategy
        avg_engagement = engagement.get('avg_engagement_rate', 0)
        if avg_engagement < 0.03:
            actions.append({
                'priority': 1,
                'title': 'Improve Content Quality',
                'description': 'Focus on creating more engaging, high-quality content',
                'timeline': '1-2 weeks',
                'effort': 'Medium',
                'expected_impact': 'High',
                'specific_steps': [
                    'Analyze top-performing posts for patterns',
                    'Create content calendar with proven formats',
                    'Implement A/B testing for content types'
                ]
            })
        
        # Action 2: Posting Schedule
        optimal_times = self._predict_optimal_posting_times(metrics)
        if optimal_times:
            actions.append({
                'priority': 2,
                'title': 'Optimize Posting Schedule',
                'description': f'Post during peak engagement hours: {optimal_times[0]["time"]}',
                'timeline': '1 week',
                'effort': 'Low',
                'expected_impact': 'Medium',
                'specific_steps': [
                    'Schedule posts during identified peak hours',
                    'Test different time slots for 1 week',
                    'Monitor engagement improvements'
                ]
            })
        
        # Action 3: Platform Strategy
        platforms = list(metrics.get('platforms', {}).keys())
        if len(platforms) < 2:
            actions.append({
                'priority': 3,
                'title': 'Expand Platform Presence',
                'description': 'Diversify content across multiple platforms',
                'timeline': '2-3 weeks',
                'effort': 'High',
                'expected_impact': 'High',
                'specific_steps': [
                    'Research platform-specific best practices',
                    'Create platform-optimized content',
                    'Cross-promote content across platforms'
                ]
            })
        
        # Action 4: Engagement Strategy
        actions.append({
            'priority': 4,
            'title': 'Increase Audience Engagement',
            'description': 'Implement strategies to boost likes, comments, and shares',
            'timeline': '2 weeks',
            'effort': 'Medium',
            'expected_impact': 'Medium',
            'specific_steps': [
                'Ask questions in captions to encourage comments',
                'Use relevant hashtags to increase discoverability',
                'Respond to comments within 2 hours'
            ]
        })
        
        # Action 5: Analytics and Optimization
        actions.append({
            'priority': 5,
            'title': 'Implement Advanced Analytics',
            'description': 'Set up detailed tracking and optimization systems',
            'timeline': '1 week',
            'effort': 'Medium',
            'expected_impact': 'High',
            'specific_steps': [
                'Set up UTM tracking for all content',
                'Implement conversion tracking',
                'Create weekly performance reports'
            ]
        })
        
        return actions[:5]

    def _predict_optimal_posting_times(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Predict optimal posting times based on past 6 weeks of hourly engagement."""
        posts = metrics.get('posts', [])
        time_series = metrics.get('time_series', [])
        
        if not posts and not time_series:
            return [
                {
                    'time': '9:00 AM',
                    'day': 'Tuesday',
                    'confidence': 0.7,
                    'expected_engagement': 0.045,
                    'reasoning': 'Based on industry averages for B2B content'
                }
            ]
        
        # Analyze hourly engagement patterns
        hourly_engagement = defaultdict(list)
        
        for post in posts:
            created_at = post.get('created_at', '')
            if created_at:
                try:
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    hour = dt.hour
                    day = dt.strftime('%A')
                    engagement_rate = post.get('engagement_rate', 0)
                    hourly_engagement[f"{day}_{hour}"].append(engagement_rate)
                except:
                    continue
        
        # Calculate average engagement by hour and day
        avg_engagement_by_time = {}
        for time_key, engagement_rates in hourly_engagement.items():
            if engagement_rates:
                avg_engagement_by_time[time_key] = statistics.mean(engagement_rates)
        
        # Sort by engagement rate
        sorted_times = sorted(avg_engagement_by_time.items(), key=lambda x: x[1], reverse=True)
        
        optimal_times = []
        for i, (time_key, avg_engagement) in enumerate(sorted_times[:3]):
            day, hour = time_key.split('_')
            time_str = f"{int(hour):02d}:00"
            
            optimal_times.append({
                'time': time_str,
                'day': day,
                'confidence': min(0.9, 0.6 + (i * 0.1)),
                'expected_engagement': avg_engagement,
                'reasoning': f'Based on {len(hourly_engagement[time_key])} posts with avg {avg_engagement:.1%} engagement'
            })
        
        return optimal_times

    def _analyze_trends(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze performance trends over time."""
        posts = metrics.get('posts', [])
        
        if not posts:
            return {
                'engagement_trend': 'stable',
                'reach_trend': 'stable',
                'content_performance': 'unknown',
                'platform_performance': {}
            }
        
        # Calculate trends
        engagement_rates = [post.get('engagement_rate', 0) for post in posts]
        reach_values = [post.get('reach', 0) for post in posts]
        
        engagement_trend = self._calculate_trend(engagement_rates)
        reach_trend = self._calculate_trend(reach_values)
        
        # Platform performance
        platform_performance = {}
        platforms = set(post.get('platform', 'unknown') for post in posts)
        for platform in platforms:
            platform_posts = [post for post in posts if post.get('platform') == platform]
            if platform_posts:
                avg_engagement = statistics.mean([p.get('engagement_rate', 0) for p in platform_posts])
                platform_performance[platform] = {
                    'avg_engagement': avg_engagement,
                    'post_count': len(platform_posts),
                    'trend': self._calculate_trend([p.get('engagement_rate', 0) for p in platform_posts])
                }
        
        return {
            'engagement_trend': engagement_trend,
            'reach_trend': reach_trend,
            'content_performance': self._analyze_content_performance(posts),
            'platform_performance': platform_performance
        }

    def _generate_recommendations(self, metrics: Dict[str, Any]) -> List[str]:
        """Generate strategic recommendations based on analysis."""
        recommendations = []
        
        # Analyze engagement rate
        avg_engagement = metrics.get('engagement', {}).get('avg_engagement_rate', 0)
        if avg_engagement < 0.03:
            recommendations.append("Focus on creating more engaging content with clear calls-to-action")
        
        # Analyze posting frequency
        total_posts = len(metrics.get('posts', []))
        if total_posts < 10:
            recommendations.append("Increase posting frequency to at least 3-5 posts per week")
        
        # Analyze platform diversity
        platforms = list(metrics.get('platforms', {}).keys())
        if len(platforms) < 2:
            recommendations.append("Expand to additional platforms to reach broader audience")
        
        # Analyze content variety
        content_types = list(metrics.get('content_types', {}).keys())
        if len(content_types) < 3:
            recommendations.append("Diversify content types (images, videos, carousels, stories)")
        
        return recommendations

    def _calculate_improvement(self, post: Dict[str, Any], all_posts: List[Dict[str, Any]]) -> float:
        """Calculate improvement percentage for a post."""
        if not all_posts:
            return 0
        
        post_engagement = post.get('engagement_rate', 0)
        avg_engagement = statistics.mean([p.get('engagement_rate', 0) for p in all_posts])
        
        if avg_engagement == 0:
            return 0
        
        return ((post_engagement - avg_engagement) / avg_engagement) * 100

    def _calculate_impact(self, post: Dict[str, Any], all_posts: List[Dict[str, Any]]) -> str:
        """Calculate the impact level of a problem."""
        improvement = self._calculate_improvement(post, all_posts)
        
        if improvement < -50:
            return "Critical"
        elif improvement < -25:
            return "High"
        elif improvement < -10:
            return "Medium"
        else:
            return "Low"

    def _suggest_improvements(self, post: Dict[str, Any]) -> List[str]:
        """Suggest specific improvements for an underperforming post."""
        suggestions = []
        
        engagement_rate = post.get('engagement_rate', 0)
        reach = post.get('reach', 0)
        
        if engagement_rate < 0.02:
            suggestions.append("Add a clear call-to-action in the caption")
            suggestions.append("Use more engaging visuals or video content")
        
        if reach < 1000:
            suggestions.append("Use trending hashtags to increase discoverability")
            suggestions.append("Post during peak engagement hours")
        
        suggestions.append("Ask questions to encourage comments and engagement")
        suggestions.append("Tag relevant accounts to increase visibility")
        
        return suggestions

    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction from a list of values."""
        if len(values) < 2:
            return "stable"
        
        # Simple linear trend calculation
        n = len(values)
        x = list(range(n))
        
        # Calculate slope
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(values)
        
        numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return "stable"
        
        slope = numerator / denominator
        
        if slope > 0.01:
            return "increasing"
        elif slope < -0.01:
            return "decreasing"
        else:
            return "stable"

    def _analyze_content_performance(self, posts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze content performance patterns."""
        if not posts:
            return {"best_performing_type": "unknown", "recommendations": []}
        
        # Group by content type (simplified)
        content_types = defaultdict(list)
        for post in posts:
            content = post.get('content', '')
            if 'video' in content.lower():
                content_types['video'].append(post.get('engagement_rate', 0))
            elif 'image' in content.lower() or 'photo' in content.lower():
                content_types['image'].append(post.get('engagement_rate', 0))
            else:
                content_types['text'].append(post.get('engagement_rate', 0))
        
        # Find best performing type
        avg_engagement_by_type = {}
        for content_type, engagement_rates in content_types.items():
            if engagement_rates:
                avg_engagement_by_type[content_type] = statistics.mean(engagement_rates)
        
        best_type = max(avg_engagement_by_type.items(), key=lambda x: x[1])[0] if avg_engagement_by_type else "unknown"
        
        return {
            "best_performing_type": best_type,
            "type_performance": avg_engagement_by_type,
            "recommendations": [f"Focus on {best_type} content for better engagement"]
        }

    def _create_fallback_analysis(self) -> Dict[str, Any]:
        """Create fallback analysis when data processing fails."""
        return {
            'analysis_period': '6_weeks',
            'data_summary': {
                'total_posts': 0,
                'total_reach': 0,
                'avg_engagement_rate': 0,
                'analysis_date': datetime.utcnow().isoformat()
            },
            'top_3_wins': [
                {
                    'title': 'Analysis Error',
                    'description': 'Unable to analyze data due to processing error',
                    'metric': 'N/A',
                    'value': 0,
                    'improvement': 0
                }
            ],
            'bottom_2_problems': [
                {
                    'title': 'Data Processing Issue',
                    'description': 'Failed to process performance data',
                    'metric': 'N/A',
                    'value': 0,
                    'impact': 'Unknown'
                }
            ],
            'next_actions': [
                {
                    'priority': 1,
                    'title': 'Fix Data Issues',
                    'description': 'Resolve data processing problems',
                    'timeline': 'Immediate',
                    'effort': 'High',
                    'expected_impact': 'High'
                }
            ],
            'optimal_posting_times': [
                {
                    'time': '9:00 AM',
                    'day': 'Tuesday',
                    'confidence': 0.5,
                    'expected_engagement': 0.03,
                    'reasoning': 'Default recommendation due to data issues'
                }
            ],
            'performance_trends': {
                'engagement_trend': 'unknown',
                'reach_trend': 'unknown'
            },
            'recommendations': ['Fix data processing issues before analysis']
        }



