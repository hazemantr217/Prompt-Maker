import React, { useEffect, useState } from 'react';
import { ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  hasExistingKey: boolean;
  onSave: (apiKey: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ApiKeyModal({
  isOpen,
  hasExistingKey,
  onSave,
  onClear,
  onClose,
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey('');
      setShowKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = apiKey.trim();
    if (!normalized) return;
    onSave(normalized);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-yellow-400/20 bg-[#0d0d0d] shadow-2xl shadow-yellow-500/10">
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">ربط مفتاح Gemini API</h2>
              <p className="mt-1 text-xs text-gray-400">
                التشغيل الحالي خارج بيئة AI Studio ولا يوجد مفتاح مُدار على الخادم.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-500 transition hover:bg-white/5 hover:text-white" title="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-xs leading-6 text-emerald-100/80">
            <span className="flex items-center gap-2 font-bold text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              حماية المفتاح
            </span>
            <p className="mt-1">
              يُحفظ المفتاح لهذه الجلسة داخل التبويب فقط، ولا يُكتب داخل كود المشروع أو قاعدة بيانات الخادم.
            </p>
          </div>

          <label className="block text-xs font-bold text-gray-300">
            {hasExistingKey ? 'استبدال المفتاح الحالي' : 'مفتاح Gemini API الخاص بك'}
            <div className="relative mt-2">
              <input
                autoFocus
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="ألصق المفتاح هنا"
                className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 pl-12 font-mono text-sm text-white outline-none transition focus:border-yellow-400/50"
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white"
                title={showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
          >
            إنشاء أو نسخ مفتاح من Google AI Studio
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!apiKey.trim()}
                className="rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-extrabold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                حفظ لهذه الجلسة
              </button>
              <button type="button" onClick={onClose} className="rounded-xl bg-white/5 px-4 py-2.5 text-xs text-gray-300 hover:bg-white/10">
                لاحقًا
              </button>
            </div>
            {hasExistingKey && (
              <button type="button" onClick={onClear} className="text-xs text-red-300 hover:text-red-200">
                حذف المفتاح الحالي
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
