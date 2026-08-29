export const IMAGE_MODELS = {
  'Nano Banana 2': {
    apiId: 'gemini-3.1-flash-image',
    description: 'الخيار المتوازن للإنشاء والتعديل، يدعم مراجع متعددة ودقة تصل إلى 4K.',
    bestCreativity: 0.65,
    bestAspectRatio: '16:9',
    aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16', '21:9', '4:1', '1:4', '8:1', '1:8'],
    tips: [
      'الأفضل لمعظم مهام التعديل والتصميم اليومية.',
      'قيمة إبداع 0.65 تعطي توازنًا جيدًا بين الدقة والابتكار.',
    ],
    capabilities: 'تعديل حواري، مراجع متعددة، كتابة محسنة، ودقة حتى 4K.',
  },
  'Nano Banana Pro': {
    apiId: 'gemini-3-pro-image',
    description: 'محرك احترافي للتركيبات المعقدة، النصوص الدقيقة، والتصميمات التجارية عالية الجودة.',
    bestCreativity: 0.7,
    bestAspectRatio: '16:9',
    aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    tips: [
      'استخدمه للتصميمات المعقدة والموكابس والكتابة داخل الصورة.',
      'قيمة إبداع 0.7 مناسبة للتكوينات الاحترافية الغنية.',
    ],
    capabilities: 'تفكير بصري متقدم، دقة 4K، نصوص وتخطيطات احترافية.',
  },
  'Nano Banana': {
    apiId: 'gemini-2.5-flash-image',
    description: 'خيار اقتصادي سريع للمسودات والتعديلات البسيطة بدقة 1024px.',
    bestCreativity: 0.5,
    bestAspectRatio: '16:9',
    aspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    tips: [
      'مناسب للمسودات السريعة والتجارب منخفضة التكلفة.',
      'استخدم Nano Banana 2 عند الحاجة لمراجع متعددة أو دقة أعلى.',
    ],
    capabilities: 'توليد وتعديل سريع منخفض التكلفة بدقة 1024px.',
  },
} as const;

export type ModelId = keyof typeof IMAGE_MODELS;
export type ImageModelApiId = (typeof IMAGE_MODELS)[ModelId]['apiId'];

export const CHAT_MODELS = {
  'Gemini 3.7 Flash': {
    apiId: 'gemini-3.7-flash',
    description: 'الافتراضي: أعلى توازن حالي بين جودة صياغة البرومبت والسرعة.',
  },
  'Gemini 3.1 Pro Preview': {
    apiId: 'gemini-3.1-pro-preview',
    description: 'للتحليل المعقد والدقة الأعلى عندما تكون السرعة أقل أهمية.',
  },
  'Gemini 3.1 Flash Lite': {
    apiId: 'gemini-3.1-flash-lite',
    description: 'الأسرع والأقل تكلفة للطلبات المباشرة والبسيطة.',
  },
} as const;

export type ChatModelId = keyof typeof CHAT_MODELS;
export type ChatModelApiId = (typeof CHAT_MODELS)[ChatModelId]['apiId'];

export const DEFAULT_IMAGE_MODEL: ModelId = 'Nano Banana 2';
export const DEFAULT_CHAT_MODEL: ChatModelId = 'Gemini 3.7 Flash';

export const IMAGE_MODEL_IDS = Object.keys(IMAGE_MODELS) as ModelId[];
export const CHAT_MODEL_IDS = Object.keys(CHAT_MODELS) as ChatModelId[];
export const CHAT_MODEL_API_IDS = Object.values(CHAT_MODELS).map((model) => model.apiId) as ChatModelApiId[];

export function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && value in IMAGE_MODELS;
}

export function isChatModelId(value: unknown): value is ChatModelId {
  return typeof value === 'string' && value in CHAT_MODELS;
}

export function isChatModelApiId(value: unknown): value is ChatModelApiId {
  return typeof value === 'string' && CHAT_MODEL_API_IDS.includes(value as ChatModelApiId);
}

export function getChatModelApiId(model: ChatModelId): ChatModelApiId {
  return CHAT_MODELS[model].apiId;
}

export function getImageModelApiId(model: ModelId): ImageModelApiId {
  return IMAGE_MODELS[model].apiId;
}
