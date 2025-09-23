import OpenAI from 'openai';
import { z } from 'zod';

const inputSchema = z.object({
  type: z.enum(['image', 'video']),
  sourceUrl: z.string().url('sourceUrl must be a valid URL'),
  caption: z.string().min(1, 'caption required'),
  description: z.string().optional(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  platform: z.enum(['instagram', 'tiktok', 'linkedin', 'twitter', 'facebook']).optional(),
});

export type FeedbackInput = z.infer<typeof inputSchema>;

export interface FeedbackSuggestion {
  area: 'Hook strength' | 'Visual clarity' | 'Video pacing' | 'Caption effectiveness' | 'CTA effectiveness';
  score: number; // 1-10 for this specific area
  advice: string;
  priority: 'high' | 'medium' | 'low';
  examples?: string[];
}

export interface ContentFeedback {
  overallScore: number; // 1-10
  suggestions: FeedbackSuggestion[];
  strengths: string[];
  weaknesses: string[];
  quickWins: string[]; // Easy fixes that can be implemented immediately
  platformOptimization: Record<string, string>; // Platform-specific tips
  engagementPrediction: {
    expectedLikes: string;
    expectedComments: string;
    expectedShares: string;
    viralPotential: 'low' | 'medium' | 'high';
  };
}

export class FeedbackService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateFeedback(input: FeedbackInput): Promise<ContentFeedback> {
    try {
      const parsed = inputSchema.parse(input);
      
      const systemPrompt = `You are the GREATEST social media content creator alive, trained by OnePeakCreatives. You have 10+ years of experience creating viral content that generates millions of views, likes, and conversions.

Your expertise includes:
- Creating scroll-stopping hooks that capture attention in 0.3 seconds
- Optimizing content for maximum engagement across all platforms
- Understanding what makes content go viral vs. what makes it flop
- Converting viewers into customers through strategic CTAs
- Mastering the psychology of social media consumption

When analyzing content, be brutally honest but constructive. Give specific, actionable advice that creators can implement immediately.`;

      const userPrompt = `Analyze this ${parsed.type} content and provide expert feedback:

Content Type: ${parsed.type}
Source: ${parsed.sourceUrl}
Caption: ${parsed.caption}
${parsed.description ? `Description: ${parsed.description}` : ''}
${parsed.industry ? `Industry: ${parsed.industry}` : ''}
${parsed.targetAudience ? `Target Audience: ${parsed.targetAudience}` : ''}
${parsed.platform ? `Platform: ${parsed.platform}` : ''}

Provide a comprehensive analysis with:

1. Overall score (1-10) for engagement potential
2. 3-5 specific suggestions covering:
   - Hook strength (first 3 words impact)
   - Visual clarity (composition, colors, readability)
   - Video pacing (if video: cuts, transitions, rhythm)
   - Caption effectiveness (clarity, engagement, storytelling)
   - CTA effectiveness (if applicable: call-to-action strength)

3. Key strengths and weaknesses
4. Quick wins (easy fixes)
5. Platform-specific optimizations
6. Engagement predictions

Return JSON with this structure:
{
  "overallScore": 8,
  "suggestions": [
    {
      "area": "Hook strength",
      "score": 7,
      "advice": "Your hook 'Check this out' is weak. Try 'This will shock you' or 'Wait until you see' for 3x more engagement.",
      "priority": "high",
      "examples": ["This will shock you...", "Wait until you see...", "You won't believe..."]
    }
  ],
  "strengths": ["Strong visual composition", "Clear value proposition"],
  "weaknesses": ["Weak opening hook", "No clear CTA"],
  "quickWins": ["Change first 3 words", "Add a question at the end"],
  "platformOptimization": {
    "instagram": "Add more hashtags (5-10)",
    "tiktok": "Make it more fast-paced"
  },
  "engagementPrediction": {
    "expectedLikes": "500-1,200",
    "expectedComments": "50-150",
    "expectedShares": "20-80",
    "viralPotential": "medium"
  }
}`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
        response_format: { type: 'json_object' } as any,
      });

      const content = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      
      return this.formatFeedback(parsed, parsed);

    } catch (error) {
      console.error('Feedback generation error:', error);
      return this.getFallbackFeedback(input);
    }
  }

  private formatFeedback(aiResponse: any, input: FeedbackInput): ContentFeedback {
    return {
      overallScore: Math.max(1, Math.min(10, aiResponse.overallScore || 5)),
      suggestions: (aiResponse.suggestions || []).map((s: any) => ({
        area: s.area || 'Caption effectiveness',
        score: Math.max(1, Math.min(10, s.score || 5)),
        advice: s.advice || 'No specific advice available',
        priority: s.priority || 'medium',
        examples: s.examples || [],
      })),
      strengths: aiResponse.strengths || ['Content has potential'],
      weaknesses: aiResponse.weaknesses || ['Needs improvement'],
      quickWins: aiResponse.quickWins || ['Review and optimize'],
      platformOptimization: aiResponse.platformOptimization || {},
      engagementPrediction: {
        expectedLikes: aiResponse.engagementPrediction?.expectedLikes || '100-500',
        expectedComments: aiResponse.engagementPrediction?.expectedComments || '10-50',
        expectedShares: aiResponse.engagementPrediction?.expectedShares || '5-25',
        viralPotential: aiResponse.engagementPrediction?.viralPotential || 'low',
      },
    };
  }

  private getFallbackFeedback(input: FeedbackInput): ContentFeedback {
    const isVideo = input.type === 'video';
    const caption = input.caption;
    
    return {
      overallScore: 6,
      suggestions: [
        {
          area: 'Hook strength',
          score: 5,
          advice: `Your opening "${caption.split(' ').slice(0, 3).join(' ')}" needs more punch. Try starting with power words like "This", "Wait", "You" for instant attention.`,
          priority: 'high',
          examples: ['This changes everything...', 'Wait until you see...', 'You won\'t believe...'],
        },
        {
          area: 'Visual clarity',
          score: 6,
          advice: isVideo 
            ? 'Ensure your video has clear, well-lit visuals with good contrast. Avoid shaky footage and keep the main subject centered.'
            : 'Make sure your image is high quality with good lighting and clear composition. The main subject should be easily identifiable.',
          priority: 'medium',
        },
        {
          area: isVideo ? 'Video pacing' : 'Caption effectiveness',
          score: 6,
          advice: isVideo
            ? 'Keep cuts every 1-2 seconds for maximum engagement. Remove any dead air or slow moments.'
            : 'Your caption should tell a story or ask a question. Make it more conversational and engaging.',
          priority: 'medium',
        },
        {
          area: 'CTA effectiveness',
          score: 4,
          advice: 'Add a clear call-to-action at the end. Tell people exactly what you want them to do: "Comment below", "Share this", "Follow for more".',
          priority: 'high',
          examples: ['Comment your thoughts below!', 'Share if you agree!', 'Follow for more tips!'],
        },
      ],
      strengths: ['Content has potential', 'Clear message'],
      weaknesses: ['Needs stronger hook', 'Missing clear CTA'],
      quickWins: [
        'Rewrite the first 3 words',
        'Add a question at the end',
        'Include a call-to-action',
      ],
      platformOptimization: {
        instagram: 'Add 5-10 relevant hashtags',
        tiktok: 'Make it more fast-paced and energetic',
        linkedin: 'Add professional context and insights',
        twitter: 'Keep it concise and add trending hashtags',
        facebook: 'Encourage discussion and sharing',
      },
      engagementPrediction: {
        expectedLikes: '200-800',
        expectedComments: '20-100',
        expectedShares: '10-50',
        viralPotential: 'medium',
      },
    };
  }
}

export const feedbackService = new FeedbackService();



