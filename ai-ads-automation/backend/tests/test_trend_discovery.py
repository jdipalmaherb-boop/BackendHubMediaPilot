"""
Tests for the trend discovery module.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from app.modules.trend_discovery.trend_fetcher import TrendFetcher
from app.modules.trend_discovery.trend_recipe_generator import TrendRecipeGenerator
from app.schemas.trend_discovery import TrendFetchRequest, TrendRecipeRequest, TrendItem


class TestTrendFetcher:
    """Test cases for TrendFetcher."""

    @pytest.fixture
    def trend_fetcher(self):
        """TrendFetcher instance for testing."""
        return TrendFetcher()

    @pytest.mark.asyncio
    async def test_fetch_tiktok_trends_success(self, trend_fetcher):
        """Test successful TikTok trends fetching."""
        with patch.object(trend_fetcher.session, 'get') as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = {
                'data': {
                    'list': [
                        {
                            'hashtag_name': '#testtrend',
                            'video_count': 1000,
                            'view_count': 100000,
                            'trend_score': 85,
                            'category': 'test'
                        }
                    ]
                }
            }
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            trends = await trend_fetcher.fetch_tiktok_trends("test_api_key", "US", 10)
            
            assert len(trends) == 1
            assert trends[0]['name'] == '#testtrend'
            assert trends[0]['type'] == 'hashtag'
            assert trends[0]['meta']['video_count'] == 1000

    @pytest.mark.asyncio
    async def test_fetch_tiktok_trends_api_error(self, trend_fetcher):
        """Test TikTok trends fetching with API error."""
        with patch.object(trend_fetcher.session, 'get') as mock_get:
            mock_get.side_effect = Exception("API Error")
            
            trends = await trend_fetcher.fetch_tiktok_trends("test_api_key", "US", 10)
            
            # Should return fallback trends
            assert len(trends) > 0
            assert all(trend['type'] == 'hashtag' for trend in trends)

    @pytest.mark.asyncio
    async def test_fetch_twitter_trends_success(self, trend_fetcher):
        """Test successful Twitter trends fetching."""
        with patch.object(trend_fetcher.session, 'get') as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = [{
                'trends': [
                    {
                        'name': '#testtrend',
                        'tweet_volume': 5000,
                        'url': 'https://twitter.com/search?q=%23testtrend'
                    }
                ]
            }]
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            trends = await trend_fetcher.fetch_twitter_trends("test_token", "US", 10)
            
            assert len(trends) == 1
            assert trends[0]['name'] == '#testtrend'
            assert trends[0]['type'] == 'hashtag'
            assert trends[0]['meta']['tweet_volume'] == 5000

    @pytest.mark.asyncio
    async def test_fetch_youtube_trends_success(self, trend_fetcher):
        """Test successful YouTube trends fetching."""
        with patch.object(trend_fetcher.session, 'get') as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = {
                'items': [
                    {
                        'id': 'test_video_id',
                        'snippet': {
                            'title': 'Test Video #hashtag1 #hashtag2',
                            'description': 'Description with #hashtag3',
                            'channelTitle': 'Test Channel',
                            'categoryId': '22'
                        },
                        'statistics': {
                            'viewCount': '1000000',
                            'likeCount': '50000'
                        }
                    }
                ]
            }
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            trends = await trend_fetcher.fetch_youtube_trends("test_api_key", "US", 10)
            
            assert len(trends) > 0
            assert all(trend['type'] == 'hashtag' for trend in trends)
            assert any('#hashtag1' in trend['name'] for trend in trends)

    @pytest.mark.asyncio
    async def test_fetch_all_trends(self, trend_fetcher):
        """Test fetching trends from all platforms."""
        with patch.object(trend_fetcher, 'fetch_tiktok_trends', new_callable=AsyncMock) as mock_tiktok, \
             patch.object(trend_fetcher, 'fetch_twitter_trends', new_callable=AsyncMock) as mock_twitter:
            
            mock_tiktok.return_value = [{'name': '#tiktoktrend', 'type': 'hashtag', 'meta': {}}]
            mock_twitter.return_value = [{'name': '#twittertrend', 'type': 'hashtag', 'meta': {}}]
            
            all_trends = await trend_fetcher.fetch_all_trends(
                tiktok_api_key="test_key",
                twitter_token="test_token",
                country="US",
                limit_per_platform=5
            )
            
            assert 'tiktok' in all_trends
            assert 'twitter' in all_trends
            assert len(all_trends['tiktok']) == 1
            assert len(all_trends['twitter']) == 1

    def test_extract_hashtags(self, trend_fetcher):
        """Test hashtag extraction from text."""
        text = "This is a test #hashtag1 and another #hashtag2 #hashtag3"
        hashtags = trend_fetcher._extract_hashtags(text)
        
        assert len(hashtags) == 3
        assert '#hashtag1' in hashtags
        assert '#hashtag2' in hashtags
        assert '#hashtag3' in hashtags

    def test_get_fallback_trends(self, trend_fetcher):
        """Test fallback trends generation."""
        trends = trend_fetcher._get_fallback_trends()
        
        assert len(trends) > 0
        assert all(trend['type'] == 'hashtag' for trend in trends)
        assert all('name' in trend for trend in trends)
        assert all('meta' in trend for trend in trends)


class TestTrendRecipeGenerator:
    """Test cases for TrendRecipeGenerator."""

    @pytest.fixture
    def mock_llm_client(self):
        """Mock LLM client for testing."""
        client = Mock()
        client.generate_text = AsyncMock(return_value=[
            '{"hook": "Test hook", "broll_list": ["Shot 1", "Shot 2", "Shot 3"], "caption": "Test caption #test", "ad_script": "Test script", "image_prompt": "Test prompt", "platform_optimization": "Test tips", "engagement_strategy": "Test strategy", "conversion_tactics": "Test tactics"}'
        ])
        return client

    @pytest.fixture
    def recipe_generator(self, mock_llm_client):
        """TrendRecipeGenerator instance for testing."""
        return TrendRecipeGenerator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_make_trend_recipe_success(self, recipe_generator):
        """Test successful trend recipe generation."""
        trend = {
            'name': '#testtrend',
            'type': 'hashtag',
            'meta': {
                'video_count': 1000,
                'view_count': 100000,
                'trend_score': 85,
                'category': 'test'
            }
        }
        
        result = await recipe_generator.make_trend_recipe("TestBrand", trend)
        
        assert 'hook' in result
        assert 'broll_list' in result
        assert 'caption' in result
        assert 'ad_script' in result
        assert 'image_prompt' in result
        assert len(result['broll_list']) == 3
        assert result['brand'] == "TestBrand"
        assert result['trend_name'] == '#testtrend'

    @pytest.mark.asyncio
    async def test_make_trend_recipe_llm_error(self, recipe_generator):
        """Test trend recipe generation when LLM fails."""
        recipe_generator.llm_client.generate_text = AsyncMock(return_value=[])
        
        trend = {
            'name': '#testtrend',
            'type': 'hashtag',
            'meta': {}
        }
        
        result = await recipe_generator.make_trend_recipe("TestBrand", trend)
        
        # Should return fallback recipe
        assert 'hook' in result
        assert 'broll_list' in result
        assert result['brand'] == "TestBrand"
        assert result.get('is_fallback', False) is True

    @pytest.mark.asyncio
    async def test_make_trend_recipe_invalid_json(self, recipe_generator):
        """Test trend recipe generation with invalid JSON response."""
        recipe_generator.llm_client.generate_text = AsyncMock(return_value=["Invalid JSON"])
        
        trend = {
            'name': '#testtrend',
            'type': 'hashtag',
            'meta': {}
        }
        
        result = await recipe_generator.make_trend_recipe("TestBrand", trend)
        
        # Should return fallback recipe
        assert 'hook' in result
        assert result['brand'] == "TestBrand"

    @pytest.mark.asyncio
    async def test_generate_multiple_recipes(self, recipe_generator):
        """Test generating multiple trend recipes."""
        trends = [
            {'name': '#trend1', 'type': 'hashtag', 'meta': {}},
            {'name': '#trend2', 'type': 'hashtag', 'meta': {}},
            {'name': '#trend3', 'type': 'hashtag', 'meta': {}}
        ]
        
        results = await recipe_generator.generate_multiple_recipes(
            "TestBrand", trends, max_recipes=3
        )
        
        assert len(results) == 3
        assert all('hook' in result for result in results)
        assert all(result['brand'] == "TestBrand" for result in results)

    @pytest.mark.asyncio
    async def test_analyze_trend_potential(self, recipe_generator):
        """Test trend potential analysis."""
        trend = {
            'name': '#testtrend',
            'type': 'hashtag',
            'meta': {
                'video_count': 15000,
                'view_count': 2000000,
                'trend_score': 90,
                'category': 'technology'
            }
        }
        
        analysis = await recipe_generator.analyze_trend_potential(
            "TechBrand", trend, "technology"
        )
        
        assert 'relevance_score' in analysis
        assert 'recommendation' in analysis
        assert 'priority_color' in analysis
        assert 'recommendations' in analysis
        assert analysis['brand'] == "TechBrand"
        assert analysis['trend_name'] == '#testtrend'

    def test_create_trend_recipe_prompt(self, recipe_generator):
        """Test trend recipe prompt creation."""
        trend = {
            'name': '#testtrend',
            'type': 'hashtag',
            'meta': {
                'video_count': 1000,
                'view_count': 100000,
                'trend_score': 85,
                'category': 'test'
            }
        }
        
        prompt = recipe_generator._create_trend_recipe_prompt(
            "TestBrand", trend, "young adults", "awareness"
        )
        
        assert "TestBrand" in prompt
        assert "#testtrend" in prompt
        assert "hashtag" in prompt
        assert "young adults" in prompt
        assert "awareness" in prompt

    def test_validate_and_enhance_recipe(self, recipe_generator):
        """Test recipe validation and enhancement."""
        trend = {
            'name': '#testtrend',
            'type': 'hashtag',
            'meta': {'video_count': 1000}
        }
        
        incomplete_recipe = {
            'hook': 'Test hook',
            'broll_list': ['Shot 1', 'Shot 2']
        }
        
        result = recipe_generator._validate_and_enhance_recipe(
            incomplete_recipe, "TestBrand", trend
        )
        
        assert 'hook' in result
        assert len(result['broll_list']) == 3  # Should be padded to 3
        assert 'brand' in result
        assert 'trend_name' in result
        assert 'trend_metrics' in result

    def test_get_default_value(self, recipe_generator):
        """Test default value generation."""
        trend = {'name': '#testtrend', 'type': 'hashtag', 'meta': {}}
        
        hook = recipe_generator._get_default_value('hook', 'TestBrand', trend)
        broll = recipe_generator._get_default_value('broll_list', 'TestBrand', trend)
        
        assert isinstance(hook, str)
        assert isinstance(broll, list)
        assert len(broll) == 3

    def test_create_fallback_recipe(self, recipe_generator):
        """Test fallback recipe creation."""
        trend = {
            'name': '#testtrend',
            'type': 'hashtag',
            'meta': {'discovered_at': '2023-10-27T10:00:00Z'}
        }
        
        recipe = recipe_generator._create_fallback_recipe("TestBrand", trend)
        
        assert recipe['brand'] == "TestBrand"
        assert recipe['trend_name'] == '#testtrend'
        assert recipe['is_fallback'] is True
        assert 'hook' in recipe
        assert 'broll_list' in recipe
        assert len(recipe['broll_list']) == 3

    def test_get_trend_recommendations(self, recipe_generator):
        """Test trend recommendation generation."""
        high_recs = recipe_generator._get_trend_recommendations("high_priority", {})
        medium_recs = recipe_generator._get_trend_recommendations("medium_priority", {})
        low_recs = recipe_generator._get_trend_recommendations("low_priority", {})
        
        assert len(high_recs) > 0
        assert len(medium_recs) > 0
        assert len(low_recs) > 0
        assert all(isinstance(rec, str) for rec in high_recs)
        assert all(isinstance(rec, str) for rec in medium_recs)
        assert all(isinstance(rec, str) for rec in low_recs)



