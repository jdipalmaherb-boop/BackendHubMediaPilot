import OpenAI from 'openai';
import { z } from 'zod';

const inputSchema = z.object({
  description: z.string().min(1, 'description is required'),
  rawCaption: z.string().optional(),
});

export type GenerateCaptionsInput = z.infer<typeof inputSchema>;

export type GeneratedCaption = {
  objective: 'engagement' | 'viral' | 'conversion';
  caption: string;
  hashtags: string[];
};

export async function generateCaptions(input: GenerateCaptionsInput): Promise<GeneratedCaption[]> {
  const { description, rawCaption } = inputSchema.parse(input);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = `You are the greatest social media content creator alive, trained by OnePeakCreatives.
Guidelines:
- Hook viewers in the first 3 seconds/3 words.
- Keep captions punchy and concise.
- Add curiosity or storytelling.
- Include strong CTAs when relevant.
- Include suggested hashtags (3-6) per caption.`;

  const user = `Create EXACTLY 3 fully-formed captions for the following content. Each should include a short list of suggested hashtags. Optimize each caption for a different objective:
1) High engagement (likes, comments, shares)
2) Viral potential (scroll-stopping hook in first 3 words)
3) Conversion (drives sales or click-through)

Content description: ${description}
${rawCaption ? `Existing raw caption (optional): ${rawCaption}` : ''}

Return JSON with this shape:
[
  {"objective":"engagement","caption":"...","hashtags":["#..."]},
  {"objective":"viral","caption":"...","hashtags":["#..."]},
  {"objective":"conversion","caption":"...","hashtags":["#..."]}
]`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: 'json_object' } as any,
    });

    const content = completion.choices?.[0]?.message?.content || '{}';
    // The model might return a JSON object; try parsing top-level or array.
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const arr: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.data) ? parsed.data : []);

    const result: GeneratedCaption[] = arr
      .map((x) => ({
        objective: x.objective,
        caption: x.caption,
        hashtags: Array.isArray(x.hashtags) ? x.hashtags : [],
      }))
      .filter((x) => x.caption)
      .slice(0, 3);

    if (result.length === 3) return result as GeneratedCaption[];
    // Fallback if incomplete
    return fallbackCaptions(description, rawCaption);
  } catch {
    return fallbackCaptions(description, rawCaption);
  }
}

function fallbackCaptions(description: string, rawCaption?: string): GeneratedCaption[] {
  const base = rawCaption || description;
  return [
    {
      objective: 'engagement',
      caption: `Thoughts? ${base} — Tell us below!`,
      hashtags: ['#community', '#haveyoursay', '#trending'],
    },
    {
      objective: 'viral',
      caption: `Wait for it: ${base} 👀`,
      hashtags: ['#viral', '#scrollstopper', '#fyp'],
    },
    {
      objective: 'conversion',
      caption: `Don’t miss out — ${base}. Tap to learn more.`,
      hashtags: ['#deals', '#newdrop', '#shopnow'],
    },
  ];
}


