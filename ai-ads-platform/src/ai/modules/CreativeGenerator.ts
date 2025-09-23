import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { LearningDataService } from '../services/LearningDataService.js';
import { ImageProcessor } from '../utils/ImageProcessor.js';
import { VideoProcessor } from '../utils/VideoProcessor.js';

interface CreativeRequest {
  product: string;
  targetAudience: string;
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN' | 'TWITTER';
  objective: 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT' | 'LEADS' | 'SALES' | 'APP_INSTALLS' | 'VIDEO_VIEWS';
  adCopy: string;
  brandGuidelines?: BrandGuidelines;
  existingAssets?: string[];
  budget?: number;
}

interface BrandGuidelines {
  colors: string[];
  fonts: string[];
  logo?: string;
  style: 'modern' | 'classic' | 'playful' | 'professional' | 'bold';
  tone: 'serious' | 'friendly' | 'energetic' | 'trustworthy' | 'innovative';
}

interface GeneratedCreative {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'COLLECTION' | 'STORY' | 'REELS';
  format: string;
  platform: string;
  assets: CreativeAsset[];
  metadata: CreativeMetadata;
  aiScore: number;
  confidence: number;
  variations: CreativeVariation[];
}

interface CreativeAsset {
  id: string;
  type: 'image' | 'video' | 'gif';
  url: string;
  thumbnail?: string;
  duration?: number;
  dimensions: { width: number; height: number };
  size: number;
  format: string;
  platform: string;
}

interface CreativeMetadata {
  title: string;
  description: string;
  tags: string[];
  colors: string[];
  mood: string;
  style: string;
  targetAudience: string;
  emotionalTriggers: string[];
  visualElements: string[];
}

interface CreativeVariation {
  id: string;
  name: string;
  changes: string[];
  aiScore: number;
  assets: CreativeAsset[];
}

export class CreativeGenerator {
  private openai: OpenAI;
  private learningService: LearningDataService;
  private imageProcessor: ImageProcessor;
  private videoProcessor: VideoProcessor;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.learningService = new LearningDataService();
    this.imageProcessor = new ImageProcessor();
    this.videoProcessor = new VideoProcessor();
  }

  /**
   * Generate creative assets for ads using AI
   */
  async generateCreative(request: CreativeRequest): Promise<GeneratedCreative> {
    try {
      logger.info('Generating creative assets', { 
        product: request.product, 
        platform: request.platform,
        objective: request.objective 
      });

      // Get platform-specific requirements
      const platformSpecs = this.getPlatformSpecs(request.platform, request.objective);
      
      // Get historical performance data
      const historicalData = await this.learningService.getCreativePerformanceData({
        platform: request.platform,
        objective: request.objective,
        targetAudience: request.targetAudience
      });

      // Generate creative concept
      const concept = await this.generateCreativeConcept(request, platformSpecs, historicalData);
      
      // Generate assets based on concept
      const assets = await this.generateAssets(concept, platformSpecs, request);
      
      // Create variations
      const variations = await this.generateVariations(concept, assets, platformSpecs);
      
      // Calculate AI score
      const aiScore = await this.calculateCreativeScore(concept, assets, historicalData);

      const creative: GeneratedCreative = {
        id: `creative_${Date.now()}`,
        type: platformSpecs.recommendedType,
        format: platformSpecs.format,
        platform: request.platform,
        assets,
        metadata: concept,
        aiScore,
        confidence: this.calculateConfidence(aiScore, historicalData),
        variations
      };

      logger.info('Generated creative assets', { 
        creativeId: creative.id,
        assetCount: assets.length,
        aiScore: aiScore
      });

      return creative;

    } catch (error) {
      logger.error('Failed to generate creative', { error: error.message });
      throw new Error(`Creative generation failed: ${error.message}`);
    }
  }

  /**
   * Generate creative concept using AI
   */
  private async generateCreativeConcept(
    request: CreativeRequest,
    platformSpecs: any,
    historicalData: any[]
  ): Promise<CreativeMetadata> {
    const prompt = this.buildCreativeConceptPrompt(request, platformSpecs, historicalData);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a world-class creative director specializing in ${request.platform} ads. 
          Create compelling visual concepts that drive engagement and conversions.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 800
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No creative concept generated');
    }

    return this.parseCreativeConcept(content);
  }

  /**
   * Generate actual assets (images/videos) based on concept
   */
  private async generateAssets(
    concept: CreativeMetadata,
    platformSpecs: any,
    request: CreativeRequest
  ): Promise<CreativeAsset[]> {
    const assets: CreativeAsset[] = [];

    try {
      // Generate images using DALL-E or similar
      if (platformSpecs.supportsImages) {
        const imageAssets = await this.generateImageAssets(concept, platformSpecs, request);
        assets.push(...imageAssets);
      }

      // Generate videos using AI video generation
      if (platformSpecs.supportsVideos) {
        const videoAssets = await this.generateVideoAssets(concept, platformSpecs, request);
        assets.push(...videoAssets);
      }

      // Process and optimize assets for platform
      const optimizedAssets = await this.optimizeAssetsForPlatform(assets, platformSpecs);

      return optimizedAssets;

    } catch (error) {
      logger.error('Failed to generate assets', { error: error.message });
      return this.createFallbackAssets(platformSpecs);
    }
  }

  /**
   * Generate image assets using AI
   */
  private async generateImageAssets(
    concept: CreativeMetadata,
    platformSpecs: any,
    request: CreativeRequest
  ): Promise<CreativeAsset[]> {
    const images: CreativeAsset[] = [];

    try {
      // Generate multiple image variations
      for (let i = 0; i < platformSpecs.imageCount; i++) {
        const imagePrompt = this.buildImagePrompt(concept, request, i);
        
        const response = await this.openai.images.generate({
          model: 'dall-e-3',
          prompt: imagePrompt,
          size: platformSpecs.imageSize,
          quality: 'hd',
          n: 1
        });

        if (response.data[0]?.url) {
          const imageAsset: CreativeAsset = {
            id: `img_${Date.now()}_${i}`,
            type: 'image',
            url: response.data[0].url,
            dimensions: platformSpecs.imageDimensions,
            size: 0, // Will be calculated after download
            format: 'png',
            platform: request.platform
          };

          // Download and process the image
          const processedAsset = await this.imageProcessor.processImage(imageAsset, platformSpecs);
          images.push(processedAsset);
        }
      }

      return images;

    } catch (error) {
      logger.error('Failed to generate image assets', { error: error.message });
      return [];
    }
  }

  /**
   * Generate video assets using AI
   */
  private async generateVideoAssets(
    concept: CreativeMetadata,
    platformSpecs: any,
    request: CreativeRequest
  ): Promise<CreativeAsset[]> {
    const videos: CreativeAsset[] = [];

    try {
      // Generate video script
      const videoScript = await this.generateVideoScript(concept, request);
      
      // Generate video using AI video generation (placeholder for actual implementation)
      const videoAsset: CreativeAsset = {
        id: `vid_${Date.now()}`,
        type: 'video',
        url: '', // Would be generated by video AI
        dimensions: platformSpecs.videoDimensions,
        duration: platformSpecs.maxDuration,
        size: 0,
        format: 'mp4',
        platform: request.platform
      };

      // Process video for platform requirements
      const processedVideo = await this.videoProcessor.processVideo(videoAsset, platformSpecs);
      videos.push(processedVideo);

      return videos;

    } catch (error) {
      logger.error('Failed to generate video assets', { error: error.message });
      return [];
    }
  }

  /**
   * Generate creative variations for A/B testing
   */
  private async generateVariations(
    concept: CreativeMetadata,
    assets: CreativeAsset[],
    platformSpecs: any
  ): Promise<CreativeVariation[]> {
    const variations: CreativeVariation[] = [];

    try {
      // Create color variations
      const colorVariations = await this.createColorVariations(concept, assets);
      variations.push(...colorVariations);

      // Create text overlay variations
      const textVariations = await this.createTextVariations(concept, assets);
      variations.push(...textVariations);

      // Create composition variations
      const compositionVariations = await this.createCompositionVariations(concept, assets);
      variations.push(...compositionVariations);

      return variations;

    } catch (error) {
      logger.error('Failed to generate variations', { error: error.message });
      return [];
    }
  }

  /**
   * Calculate AI score for creative performance prediction
   */
  private async calculateCreativeScore(
    concept: CreativeMetadata,
    assets: CreativeAsset[],
    historicalData: any[]
  ): Promise<number> {
    try {
      // Analyze visual elements
      const visualScore = this.analyzeVisualElements(concept, assets);
      
      // Analyze emotional triggers
      const emotionalScore = this.analyzeEmotionalTriggers(concept);
      
      // Analyze historical performance
      const historicalScore = this.analyzeHistoricalPerformance(historicalData);
      
      // Calculate weighted score
      const aiScore = (
        visualScore * 0.4 +
        emotionalScore * 0.3 +
        historicalScore * 0.3
      );

      return Math.min(Math.max(aiScore, 0), 1);

    } catch (error) {
      logger.error('Failed to calculate creative score', { error: error.message });
      return 0.5; // Default score
    }
  }

  /**
   * Get platform-specific requirements
   */
  private getPlatformSpecs(platform: string, objective: string): any {
    const specs = {
      META: {
        recommendedType: 'IMAGE',
        format: 'SINGLE_IMAGE',
        supportsImages: true,
        supportsVideos: true,
        imageCount: 3,
        imageSize: '1024x1024' as const,
        imageDimensions: { width: 1024, height: 1024 },
        videoDimensions: { width: 1080, height: 1080 },
        maxDuration: 60,
        aspectRatios: ['1:1', '16:9', '9:16']
      },
      GOOGLE: {
        recommendedType: 'IMAGE',
        format: 'SINGLE_IMAGE',
        supportsImages: true,
        supportsVideos: true,
        imageCount: 2,
        imageSize: '1200x628' as const,
        imageDimensions: { width: 1200, height: 628 },
        videoDimensions: { width: 1280, height: 720 },
        maxDuration: 30,
        aspectRatios: ['16:9', '1:1']
      },
      TIKTOK: {
        recommendedType: 'VIDEO',
        format: 'SINGLE_VIDEO',
        supportsImages: false,
        supportsVideos: true,
        imageCount: 0,
        videoDimensions: { width: 1080, height: 1920 },
        maxDuration: 60,
        aspectRatios: ['9:16']
      }
    };

    return specs[platform] || specs.META;
  }

  /**
   * Build prompt for creative concept generation
   */
  private buildCreativeConceptPrompt(
    request: CreativeRequest,
    platformSpecs: any,
    historicalData: any[]
  ): string {
    const historicalInsights = historicalData.length > 0 
      ? `\n\nTop performing creatives:\n${historicalData.map(item => 
          `- ${item.title}: CTR ${item.ctr}%, Engagement ${item.engagement}%`
        ).join('\n')}`
      : '';

    return `
Create a compelling visual concept for a ${request.platform} ad.

Product: ${request.product}
Target Audience: ${request.targetAudience}
Objective: ${request.objective}
Ad Copy: ${request.adCopy}
Platform: ${request.platform}
Format: ${platformSpecs.format}

Brand Guidelines:
- Colors: ${request.brandGuidelines?.colors?.join(', ') || 'Brand colors'}
- Style: ${request.brandGuidelines?.style || 'Professional'}
- Tone: ${request.brandGuidelines?.tone || 'Trustworthy'}

${historicalInsights}

Generate a creative concept in JSON format:
{
  "title": "Compelling creative title",
  "description": "Detailed description of the visual concept",
  "tags": ["relevant", "tags"],
  "colors": ["#color1", "#color2"],
  "mood": "energetic/calm/trustworthy/exciting",
  "style": "modern/classic/playful/professional",
  "targetAudience": "Refined audience description",
  "emotionalTriggers": ["urgency", "fear", "desire", "curiosity"],
  "visualElements": ["hero image", "text overlay", "logo placement"]
}

Guidelines:
- Focus on high-converting visual elements
- Use platform-appropriate dimensions and formats
- Include emotional triggers that drive action
- Ensure brand consistency
- Make it scroll-stopping and engaging
    `.trim();
  }

  /**
   * Parse creative concept from AI response
   */
  private parseCreativeConcept(content: string): CreativeMetadata {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const schema = z.object({
        title: z.string(),
        description: z.string(),
        tags: z.array(z.string()),
        colors: z.array(z.string()),
        mood: z.string(),
        style: z.string(),
        targetAudience: z.string(),
        emotionalTriggers: z.array(z.string()),
        visualElements: z.array(z.string())
      });

      return schema.parse(parsed);

    } catch (error) {
      logger.error('Failed to parse creative concept', { error: error.message });
      
      // Return fallback concept
      return {
        title: 'High-Converting Ad Creative',
        description: 'Professional ad creative designed for maximum engagement',
        tags: ['ad', 'marketing', 'conversion'],
        colors: ['#007bff', '#ffffff'],
        mood: 'professional',
        style: 'modern',
        targetAudience: 'General audience',
        emotionalTriggers: ['urgency', 'curiosity'],
        visualElements: ['hero image', 'text overlay']
      };
    }
  }

  /**
   * Build image generation prompt
   */
  private buildImagePrompt(concept: CreativeMetadata, request: CreativeRequest, variation: number): string {
    const variations = [
      'professional and clean',
      'bold and attention-grabbing',
      'emotional and relatable',
      'modern and sleek',
      'vintage and nostalgic'
    ];

    return `
Create a ${variations[variation % variations.length]} ${request.platform} ad image for ${request.product}.

Visual concept: ${concept.description}
Mood: ${concept.mood}
Style: ${concept.style}
Colors: ${concept.colors.join(', ')}
Target audience: ${concept.targetAudience}

Requirements:
- High quality, professional photography style
- Clear focal point that draws attention
- Space for text overlay
- Brand-appropriate styling
- Optimized for social media engagement
    `.trim();
  }

  /**
   * Create fallback assets if generation fails
   */
  private createFallbackAssets(platformSpecs: any): CreativeAsset[] {
    return [{
      id: `fallback_${Date.now()}`,
      type: 'image',
      url: 'https://via.placeholder.com/1024x1024/007bff/ffffff?text=Ad+Creative',
      dimensions: platformSpecs.imageDimensions,
      size: 0,
      format: 'png',
      platform: platformSpecs.platform
    }];
  }

  // Additional helper methods for variations, scoring, etc.
  private async createColorVariations(concept: CreativeMetadata, assets: CreativeAsset[]): Promise<CreativeVariation[]> {
    // Implementation for color variations
    return [];
  }

  private async createTextVariations(concept: CreativeMetadata, assets: CreativeAsset[]): Promise<CreativeVariation[]> {
    // Implementation for text variations
    return [];
  }

  private async createCompositionVariations(concept: CreativeMetadata, assets: CreativeAsset[]): Promise<CreativeVariation[]> {
    // Implementation for composition variations
    return [];
  }

  private analyzeVisualElements(concept: CreativeMetadata, assets: CreativeAsset[]): number {
    // Implementation for visual analysis
    return 0.8;
  }

  private analyzeEmotionalTriggers(concept: CreativeMetadata): number {
    // Implementation for emotional trigger analysis
    return 0.7;
  }

  private analyzeHistoricalPerformance(historicalData: any[]): number {
    // Implementation for historical performance analysis
    return 0.6;
  }

  private calculateConfidence(aiScore: number, historicalData: any[]): number {
    // Implementation for confidence calculation
    return Math.min(aiScore + (historicalData.length * 0.1), 1);
  }

  private async optimizeAssetsForPlatform(assets: CreativeAsset[], platformSpecs: any): Promise<CreativeAsset[]> {
    // Implementation for platform optimization
    return assets;
  }

  private async generateVideoScript(concept: CreativeMetadata, request: CreativeRequest): Promise<string> {
    // Implementation for video script generation
    return 'Video script placeholder';
  }
}



