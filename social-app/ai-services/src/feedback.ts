import OpenAI from 'openai';
import { z } from 'zod';

const inputSchema = z.object({
  type: z.enum(['image', 'video']),
  sourceUrl: z.string().url('sourceUrl must be a URL'),
  caption: z.string().min(1, 'caption required'),
  description: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof inputSchema>;

export type FeedbackItem = {
  area: 'Hook strength' | 'Visual clarity' | 'Video pacing' | 'Caption strength' | 'CTA effectiveness';
  advice: string;
};

export type ContentFeedback = {
  score: number; // 1-10
  suggestions: FeedbackItem[]; // 3-5 items
};

export async function generateFeedback(input: FeedbackInput): Promise<ContentFeedback> {
  const parsed = inputSchema.parse(input);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = `You are the greatest social media creator alive (OnePeakCreatives). Give extremely precise, high-level tips to maximize views, engagement, and conversions.`;
  const user = `Analyze the following ${parsed.type} content and its caption. Return JSON with 'score' (1-10) and 'suggestions' (3-5 items). Suggestions must cover these areas when applicable: Hook strength, Visual clarity, Video pacing, Caption strength, CTA effectiveness. Keep advice specific and actionable.

Type: ${parsed.type}
Source: ${parsed.sourceUrl}
Caption: ${parsed.caption}
${parsed.description ? `Description/Alt: ${parsed.description}` : ''}

Return JSON like:
{
  "score": 8,
  "suggestions": [
    {"area":"Hook strength","advice":"..."},
    {"area":"Visual clarity","advice":"..."},
    {"area":"Video pacing","advice":"..."},
    {"area":"Caption strength","advice":"..."},
    {"area":"CTA effectiveness","advice":"..."}
  ]
}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' } as any,
    });
    const content = completion.choices?.[0]?.message?.content || '{}';
    let parsedJson: any;
    try { parsedJson = JSON.parse(content); } catch { parsedJson = {}; }
    const score = Math.max(1, Math.min(10, Number(parsedJson.score || 6)));
    const suggestions = Array.isArray(parsedJson.suggestions) ? parsedJson.suggestions.slice(0, 5) : [];
    if (suggestions.length >= 3) return { score, suggestions } as ContentFeedback;
    return fallbackFeedback(parsed);
  } catch {
    return fallbackFeedback(parsed);
  }
}

function fallbackFeedback(input: FeedbackInput): ContentFeedback {
  const base = input.caption.slice(0, 100);
  return {
    score: 7,
    suggestions: [
      { area: 'Hook strength', advice: `Start with a bold 3-word hook referencing: "${base}".` },
      { area: 'Visual clarity', advice: 'Increase contrast and simplify the frame; keep focal point centered in first 2s.' },
      { area: 'Video pacing', advice: 'Cut to a new angle every 1.5–2.0s; remove silence and filler frames.' },
      { area: 'Caption strength', advice: 'Tighten to one punchy sentence + a curiosity line; avoid passive phrasing.' },
      { area: 'CTA effectiveness', advice: 'End with a specific action (e.g., “Tap to see before/after”). Place CTA at the end.' },
    ],
  };
}





