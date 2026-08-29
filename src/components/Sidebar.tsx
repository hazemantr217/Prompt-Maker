import React from "react";
import { SavedPrompt } from "../types";
import { Sparkles, History, Trash2 } from "lucide-react";

interface SidebarProps {
  history: SavedPrompt[];
  activePromptId: string | null;
  onSelectPrompt: (promptId: string) => void;
  onNewWorkspace: () => void;
  onDeletePrompt: (promptId: string, e: React.MouseEvent) => void;
  isTempChat: boolean;
  onToggleTempChat: (val: boolean) => void;
}

export default function Sidebar({
  history,
  activePromptId,
  onSelectPrompt,
  onNewWorkspace,
  onDeletePrompt,
  isTempChat,
  onToggleTempChat
}: SidebarProps) {

  return (
    <aside className="w-72 border-l border-white/5 flex flex-col bg-[#080808] h-full text-[#e5e7eb] shrink-0">
      {/* Brand Logo Header */}
      <div className="p-6 flex items-center border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-yellow-400 to-orange-600 rounded-xl flex items-center justify-center text-black font-extrabold shadow-lg shadow-yellow-500/10">
            NB
          </div>
          <div className="flex flex-col text-right">
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">Banana Prompt AI</h1>
            <span className="text-[10px] text-gray-400 font-medium">مساعد مطابِع الجيل الجديد لصياغة البرومبتات</span>
          </div>
        </div>
      </div>

      {/* Navigation Space */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin scrollbar-thumb-white/5">
        
        {/* Workspace Quick CTA and Temporary Chat toggle */}
        <div className="space-y-3">
          <button
            onClick={onNewWorkspace}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400/15 to-orange-500/10 hover:from-yellow-400/20 hover:to-orange-500/15 border border-yellow-400/30 rounded-xl text-xs font-semibold text-yellow-300 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
            <span>ابدأ شات جديد رايق</span>
          </button>

          {/* Temporary Chat Option toggler */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3 text-right">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-yellow-400 flex items-center gap-1">
                <span>شات مؤقت ميروحش للمطبعة</span>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping"></span>
              </span>
              <span className="text-[9px] text-gray-400 mt-0.5 select-none font-medium leading-tight">الشات ده مش هيتحفظ في سجل الأرشيف خالص</span>
            </div>
            <button
              onClick={() => onToggleTempChat(!isTempChat)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center cursor-pointer outline-none ${
                isTempChat ? "bg-yellow-400 justify-start" : "bg-white/10 justify-end"
              }`}
            >
              <span className={`w-4 h-4 rounded-full shadow-md transition-all ${isTempChat ? "bg-[#080808]" : "bg-white/40"}`} />
            </button>
          </div>
        </div>

        {/* History Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
            <span className="flex items-center gap-1.5">
              <History className="w-3 h-3 text-gray-500" />
              البرومبتات الشغالة دلوقتي
            </span>
            <span className="bg-white/5 text-gray-400 px-1.5 py-0.5 rounded-full text-[9px]">
              {history.length}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="text-[11px] text-gray-500 italic text-center py-4 bg-white/[0.01] rounded-lg">
                مفيش أي برومبتات هنا.. اكتب أي فكرة تحت وهنظبطهالك ونحفظها هنا تلقائي!
              </div>
            ) : (
              history.map((item) => {
                const isActive = item.id === activePromptId;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectPrompt(item.id)}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all border cursor-pointer ${
                      isActive
                        ? "bg-white/5 border-white/10 text-white shadow-md shadow-yellow-400/5"
                        : "bg-transparent border-transparent hover:bg-white/[0.02] text-gray-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden w-full">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]"></span>
                      <div className="truncate text-right w-full font-medium leading-normal">
                        {item.original || item.optimized || "مسودة برومبت فاضية"}
                      </div>
                    </div>

                    <button
                      onClick={(e) => onDeletePrompt(item.id, e)}
                      title="امسح البرومبت ده"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 text-gray-500 hover:text-red-400 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </nav>
    </aside>
  );
}
