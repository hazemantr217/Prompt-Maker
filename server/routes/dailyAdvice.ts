import { Type } from '@google/genai';
import { Router } from 'express';
import { z } from 'zod';
import { IMAGE_MODEL_IDS, isModelId } from '../../shared/models';
import { AppError, asyncRoute } from '../lib/http';
import { readUserGeminiApiKey } from '../lib/geminiAuth';
import { generateTextWithFallback } from '../services/gemini';

const router = Router();
let cached: { cairoDate: string; payload: unknown } | null = null;

const adviceSchema = z.object({
  date: z.string(),
  tip: z.string(),
  ideaTitle: z.string(),
  ideaDescription: z.string(),
  suggestedEnglishPrompt: z.string(),
  suggestedModel: z.string().refine(isModelId),
});

function cairoDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

const FALLBACK = {
  tip: 'استخدم Nano Banana 2 كخيار افتراضي، واحتفظ بـ Pro للتصميمات المعقدة والنصوص الدقيقة داخل الصورة.',
  ideaTitle: 'إعلان منتج بإضاءة محايدة نظيفة',
  ideaDescription: 'لقطة تجارية تحافظ على ألوان المنتج وتستخدم فصلًا واضحًا بينه وبين الخلفية.',
  suggestedEnglishPrompt: 'A clean commercial product hero shot with neutral white-balanced studio lighting, precise material texture, controlled reflections, accurate brand colors, and a distraction-free background.',
  suggestedModel: 'Nano Banana 2',
};

router.get('/daily-gemini-advice', asyncRoute(async (request, response) => {
  const date = cairoDate();
  if (cached?.cairoDate === date) {
    response.json(cached.payload);
    return;
  }

  try {
    const aiResponse = await generateTextWithFallback('gemini-3.7-flash', {
      contents: `Create one useful daily image-prompt tip and one practical creative idea. The only selectable image models are: ${IMAGE_MODEL_IDS.join(', ')}. Return Arabic guidance and an English generation prompt. Date: ${date}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            tip: { type: Type.STRING },
            ideaTitle: { type: Type.STRING },
            ideaDescription: { type: Type.STRING },
            suggestedEnglishPrompt: { type: Type.STRING },
            suggestedModel: { type: Type.STRING },
          },
          required: ['date', 'tip', 'ideaTitle', 'ideaDescription', 'suggestedEnglishPrompt', 'suggestedModel'],
        },
      },
    }, readUserGeminiApiKey(request));
    if (!aiResponse.text) throw new AppError(502, 'Empty daily advice response');
    const result = adviceSchema.parse(JSON.parse(aiResponse.text));
    cached = { cairoDate: date, payload: result };
  } catch (error) {
    console.warn('Daily advice fallback used:', error instanceof Error ? error.message : error);
    cached = { cairoDate: date, payload: { date, ...FALLBACK } };
  }
  response.json(cached.payload);
}));

export default router;
