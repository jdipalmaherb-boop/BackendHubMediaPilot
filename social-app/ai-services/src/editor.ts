import { z } from 'zod';
import { generateCaptions, type GeneratedCaption } from './captionGenerator';

export const socialFormats = [
  { name: 'square', ratio: '1:1', width: 1080, height: 1080 },
  { name: 'portrait', ratio: '9:16', width: 1080, height: 1920 },
  { name: 'landscape', ratio: '16:9', width: 1920, height: 1080 },
] as const;

const baseSchema = {
  description: z.string().min(1, 'description required'),
  rawCaption: z.string().optional(),
  formats: z
    .array(z.enum(['square', 'portrait', 'landscape']))
    .default(['portrait', 'square']),
};

const videoSchema = z.object({
  type: z.literal('video'),
  sourceUrl: z.string().url('sourceUrl must be a URL'),
  ...baseSchema,
});

const imageSchema = z.object({
  type: z.literal('image'),
  sourceUrl: z.string().url('sourceUrl must be a URL'),
  ...baseSchema,
});

export type EditVideoInput = z.infer<typeof videoSchema>;
export type EditImageInput = z.infer<typeof imageSchema>;
export type EditInput = EditVideoInput | EditImageInput;

export type EditOutput = {
  selectedCaptions: GeneratedCaption[];
  variants: Array<{
    format: (typeof socialFormats)[number]['name'];
    width: number;
    height: number;
    url: string; // placeholder processed asset url
    steps: string[]; // what was applied
    suggestedMusic?: string[]; // for videos
  }>;
};

/**
 * Professional content editor (placeholder implementation).
 * Returns deterministic transformation plan and "processed" URLs for frontend integration tests.
 */
export async function editContent(input: EditInput): Promise<EditOutput> {
  const parsed = input.type === 'video' ? videoSchema.parse(input) : imageSchema.parse(input);

  const captions = await generateCaptions({ description: parsed.description, rawCaption: parsed.rawCaption });
  const chosen = captions; // expose all 3; frontend can let user pick

  const chosenFormats = socialFormats.filter((f) => parsed.formats.includes(f.name));
  const stepsCommon = [
    'Apply OnePeakCreatives style: bold visuals, clear storytelling',
  ];

  const variants = chosenFormats.map((fmt) => {
    const steps: string[] = [...stepsCommon];
    if (parsed.type === 'video') {
      steps.push(
        'Auto-trim dead/boring segments',
        'Add dynamic transitions between clips',
        'Overlay text captions (from AI) with safe margins',
        'Adjust brightness/contrast/color for pop',
        `Format to ${fmt.ratio} (${fmt.width}x${fmt.height})`,
      );
    } else {
      steps.push(
        'Auto-crop and resize to target dimensions',
        'Enhance colors and sharpness',
        'Overlay text captions (from AI) with readable contrast',
        `Format to ${fmt.ratio} (${fmt.width}x${fmt.height})`,
      );
    }

    return {
      format: fmt.name,
      width: fmt.width,
      height: fmt.height,
      // Placeholder processed URL derived from source + format
      url: `${parsed.sourceUrl}?processed=${fmt.name}`,
      steps,
      suggestedMusic: parsed.type === 'video'
        ? ['Upbeat electronic', 'Lo-fi hip hop', 'Energetic pop']
        : undefined,
    };
  });

  return { selectedCaptions: chosen, variants };
}





