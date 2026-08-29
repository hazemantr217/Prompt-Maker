import type { ChatModelId, ModelId } from '../shared/models';

export type { ChatModelId, ModelId } from '../shared/models';

export interface LearnedExample {
  id: string;
  title: string;
  request: string;
  winningPrompt: string;
  images?: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  tags?: string[];
  useCount?: number;
  successCount?: number;
  lastUsedAt?: string;
}

export interface SavedPrompt {
  id: string;
  original: string;
  optimized: string;
  model: ModelId;
  chatModel?: ChatModelId;
  mode?: 'Optimized';
  aspect_ratio: string;
  creativity: number;
  analysis?: {
    lighting: string;
    style: string;
    keywords: string[];
    recommendedRatio: string;
  };
  explanation?: string;
  imageUrl?: string;
  referenceImage?: string;
  referenceImages?: string[];
  variations?: {
    prompt: string;
    style: string;
    lighting: string;
    explanation: string;
  }[];
  timestamp: string;
}

export const INSTANT_TIPS = [
    "منصات النانو تم تصنيفها كأذكى المولدات البصرية القائمة على الترابط وتحليل المشهد بدقة.",
    "إذا أردت إنشاء صورة لطفل رضيع أو صغير وواجهتك تعقيدات مع النماذج المصغرة، فقم بترقية التكوين نحو Gemini Pro.",
    "لتصميمات السوشيال ميديا البراقة، جرب دمج كلمات 'volumetric cinematic backlight' مع خفض التباين قليلاً.",
    "النماذج لا تتطلب 'masterpiece' أو 'ultra-high quality' في الملقن، بل تطلب وصفاً حسياً دقيقاً للأنسجة والزوايا.",
    "احرص دائماً على ضبط درجة الإبداع (Creativity) عند 0.7 للموديلات الاحترافية Pro للحصول على أفضل الخيالات البصرية."
];
