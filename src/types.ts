export interface LearnedExample {
  id: string;
  title: string;
  request: string;
  winningPrompt: string;
  images?: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export type ModelId = 
  | 'Nano Banana 2' 
  | 'Nano Banana Pro' 
  | 'Nano Banana'
  | 'Imagen 4'
  | 'Imagen 4 Ultra'
  | 'Imagen 4 Fast';

export type ChatModelId =
  | 'Gemini 3.7 Flash'
  | 'Gemini 3.6 Flash'
  | 'Gemini 3.5 Flash'
  | 'Gemini 3.1 Flash Lite'
  | 'Gemini 3.1 Pro Preview'
  | 'Gemini 2.5 Pro'
  | 'Gemini 2.5 Flash'
  | 'Gemini 2.5 Flash-Lite';

export type CreativeMode = 
  | 'Optimized';

export interface ModelPreset {
  id: ModelId;
  name: string;
  description: string;
  bestCreativity: number;
  bestAspectRatio: string;
  tips: string[];
  capabilities: string;
}

export interface SavedPrompt {
  id: string;
  original: string;
  optimized: string;
  model: ModelId;
  chatModel?: ChatModelId;
  mode: CreativeMode;
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

export const MODEL_PRESETS: Record<ModelId, ModelPreset> = {
  'Nano Banana 2': {
    id: 'Nano Banana 2',
    name: 'Nano Banana 2',
    description: 'موديل (gemini-3.1-flash-image) المطور. ذكاء بصرى فائق السرعة وتفاصيل مذهلة.',
    bestCreativity: 0.65,
    bestAspectRatio: '16:9',
    tips: [
      'بديل متطور للغاية يدعم الأبعاد المتنوعة والقياسية بكفاءة تامة.',
      'أنصحك بضبط حرارة الإبداع (Creativity) لتكون 0.65 لتناسق الألوان.'
    ],
    capabilities: 'دقة فائقة للأبعاد المتنوعة ومحاكاة النسيج والتصميمات المتكاملة.'
  },
  'Nano Banana Pro': {
    id: 'Nano Banana Pro',
    name: 'Nano Banana Pro',
    description: 'الموديل النهائي جيميناي (gemini-3-pro-image) لإنشاء وتعديل الصور بدقة فائقة.',
    bestCreativity: 0.7,
    bestAspectRatio: '16:9',
    tips: [
      'أعلى مستويات العمق البصري والملمس البشري الواقعي.',
      'أنصحك بضبط حرارة الإبداع لتكون 0.7 للحصول على خيالات بصرية رائدة.'
    ],
    capabilities: 'واقعية فوتوغرافية متناهية وعمق حقل بؤري سينمائي.'
  },
  'Nano Banana': {
    id: 'Nano Banana',
    name: 'Nano Banana',
    description: 'موديل (gemini-2.5-flash-image) لإنشاء صور سريعة وعالية الدقة بمثالية.',
    bestCreativity: 0.5,
    bestAspectRatio: '16:9',
    tips: [
      'رائع للمسودات السريعة ومحاكاة المشاعر واللقطات اليومية المباشرة.',
      'أنصحك بضبط حرارة الإبداع لتكون 0.5 لتجنب التشوهات البصرية.'
    ],
    capabilities: 'توليد سريع المدى المباشر وألوان مشبعة نقية.'
  },
  'Imagen 4': {
    id: 'Imagen 4',
    name: 'Imagen 4',
    description: 'نموذج (imagen-4.0-generate-001) لتوليد صور محسنة مع كتابة واضحة للنصوص داخل الصور.',
    bestCreativity: 0.4,
    bestAspectRatio: '1:1',
    tips: [
      'متميز جداً في دمج الكلمات الإنجليزية والأنماط المعمارية والمخططات النظيفة.',
      'أنصحك بضبط حرارة الإبداع لتكون 0.4 لتحقيق الدقة القصوى للعناصر الموصوفة.'
    ],
    capabilities: 'قوة تمثيل النصوص ووضوح فائق الدقة للعناصر الهندسية.'
  },
  'Imagen 4 Ultra': {
    id: 'Imagen 4 Ultra',
    name: 'Imagen 4 Ultra',
    description: 'موديل توليد الصور الفائق من جوجل لتفاصيل استثنائية ونقاء ملمس استوديو احترافي.',
    bestCreativity: 0.8,
    bestAspectRatio: '16:9',
    tips: [
      'مثالي لتصوير المنتجات، وتصاميم الأثاث، والإضاءات الغنية المتعددة للغرف والوجوه.',
      'أنصحك بضبط حرارة الإبداع لتكون 0.8 للحصول على لمسة الفن الفائقة والتفرد اللوني.'
    ],
    capabilities: 'أعلى دقة تصوير سينمائي وتوزيع ممتاز للدرجات اللونية المعقدة.'
  },
  'Imagen 4 Fast': {
    id: 'Imagen 4 Fast',
    name: 'Imagen 4 Fast',
    description: 'موديل الرسم السريع من عائلة ايميجين لصياغة الأفكار الأولية والمفاهيم الفنية.',
    bestCreativity: 0.3,
    bestAspectRatio: '1:1',
    tips: [
      'الأسرع على الإطلاق للرسم وتوليد الشعارات المستهدفة بنية معزولة.',
      'أنصحك بضبط حرارة الإبداع لتكون 0.3 لأسرع دمج وتحسين مباشر للفكرة.'
    ],
    capabilities: 'رسم تخطيطي وتلقين سريع للأيقونات والرموز.'
  }
};

export const INSTANT_TIPS = [
    "منصات النانو تم تصنيفها كأذكى المولدات البصرية القائمة على الترابط وتحليل المشهد بدقة.",
    "إذا أردت إنشاء صورة لطفل رضيع أو صغير وواجهتك تعقيدات مع النماذج المصغرة، فقم بترقية التكوين نحو Gemini Pro.",
    "لتصميمات السوشيال ميديا البراقة، جرب دمج كلمات 'volumetric cinematic backlight' مع خفض التباين قليلاً.",
    "النماذج لا تتطلب 'masterpiece' أو 'ultra-high quality' في الملقن، بل تطلب وصفاً حسياً دقيقاً للأنسجة والزوايا.",
    "احرص دائماً على ضبط درجة الإبداع (Creativity) عند 0.7 للموديلات الاحترافية Pro للحصول على أفضل الخيالات البصرية."
];
