import OpenAI from 'openai';

interface TipsInput {
  transcript: string;
  context?: string;
  industry?: string;
}

export interface VideoTipsResult {
  hooks: string[];
  captionVariants: string[];
  quickHooks: string[];
  thumbnailText: string[];
  hashtags: string[];
  ctaSuggestions: string[];
  distributionPlan: {
    organic: string[];
    paid: string[];
    retarget: string[];
  };
}

const SYSTEM_PROMPT = `You are a video marketing strategist with the combined tactical expertise of Alex Hormozi and Sabri Suby.
When given a transcript and context, respond ONLY with valid JSON using this schema:
{
  "hooks": string[],                  // 3-5 long-form hooks (1-2 sentences)
  "captionVariants": string[],        // 5 caption variations sized for social copy
  "quickHooks": string[],             // 5 punchy hooks for first 3 seconds
  "thumbnailText": string[],          // 3-5 thumbnail text suggestions (max 5 words)
  "hashtags": string[],               // 10 niche + trend blended hashtags
  "ctaSuggestions": string[],         // 3 CTA lines
  "distributionPlan": {
    "organic": string[],              // 3-5 organic tactics
    "paid": string[],                 // 3-5 paid strategies
    "retarget": string[]             // 3-5 retargeting plays
  }
}
Do NOT include markdown, commentary, or prose outside of JSON.`;

function buildUserPrompt({ transcript, context, industry }: TipsInput): string {
  return [
    context ? `Context: ${context}` : null,
    industry ? `Industry: ${industry}` : null,
    `Transcript: ${transcript}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateVideoTips(input: TipsInput): Promise<VideoTipsResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate video tips.');
  }

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_TIPS_MODEL || 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 1200,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildUserPrompt(input),
      },
    ],
    response_format: { type: 'json_object' },
  });

  const textOutput = response?.choices[0]?.message?.content?.trim();
  if (!textOutput) {
    throw new Error('No content returned from OpenAI tips generator.');
  }

  try {
    const parsed = JSON.parse(textOutput) as VideoTipsResult;
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse tips JSON: ${error instanceof Error ? error.message : 'Unknown error'}\nRaw: ${textOutput}`);
  }
}
