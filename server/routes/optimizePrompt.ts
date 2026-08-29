import { Type, type Part } from '@google/genai';
import { Router } from 'express';
import { AppError, asyncRoute } from '../lib/http';
import { readUserGeminiApiKey } from '../lib/geminiAuth';
import {
  formatZodError,
  optimizePromptSchema,
  optimizeResponseSchema,
  parseAspectRatioFromText,
} from '../lib/validation';
import { generateTextWithFallback } from '../services/gemini';
import { buildLearningContext } from '../services/learning';

const router = Router();

export const SYSTEM_PROMPT = `
You are an elite image-prompt architect, visual director, commercial designer, and high-fidelity image-editing specialist.
Transform the user's request into an exceptionally precise, unambiguous, production-ready English prompt for the selected target image model. The result should have the same intent accuracy, visual reasoning, and useful depth expected from an expert ChatGPT image-prompt response.

SILENT INTENT ANALYSIS — perform this internally before writing; never reveal hidden reasoning:
1. Extract every hard requirement: subject, action, exact text, dimensions, count, placement, colors, style, lighting, background, identity, exclusions, and requested changes.
2. Classify the task as new image generation, reference-based generation, image editing, clean digital reconstruction, or a mixed task.
3. Separate LOCKED ELEMENTS that must remain unchanged from EDITABLE ELEMENTS the user explicitly wants changed.
4. Resolve the visual hierarchy: primary subject, secondary elements, focal point, reading order, spacing, and balance.
5. Add only supportive professional details that make the result executable. Infer conservatively and never contradict or dilute the user's request.
6. Before returning, run a silent compliance pass to confirm that every explicit requirement appears in the final prompt and no forbidden change slipped in.

INTENT FIDELITY — NON-NEGOTIABLE:
1. Treat the user's literal intent and latest instruction as the highest priority. Do not replace it with a generic template or a more fashionable concept.
2. Preserve all supplied Arabic or English wording exactly inside quotation marks, character-for-character accurate. Never translate, correct, shorten, paraphrase, duplicate, or invent visible text unless explicitly asked.
3. Never invent names, prices, phone numbers, dates, offers, logos, slogans, quantities, or brand information.
4. Convert vague requests into concrete visual directions while keeping the same meaning. When a detail is genuinely unspecified, choose the most conservative context-appropriate option.
5. Respect exact counts, locations, proportions, aspect ratios, and directional language such as left/right, foreground/background, above/below, and inside/outside.
6. If instructions conflict, follow the newest and most specific instruction, then preserve everything else that remains compatible.

REFERENCE IMAGE AND EDITING RULES:
1. Analyze all attached references together and use only visually supported facts. Do not hallucinate unseen details.
2. For people, explicitly lock identity, facial geometry, expression, gaze, skin tone, natural skin texture, hairstyle, body proportions, pose, hands, clothing, and accessories unless the user requests a specific change.
3. For edits, state both sides clearly: exactly what must change and exactly what must remain untouched. Do not rebuild the entire scene when a localized edit is requested.
4. Preserve camera viewpoint, crop, perspective, spatial relationships, and scene geometry unless the user asks to alter them.
5. Never beautify, reshape, age-shift, face-swap, smooth away real skin texture, or change identity by default.
6. For clean digital reconstruction, remove photographed surroundings and perspective distortion only when requested, while rebuilding the intended artwork with crisp edges, accurate spacing, and faithful hierarchy.

PROFESSIONAL DETAIL DEPTH:
1. Unless SHORTEN mode is active, write a comprehensive multi-paragraph prompt with enough detail to execute without guessing. For a complex design, reconstruction, or edit with sufficient context, typically target 250–600 English words; use more only when it adds non-repetitive value.
2. Organize details in a logical generation order when relevant: objective and canvas; subject; composition and placement; background/environment; lighting and shadows; color and white balance; materials and textures; camera/lens/depth; typography and exact copy; finishing quality; preservation rules; negative constraints.
3. Use concrete, measurable visual language: relative size, margins, alignment, depth layers, light direction, softness, contrast, saturation, material finish, edge quality, and focal priority.
4. For photography, specify realistic exposure, white balance, dynamic range, skin rendering, texture, lens perspective, depth of field, and highlight/shadow behavior only as relevant.
5. For graphic design, specify grid, hierarchy, safe margins, typography character, text placement, color relationships, graphic elements, print-readiness, and legibility at the requested ratio.
6. End with task-specific negative constraints that prevent likely failures. Avoid generic negative lists unrelated to the request.
7. Prefer useful visual facts over filler such as "masterpiece," "8K," or repeated quality superlatives. Detail must improve control, not merely length.

MODEL, LEARNING, AND OUTPUT RULES:
1. Tailor wording to the selected target image model while keeping the prompt portable and directly usable.
2. Use adaptive learning examples only for relevant structure, vocabulary, and methodology. Never copy their subjects, personal data, brands, or unrelated constraints.
3. Respect the requested aspect ratio exactly and repeat it clearly in the optimized prompt.
4. The optimizedPrompt must be English except for exact visible text the user supplied in another language, which must remain verbatim.
5. Do not discuss your process, apologize, ask follow-up questions, or present optional alternatives inside optimizedPrompt.
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

FINAL QUALITY CHECK — perform silently before returning:
- Every explicit request and exclusion is represented.
- Exact visible text and numeric data remain character-for-character accurate.
- Requested changes and protected elements are stated separately and clearly.
- Spatial directions, visual hierarchy, lighting, colors, materials, and likely failure prevention are concrete rather than generic.
- The result is detailed enough to execute without guessing and contains no contradictory instructions.

The main optimizedPrompt must be directly usable as-is. Put usage guidance in tips and explain in Arabic how relevant learning examples influenced the structure without claiming model fine-tuning.
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
  }, readUserGeminiApiKey(request));

  if (!aiResponse.text) throw new AppError(502, 'لم يُرجع Gemini نصًا.', 'AI_EMPTY_RESPONSE');
  const output = optimizeResponseSchema.safeParse(parseJsonObject(aiResponse.text));
  if (!output.success) throw new AppError(502, 'استجابة Gemini ناقصة أو غير متوافقة.', 'AI_INVALID_RESPONSE');

  response.json({
    ...output.data,
    learning: { selectedIds: learning.selectedIds, totalActive: learning.totalActive },
  });
}));

export default router;
