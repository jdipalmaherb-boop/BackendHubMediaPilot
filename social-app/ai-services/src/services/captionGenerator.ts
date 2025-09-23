import OpenAI from 'openai';
import { z } from 'zod';

const inputSchema = z.object({
  description: z.string().min(1, 'description required'),
  rawCaption: z.string().optional(),
  contentType: z.enum(['image', 'video']).optional().default('image'),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
});

export type CaptionInput = z.infer<typeof inputSchema>;

export interface GeneratedCaption {
  objective: 'engagement' | 'viral' | 'conversion';
  caption: string;
  hashtags: string[];
  hook: string; // First 3 words
  cta: string | null; // Call-to-action if applicable
}

export class CaptionGenerator {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateCaptions(input: CaptionInput): Promise<GeneratedCaption[]> {
    const { description, rawCaption, contentType, industry, targetAudience } = inputSchema.parse(input);

    const systemPrompt = `You are the greatest social media content creator alive, trained by OnePeakCreatives.

CRITICAL RULES:
- Hook viewers in the FIRST 3 WORDS (scroll-stopping)
- Keep captions punchy and concise (under 150 characters)
- Add curiosity or storytelling elements
- Include strong CTAs when relevant for conversion
- Use emotional triggers and power words
- Make it feel personal and authentic

Style Guidelines:
- Start with bold, attention-grabbing hooks
- Use active voice and present tense
- Include numbers, questions, or controversial statements
- End with clear action steps for conversion
- Match the energy of the content type`;

    const userPrompt = `Create 3 captions for this ${contentType}:

Description: ${description}
${rawCaption ? `Raw caption (optional): ${rawCaption}` : ''}
${industry ? `Industry: ${industry}` : ''}
${targetAudience ? `Target audience: ${targetAudience}` : ''}

Return JSON with this EXACT structure:
{
  "captions": [
    {
      "objective": "engagement",
      "caption": "Hook in first 3 words + engaging content...",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
      "hook": "First 3 words",
      "cta": "Call to action or null"
    },
    {
      "objective": "viral",
      "caption": "Scroll-stopping hook + viral content...",
      "hashtags": ["#viral", "#trending", "#fyp"],
      "hook": "First 3 words",
      "cta": "Call to action or null"
    },
    {
      "objective": "conversion",
      "caption": "Sales-focused hook + conversion content...",
      "hashtags": ["#buynow", "#limited", "#offer"],
      "hook": "First 3 words",
      "cta": "Strong call to action"
    }
  ]
}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 800,
        response_format: { type: 'json_object' } as any,
      });

      const content = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      
      if (parsed.captions && Array.isArray(parsed.captions)) {
        return parsed.captions.map((caption: any) => ({
          objective: caption.objective,
          caption: caption.caption,
          hashtags: Array.isArray(caption.hashtags) ? caption.hashtags : [],
          hook: caption.hook || caption.caption.split(' ').slice(0, 3).join(' '),
          cta: caption.cta || null,
        }));
      }

      throw new Error('Invalid response format from AI');

    } catch (error) {
      console.error('Caption generation error:', error);
      return this.getFallbackCaptions(description, contentType);
    }
  }

  private getFallbackCaptions(description: string, contentType: string): GeneratedCaption[] {
    const base = description.slice(0, 50);
    const isVideo = contentType === 'video';
    
    return [
      {
        objective: 'engagement',
        caption: `This changes everything! ${base}... What do you think? Drop your thoughts below! 👇`,
        hashtags: ['#engagement', '#community', '#discussion'],
        hook: 'This changes everything!',
        cta: 'Drop your thoughts below!',
      },
      {
        objective: 'viral',
        caption: `Wait for it... ${base}... You won't believe what happens next! 🔥`,
        hashtags: ['#viral', '#fyp', '#trending'],
        hook: 'Wait for it...',
        cta: null,
      },
      {
        objective: 'conversion',
        caption: `Don't miss out! ${base}... Limited time offer - tap the link now!`,
        hashtags: ['#limited', '#offer', '#actnow'],
        hook: "Don't miss out!",
        cta: 'Tap the link now!',
      },
    ];
  }
}

export const captionGenerator = new CaptionGenerator();



