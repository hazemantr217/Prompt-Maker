import { z } from 'zod';
import { DEFAULT_IMAGE_MODEL, isChatModelApiId, isModelId } from '../../shared/models';

const MAX_BASE64_LENGTH = 7_000_000;

const referenceImageSchema = z.object({
  base64: z.string().min(32).max(MAX_BASE64_LENGTH).refine(
    (value) => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value),
    'صيغة الصورة المرجعية غير مدعومة.',
  ),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

const learnedExampleSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().max(160),
  request: z.string().min(1).max(4_000),
  winningPrompt: z.string().min(1).max(20_000),
  notes: z.string().max(2_000).optional(),
  isActive: z.boolean(),
  createdAt: z.string().max(64),
  tags: z.array(z.string().max(40)).max(12).optional(),
  useCount: z.number().int().min(0).max(1_000_000).optional(),
  successCount: z.number().int().min(0).max(1_000_000).optional(),
  lastUsedAt: z.string().max(64).optional(),
}).strip();

export const optimizePromptSchema = z.object({
  prompt: z.string().max(20_000).default(''),
  model: z.string().refine(isModelId, 'موديل الصور المحدد غير مدعوم.').default(DEFAULT_IMAGE_MODEL),
  images: z.array(referenceImageSchema).max(5).optional().default([]),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9', '4:1', '1:4', '8:1', '1:8']).default('16:9'),
  creativity: z.number().min(0).max(1).default(0.65),
  chatModel: z.string().refine(isChatModelApiId, 'موديل المساعد المحدد غير مدعوم.').default('gemini-3.7-flash'),
  modifierAction: z.enum(['shorten', 'expand']).optional(),
  multiPrompt: z.boolean().optional().default(false),
  variationType: z.enum(['similar', 'different']).optional().default('different'),
  learnedExamples: z.array(learnedExampleSchema).max(150).optional().default([]),
}).superRefine((value, context) => {
  if (!value.prompt.trim() && value.images.length === 0) {
    context.addIssue({ code: 'custom', message: 'يرجى كتابة فكرة أو رفع صورة مرجعية للبدء.' });
  }
});

export const generateVisualSchema = z.object({
  prompt: z.string().trim().min(1, 'يرجى توفير برومبت لتوليد الصورة.').max(30_000),
  model: z.string().refine(isModelId, 'موديل الصور المحدد غير مدعوم.'),
  aspectRatio: z.enum(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9', '4:1', '1:4', '8:1', '1:8']).default('1:1'),
  imageSize: z.enum(['1K', '2K', '4K']).default('1K'),
});

export const optimizeResponseSchema = z.object({
  optimizedPrompt: z.string().min(1),
  analysis: z.object({
    lighting: z.string(),
    style: z.string(),
    keywords: z.array(z.string()).max(20),
    recommendedRatio: z.string().optional(),
  }),
  tips: z.string(),
  explanation: z.string(),
  variations: z.array(z.object({
    prompt: z.string().min(1),
    style: z.string(),
    lighting: z.string().optional().default(''),
    explanation: z.string(),
  })).max(3).optional(),
});

export function parseAspectRatioFromText(text: string): string | null {
  const normalized = text
    .replace(/٠/g, '0').replace(/١/g, '1').replace(/٢/g, '2').replace(/٣/g, '3').replace(/٤/g, '4')
    .replace(/٥/g, '5').replace(/٦/g, '6').replace(/٧/g, '7').replace(/٨/g, '8').replace(/٩/g, '9');
  const match = normalized.match(/\b(1[:/]1|3[:/]4|4[:/]3|16[:/]9|9[:/]16|21[:/]9|3[:/]2|2[:/]3|4[:/]5|5[:/]4|4[:/]1|1[:/]4|8[:/]1|1[:/]8)\b/);
  return match ? match[1].replace('/', ':') : null;
}

export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message || 'بيانات الطلب غير صالحة.';
}
