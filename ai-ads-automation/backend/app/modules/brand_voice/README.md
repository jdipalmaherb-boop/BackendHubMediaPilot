# Brand Voice Assistant

## Overview
The Brand Voice Assistant is an AI-powered system that generates high-converting social media captions by learning from winning content examples. It uses the feedback loop system to identify successful patterns and applies them to create compelling, conversion-focused captions.

## Features
- **AI-Powered Generation**: Uses LLM to create captions based on winning examples
- **Feedback Loop Integration**: Automatically learns from top-performing content
- **Multi-Platform Support**: Optimized for Instagram, Facebook, TikTok, Twitter, etc.
- **Tone Adaptation**: Generates captions in various tones (professional, casual, urgent, etc.)
- **Caption Analysis**: Analyzes captions for conversion potential and optimization
- **Hashtag Generation**: Creates relevant, platform-appropriate hashtags
- **CTA Optimization**: Generates compelling call-to-action statements

## Architecture
- `assistant.py`: Core AI assistant for caption generation
- `api.py`: FastAPI routes for brand voice services
- `schemas/brand_voice.py`: Pydantic models for request/response validation
- Integration with `feedback_loop` module for learning from winning content

## Key Components

### BrandVoiceAssistant
The main AI assistant that:
- Generates captions using LLM with winning examples as context
- Analyzes captions for conversion potential
- Integrates with feedback loop for automatic example retrieval
- Provides fallback responses when generation fails

### Caption Generation Process
1. **Input Processing**: Brand, platform, tone, and winning examples
2. **Context Building**: Creates system and user prompts for LLM
3. **AI Generation**: Uses LLM to generate caption variants
4. **Validation**: Ensures proper JSON format and required fields
5. **Optimization**: Truncates to platform limits, cleans hashtags
6. **Analysis**: Provides conversion potential assessment

## API Endpoints

### `POST /api/v1/brand-voice/generate`
Generate high-converting caption variants.

- **Request Body (`CaptionGenerateRequest`):**
    ```json
    {
        "brand": "Nike",
        "platform": "instagram",
        "tone": "motivational",
        "top_winning_examples": [
            "Just do it! 🏃‍♂️ #Nike #Motivation",
            "Impossible is nothing! 💪 #Adidas #Fitness",
            "Push your limits! 🔥 #UnderArmour #Training"
        ],
        "product_description": "New running shoes with advanced cushioning",
        "target_audience": "Fitness enthusiasts and runners"
    }
    ```

- **Response Body (`CaptionResponse`):**
    ```json
    {
        "success": true,
        "brand": "Nike",
        "platform": "instagram",
        "tone": "motivational",
        "primary": "🚀 Just dropped! Our new running shoes with advanced cushioning are here to revolutionize your runs! Join thousands of athletes who've already made the switch. Don't wait - limited stock available!",
        "alts": [
            "💪 Ready to crush your next run? Our new running shoes deliver the comfort and performance you need. Thousands of satisfied customers can't be wrong!",
            "🏃‍♂️ Step up your running game with our latest innovation! Advanced cushioning technology meets unbeatable style. Join the movement today!"
        ],
        "hashtags": [
            "#nike", "#running", "#shoes", "#fitness", "#motivation", 
            "#athlete", "#performance", "#innovation", "#sport", "#lifestyle"
        ],
        "cta": "Shop now at Nike.com and experience the difference! Limited time offer - don't miss out!",
        "character_count": 245,
        "examples_used": 3
    }
    ```

### `POST /api/v1/brand-voice/generate-with-feedback`
Generate captions using automatic feedback loop integration.

- **Request Body:** Same as above, but `top_winning_examples` is optional
- **Response Body:** Same as above

### `POST /api/v1/brand-voice/winning-examples`
Get winning content examples for a brand.

- **Request Body (`WinningExamplesRequest`):**
    ```json
    {
        "brand_id": "nike_123",
        "limit": 3
    }
    ```

- **Response Body (`WinningExamplesResponse`):**
    ```json
    {
        "success": true,
        "brand_id": "nike_123",
        "examples": [
            "Just do it! 🏃‍♂️ #Nike #Motivation",
            "Impossible is nothing! 💪 #Adidas #Fitness",
            "Push your limits! 🔥 #UnderArmour #Training"
        ]
    }
    ```

### `POST /api/v1/brand-voice/search-similar`
Search for similar winning content.

- **Request Body (`SimilarContentRequest`):**
    ```json
    {
        "query_text": "motivational fitness content",
        "limit": 5
    }
    ```

- **Response Body (`SimilarContentResponse`):**
    ```json
    {
        "success": true,
        "query_text": "motivational fitness content",
        "results": [
            "Push your limits every day! 💪 #Fitness #Motivation",
            "Success starts with a single step! 🏃‍♂️ #Running #Goals",
            "Transform your body, transform your life! 🔥 #Workout #Health"
        ]
    }
    ```

### `POST /api/v1/brand-voice/analyze`
Analyze a caption for conversion potential.

- **Request Body (`CaptionAnalyzeRequest`):**
    ```json
    {
        "caption": "🚀 Amazing product! Shop now! #test #brand"
    }
    ```

- **Response Body (`CaptionAnalyzeResponse`):**
    ```json
    {
        "success": true,
        "analysis": {
            "caption": "🚀 Amazing product! Shop now! #test #brand",
            "character_count": 45,
            "word_count": 4,
            "hashtag_count": 2,
            "emoji_count": 1,
            "has_urgency": true,
            "has_social_proof": false,
            "has_clear_cta": true,
            "readability_score": 85.0,
            "conversion_potential": "high"
        }
    }
    ```

### `GET /api/v1/brand-voice/stats`
Get brand voice assistant statistics.

- **Response Body (`BrandVoiceStats`):**
    ```json
    {
        "total_generations": 1250,
        "brands_served": 45,
        "platforms_used": ["instagram", "facebook", "tiktok", "twitter"],
        "average_character_count": 180.5,
        "success_rate": 98.5
    }
    ```

## Usage Examples

### Basic Caption Generation
```python
from app.modules.brand_voice.assistant import BrandVoiceAssistant

assistant = BrandVoiceAssistant()

# Generate caption with winning examples
result = await assistant.generate_caption(
    brand="Nike",
    platform="instagram",
    tone="motivational",
    top_winning_examples=[
        "Just do it! 🏃‍♂️ #Nike #Motivation",
        "Impossible is nothing! 💪 #Adidas #Fitness",
        "Push your limits! 🔥 #UnderArmour #Training"
    ],
    product_description="New running shoes with advanced cushioning",
    target_audience="Fitness enthusiasts and runners"
)

print(f"Primary: {result['primary']}")
print(f"Hashtags: {', '.join(result['hashtags'])}")
print(f"CTA: {result['cta']}")
```

### Using Feedback Loop Integration
```python
# Get winning examples automatically
examples = await assistant.get_winning_examples_for_brand("nike_123", 3)

# Generate caption using winning examples
result = await assistant.generate_caption(
    brand="Nike",
    platform="instagram",
    tone="motivational",
    top_winning_examples=examples
)
```

### Caption Analysis
```python
# Analyze a caption for conversion potential
analysis = await assistant.analyze_caption(
    "🚀 Amazing product! Shop now! #test #brand"
)

print(f"Conversion potential: {analysis.conversion_potential}")
print(f"Has urgency: {analysis.has_urgency}")
print(f"Has clear CTA: {analysis.has_clear_cta}")
```

## Integration with Feedback Loop

The Brand Voice Assistant seamlessly integrates with the feedback loop system:

1. **Automatic Learning**: Retrieves winning content examples from the feedback loop
2. **Pattern Recognition**: Uses successful patterns to inform new caption generation
3. **Continuous Improvement**: Learns from new winning content as it's identified
4. **Brand-Specific Optimization**: Adapts to each brand's successful content style

## Caption Structure

The assistant follows a proven psychological structure:

1. **Hook**: Attention-grabbing opening (first 3 words)
2. **Problem**: Identifies pain point or desire
3. **Solution**: Presents product/service as the answer
4. **Proof**: Adds credibility or social proof
5. **Urgency**: Creates time-sensitive reason to act
6. **CTA**: Clear next step

## Platform Optimization

### Instagram
- Character limit: 2200 characters
- Emoji usage: High
- Hashtag strategy: 10-15 relevant hashtags
- Visual storytelling focus

### Facebook
- Character limit: 2200 characters
- Emoji usage: Moderate
- Hashtag strategy: 5-10 hashtags
- Community engagement focus

### TikTok
- Character limit: 2200 characters
- Emoji usage: Very high
- Hashtag strategy: 3-5 trending hashtags
- Trend-focused content

### Twitter
- Character limit: 280 characters
- Emoji usage: Moderate
- Hashtag strategy: 1-3 hashtags
- Concise, punchy messaging

## Best Practices

1. **Use Winning Examples**: Always provide 3+ winning examples for best results
2. **Match Platform Style**: Ensure tone and format match platform expectations
3. **Test and Iterate**: Use A/B testing to identify best-performing variants
4. **Monitor Performance**: Track conversion rates and optimize accordingly
5. **Stay Brand Consistent**: Maintain brand voice across all generated content

## Error Handling

The assistant includes comprehensive error handling:

- **LLM Failures**: Falls back to template-based generation
- **Invalid JSON**: Validates and cleans LLM responses
- **Missing Examples**: Generates fallback examples
- **Platform Limits**: Automatically truncates to platform character limits
- **Network Issues**: Graceful degradation with cached responses

## Future Enhancements

1. **Advanced Analytics**: Deeper conversion tracking and optimization
2. **Multi-Language Support**: Generate captions in multiple languages
3. **Visual Integration**: Consider image content in caption generation
4. **Real-Time Learning**: Update patterns based on live performance data
5. **Brand Voice Training**: Customize AI models for specific brand voices



