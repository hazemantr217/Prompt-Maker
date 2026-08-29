import { Router } from 'express';
import { getImageModelApiId } from '../../shared/models';
import { AppError, asyncRoute } from '../lib/http';
import { readUserGeminiApiKey } from '../lib/geminiAuth';
import { formatZodError, generateVisualSchema } from '../lib/validation';
import { generateImage } from '../services/gemini';

const router = Router();

router.post('/generate-visual', asyncRoute(async (request, response) => {
  const parsed = generateVisualSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, formatZodError(parsed.error), 'VALIDATION_ERROR');
  const input = parsed.data;
  const model = getImageModelApiId(input.model);
  const imageSize = input.model === 'Nano Banana' ? '1K' : input.imageSize;

  const aiResponse = await generateImage({
    model,
    contents: { parts: [{ text: input.prompt }] },
    config: { imageConfig: { aspectRatio: input.aspectRatio, imageSize } },
  }, readUserGeminiApiKey(request));

  const imagePart = aiResponse.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new AppError(502, 'لم يُرجع موديل الصور ملفًا صالحًا.', 'AI_EMPTY_IMAGE');
  }

  response.json({
    imageUrl: `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`,
    model,
    success: true,
  });
}));

export default router;
