import { Type, type Part } from '@google/genai';
import { Router } from 'express';
import { AppError, asyncRoute } from '../lib/http';
import {
  formatZodError,
  optimizePromptSchema,
  optimizeResponseSchema,
  parseAspectRatioFromText,
} from '../lib/validation';
import { generateTextWithFallback } from '../services/gemini';
import { buildLearningContext } from '../services/learning';

const router = Router();

const SYSTEM_PROMPT = `
You are a world-class AI image prompt engineer and commercial graphic-design specialist.
Transform the current user's request into a precise English prompt for the selected target image model.

NON-NEGOTIABLE RULES:
1. Preserve the user's literal intent, required Arabic or English text, people, identity, pose, composition, and constraints. Never invent names, prices, phone numbers, dates, or brand text.
2. When reference images exist, describe only visually supported details and explicitly preserve identity when people are present.
3. Use adaptive learning examples only for relevant structure and methodology. Never copy unrelated subjects or data.
4. Prefer concrete visual directions over empty quality phrases. Cover composition, lighting, palette, materials, typography, camera, and negative constraints when relevant.
5. Respect the requested aspect ratio exactly.
6. Return only structured JSON matching the supplied response schema.
`;

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new AppError(502, 'عاد Gemini باستجابة لا يمكن قراءتها.', 'AI_INVALID_RESPONSE');
    try {
      return JSON.parse(match[0]);
    } catch {
      throw new AppError(502, 'عاد Gemini بصيغة JSON غير صالحة.', 'AI_INVALID_RESPONSE');
    }
  }
}

router.post('/optimize-prompt', asyncRoute(async (request, response) => {
  const parsed = optimizePromptSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, formatZodError(parsed.error), 'VALIDATION_ERROR');
  const input = parsed.data;
  const activeAspectRatio = parseAspectRatioFromText(input.prompt) || input.aspectRatio;
  const learning = buildLearningContext(input.prompt, input.learnedExamples);

  const modifierGuideline = input.modifierAction === 'expand'
    ? 'Expand the result with substantially richer, non-repetitive visual detail.'
    : input.modifierAction === 'shorten'
      ? 'Condense the result into a dense, precise prompt without losing hard constraints.'
      : 'Produce a detailed commercial-grade prompt; do not make it artificially short.';

  const variationGuideline = input.multiPrompt
    ? `Generate exactly three ${input.variationType === 'similar' ? 'closely related' : 'clearly different'} directions in the variations array. Each must remain faithful to the same request.`
    : 'Do not add a variations array.';

  const userMessage = `
${learning.section}

<current_request>
${input.prompt || 'Create a prompt that faithfully describes and edits the attached reference image.'}
</current_request>

TARGET IMAGE MODEL: ${input.model}
ASPECT RATIO: ${activeAspectRatio}
CREATIVITY: ${input.creativity.toFixed(2)}
DETAIL MODE: ${modifierGuideline}
VARIATIONS: ${variationGuideline}
${input.images.length > 0 ? `REFERENCE IMAGES: ${input.images.length} attached. Analyze them together.` : 'REFERENCE IMAGES: none.'}

The main optimizedPrompt must be usable as-is. Put usage guidance in tips and explain in Arabic how the learning examples influenced structure without claiming model fine-tuning.
`;

  const parts: Part[] = input.images.map((image) => ({
    inlineData: {
      mimeType: image.mimeType,
      data: image.base64.replace(/^data:image\/[^;]+;base64,/i, ''),
    },
  }));
  parts.push({ text: userMessage });

  const properties: Record<string, unknown> = {
    optimizedPrompt: { type: Type.STRING },
    analysis: {
      type: Type.OBJECT,
      properties: {
        lighting: { type: Type.STRING },
        style: { type: Type.STRING },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendedRatio: { type: Type.STRING },
      },
      required: ['lighting', 'style', 'keywords', 'recommendedRatio'],
    },
    tips: { type: Type.STRING },
    explanation: { type: Type.STRING },
  };
  const required = ['optimizedPrompt', 'analysis', 'tips', 'explanation'];

  if (input.multiPrompt) {
    properties.variations = {
      type: Type.ARRAY,
      minItems: 3,
      maxItems: 3,
      items: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING },
          style: { type: Type.STRING },
          lighting: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ['prompt', 'style', 'lighting', 'explanation'],
      },
    };
    required.push('variations');
  }

  const aiResponse = await generateTextWithFallback(input.chatModel, {
    contents: parts,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: input.creativity,
      responseMimeType: 'application/json',
      responseSchema: { type: Type.OBJECT, properties, required },
    },
  });

  if (!aiResponse.text) throw new AppError(502, 'لم يُرجع Gemini نصًا.', 'AI_EMPTY_RESPONSE');
  const output = optimizeResponseSchema.safeParse(parseJsonObject(aiResponse.text));
  if (!output.success) throw new AppError(502, 'استجابة Gemini ناقصة أو غير متوافقة.', 'AI_INVALID_RESPONSE');

  response.json({
    ...output.data,
    learning: { selectedIds: learning.selectedIds, totalActive: learning.totalActive },
  });
}));

export default router;
