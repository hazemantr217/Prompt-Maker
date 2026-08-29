import { SavedPrompt } from "../types";
import { Eye, ShieldAlert, Sparkles, AlertCircle, Image as ImageIcon } from "lucide-react";

interface RightPanelProps {
  activePrompt: SavedPrompt | null;
  selectedModel: string;
}

export default function RightPanel({ activePrompt, selectedModel }: RightPanelProps) {
  const analysis = activePrompt?.analysis;
  const isFallback = activePrompt?.imageUrl?.startsWith("http");

  return (
    <aside className="w-80 border-r border-white/5 bg-[#080808] flex flex-col p-6 text-[#e5e7eb] shrink-0 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
      {/* Reference Image Thumbnail */}
      <div className="space-y-4 mb-6">
        <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-500" />
          <span>الصورة المرجعية اللى اخترتها</span>
        </h2>
        {activePrompt?.referenceImage ? (
          <div className="relative rounded-xl overflow-hidden border border-white/10 group aspect-video bg-black/40">
            <img 
              src={activePrompt.referenceImage} 
              alt="Reference Guide"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
              <span className="text-[10px] bg-yellow-400 text-black font-extrabold px-1.5 py-0.5 rounded uppercase">
                REFERENCE IMAGE
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center bg-white/[0.01]">
            <p className="text-[11px] text-gray-500 leading-normal">
              اسحب صورة هنا، أو تصفح ملفاتك، أو ببساطة اضغط <span className="text-[#e5e7eb] font-mono font-bold bg-white/5 px-1 py-0.5 rounded">Ctrl + V</span> في مربع الكتابة علشان ترفع صورتك وجيميناي هيفهمها ويظبط تصميمها!
            </p>
          </div>
        )}
      </div>

      {/* Visual Reference Analysis */}
      <div className="mb-6 space-y-4">
        <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Eye className="w-4 h-4 text-yellow-400" />
          <span>تحليل عين الذكاء البصري</span>
        </h2>

        {analysis ? (
          <div className="space-y-3.5">
            {/* Lighting Style */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex justify-between items-center mb-1.5Packed">
                <span className="text-[10px] text-gray-500 font-semibold uppercase">نظام الإضاءة الكاشفة</span>
                <span className="text-[9px] font-mono text-yellow-400 font-bold tracking-wider">لقيناه خلاص DETECTED</span>
              </div>
              <div className="text-xs text-white font-medium">{analysis.lighting}</div>
              <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="w-[85%] h-full bg-gradient-to-r from-orange-500 to-yellow-400"></div>
              </div>
            </div>

            {/* Keyword tags derived from analysis */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-gray-500 font-semibold uppercase">الألوان وستايل التصميم</span>
                <span className="text-[9px] font-mono text-indigo-400 font-bold tracking-wider">اتظبط وتمام OPTIMIZED</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {analysis.keywords?.map((tag: string, idx: number) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded text-[9px] font-mono">
                    #{tag}
                  </span>
                )) || <span className="text-xs text-gray-600">Cyberpunk, Photorealism</span>}
              </div>

              <ul className="text-[10px] text-gray-400 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  رينج الإبداع والتخيل: <span className="text-indigo-400 font-mono ml-1">0.7 (عالي)</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-center">
            <span className="text-[11px] text-gray-500 italic block">
              مستنيين فكرتك يا فنان.. اكتب في الشات ودوس "ظبّط البرومبت" وهيشتغل محرك الذكاء البصري فوراً.
            </span>
          </div>
        )}
      </div>

      {/* Model Insight Box */}
      <div className="mb-6 space-y-3">
        <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">تحليلات الموديل اللى شغال</h2>
        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
          <div className="text-[11px] leading-relaxed text-gray-400 text-right">
            المساعد بيحلل موديل {selectedModel} تلقائي علشان يصيغ البرومبت بطريقة تناسب طريقة تفكيره في الألوان والتفاصيل الهندسية والطباعة.
          </div>
          {activePrompt?.explanation && (
            <div className="text-[11px] bg-yellow-400/[0.04] border border-yellow-400/10 p-2.5 rounded-lg text-yellow-300 font-arabic leading-relaxed">
              <span className="font-bold block mb-1">💡 إزاي ظبطنا البرومبت:</span>
              {activePrompt.explanation}
            </div>
          )}
        </div>
      </div>

      {/* Unsplash Fallback warning helper */}
      {isFallback && (
        <div className="mt-auto p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-blue-400 tracking-wider block">ميزة توليد الصور الفنية</span>
            <p className="text-[10px] text-blue-200/90 leading-relaxed leading-normal font-medium">
              عملنالك محاكاة بصرية وتصميم لوحة إلهام عالية الجودة للملقن. علشان تولد الصور بموديلات Banana الحقيقية، اتأكد من تشغيل وتفعيل مفتاح Gemini في الإعدادات.
            </p>
          </div>
        </div>
      )}

      {/* Visual Mock Showcase placeholder when empty */}
      {!isFallback && (
        <div className="mt-auto">
          <div className="w-full h-32 rounded-xl bg-gradient-to-t from-black to-transparent relative overflow-hidden flex items-end p-4 border border-white/5">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400')] bg-cover opacity-20 pointer-events-none"></div>
            <div className="relative z-10 text-right w-full">
              <div className="text-[9px] text-yellow-400 font-bold mb-1">تحديث حي وشغال دايماً</div>
              <div className="text-xs text-white font-medium">دلوقتي تقدر تنقل أي ستايل أو كارت بدقة v2.5</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
