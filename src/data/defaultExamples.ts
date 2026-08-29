import { LearnedExample } from '../types';

export const DEFAULT_LEARNED_EXAMPLES: LearnedExample[] = [
  {
    id: 'default-ex-1',
    title: 'تصميم دعوة عقد قران فاخرة بأسلوب التذهيب واللؤلؤ',
    request: 'عايز دعوة عقد قران باسم محمد وسلمى يوضع في برواز فخم مع آية قرآنية كريمة وتاريخ المناسبة 27 مايو 2026',
    winningPrompt: `A continuous, highly detailed English visual design specification for an luxury wedding ceremony contract and invitation poster. 
Subject & Frame: Centered frontal poster card enclosed within a thick, intricate royal border inspired by classical Persian and Turkish rug tapestries, dominated by deep velvet crimson red and glistening metallic gold foil arabesques. Along the inner margin of the golden frame sits a continuous line of photorealistic, smooth dimensional White Pearl beads.
Typography & Calligraphy: At the top center, classic gold Thuluth Arabic calligraphy reads the Quranic verse: "ومن آياته أن خلق لكم من أنفسكم أزواجاً لتسكنوا إليها وجعل بينكم مودة ورحمة". The main title "عقد قران" is centered in majestic gold lettering. Below, the couple's names "محمد & سلمى" are rendered in thick 3D raised black acrylic letters with subtle realistic cast drop shadows standing off the thick ivory textured cardstock.
Content & Text Lines: The text includes explicit Arabic lines inside double quotes: "الزوج: محمد", "الزوجة: سلمى", "التاريخ: 27 مايو 2026", and the blessing "جعله الله عقداً متيناً لا يخيب وعمراً هانئاً تمتد فيه المسرات".
Lighting & Finish: Soft catalog studio lighting with delicate, natural dimensional shadows. Absolute masterpiece 8K resolution.`,
    notes: 'التأكيد دائماً على التفاصيل الثلاثية الأبعاد، خط الثلث العربي الذهبي، وأسماء العروسين بالحروف الأكريليك الساطعة.',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'default-ex-2',
    title: 'تصوير منتج 3D احترافي مع إضاءة استوديو سينمائية',
    request: 'صورة منتج عبوة عطر زجاجية فاخرة مع انعكاسات ورذاذ ماء وإضاءة درامية',
    winningPrompt: `A cinematic 3D commercial product photography shot of an ultra-luxurious dark violet glass perfume bottle with a heavy crystal geometric cap. 
Composition: Front facing hero shot placed on a sleek wet black obsidian podium. Delicate droplets of water cling to the dark frosted glass bottle. Behind the product, micro-water splashes freeze in mid-air with raytraced reflections.
Lighting: Volumetric dual lighting setup with warm amber rim light from the left and deep sapphire blue fill light from the right. A soft glowing spotlight illuminates the golden embossed brand emblem on the front label.
Atmosphere: Subtle mist floating in the dark moody background, high visual fidelity, 8K, macro camera lens with shallow depth of field focusing sharply on the perfume bottle nozzle and glass texture.`,
    notes: 'التركيز على إضاءة الحواف (Rim Lighting)، وانعكاسات المشروبات أو الزجاج والملمس القريب.',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];
