import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  X, 
  Plus, 
  Trash2, 
  Check, 
  Upload, 
  Download, 
  Sparkles, 
  Image as ImageIcon, 
  RotateCcw,
  BookOpen,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { LearnedExample } from '../types';
import { MAX_REFERENCE_IMAGES, prepareImageFile } from '../lib/images';

interface MachineLearningModalProps {
  isOpen: boolean;
  onClose: () => void;
  examples: LearnedExample[];
  onAddExample: (example: Omit<LearnedExample, 'id' | 'createdAt'>) => void;
  onDeleteExample: (id: string) => void;
  onToggleExample: (id: string) => void;
  onResetDefaults: () => void;
  onImportExamples: (imported: LearnedExample[]) => void;
  prefillData?: { request?: string; winningPrompt?: string; title?: string; images?: string[] } | null;
  activeSessionImages?: string[];
}

export const MachineLearningModal: React.FC<MachineLearningModalProps> = ({
  isOpen,
  onClose,
  examples,
  onAddExample,
  onDeleteExample,
  onToggleExample,
  onResetDefaults,
  onImportExamples,
  prefillData,
  activeSessionImages = []
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');

  // Form State for Adding New Training Example
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [winningPrompt, setWinningPrompt] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen && prefillData) {
      setActiveTab('add');
      setRequest(prefillData.request || '');
      setWinningPrompt(prefillData.winningPrompt || '');
      setTitle(prefillData.title || '');
      if (prefillData.images && prefillData.images.length > 0) {
        setImages(prefillData.images);
      }
    }
  }, [isOpen, prefillData]);

  // Handle Clipboard Paste (Ctrl + V)
  useEffect(() => {
    if (!isOpen || activeTab !== 'add') return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) void addImageFiles([file]);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const addImageFiles = async (files: File[]) => {
    const available = Math.max(0, MAX_REFERENCE_IMAGES - images.length);
    const selected = files.filter((file) => file.type.startsWith('image/')).slice(0, available);
    if (selected.length === 0) {
      showToast(`الحد الأقصى ${MAX_REFERENCE_IMAGES} صور لكل مثال.`);
      return;
    }

    const prepared = await Promise.allSettled(selected.map((file) => prepareImageFile(file, 768, 0.75)));
    const valid = prepared
      .filter((result): result is PromiseFulfilledResult<{ base64: string; mimeType: 'image/jpeg' }> => result.status === 'fulfilled')
      .map((result) => result.value.base64);
    setImages((previous) => [...previous, ...valid].slice(0, MAX_REFERENCE_IMAGES));
    showToast(valid.length > 0 ? `تم تجهيز وإضافة ${valid.length} صورة.` : 'تعذر تجهيز الصور المرفقة.');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    void addImageFiles(Array.from(files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    void addImageFiles(Array.from(files));
  };

  const handleFetchSessionImages = () => {
    if (!activeSessionImages || activeSessionImages.length === 0) {
      showToast('لا توجد صور مرجعية مرفقة في المحادثة الحالية.');
      return;
    }
    // Filter out duplicates
    const newImgs = activeSessionImages.filter(img => !images.includes(img));
    if (newImgs.length === 0) {
      showToast('جميع صور المحادثة الحالية مضافة بالفعل!');
      return;
    }
    setImages(prev => [...prev, ...newImgs]);
    showToast(`تم استيراد ${newImgs.length} صور مرجعية من المحادثة الحالية تلقائياً! ⚡`);
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim() || !winningPrompt.trim()) {
      showToast('يرجى ملء الحقول الأساسية: الطلب والبرومبت الناجح.');
      return;
    }

    let finalTitle = title.trim();
    if (!finalTitle) {
      const reqClean = request.trim().replace(/^['"«»\s]+|['"«»\s]+$/g, '');
      if (reqClean) {
        const firstLine = reqClean.split('\n')[0];
        finalTitle = firstLine.length > 45 ? firstLine.slice(0, 42) + '...' : firstLine;
      } else if (winningPrompt.trim()) {
        const promptLine = winningPrompt.trim().split('\n')[0];
        finalTitle = promptLine.length > 45 ? promptLine.slice(0, 42) + '...' : promptLine;
      } else {
        finalTitle = `مثال تدريبي (${new Date().toLocaleDateString('ar-EG')})`;
      }
    }

    onAddExample({
      title: finalTitle,
      request: request.trim(),
      winningPrompt: winningPrompt.trim(),
      notes: notes.trim() || undefined,
      images: images.length > 0 ? images : undefined,
      isActive: true,
    });

    // Reset Form
    setTitle('');
    setRequest('');
    setWinningPrompt('');
    setNotes('');
    setImages([]);
    setActiveTab('list');
    showToast('تمت إضافة مثال التعلم الآلي بنجاح! 🤖');
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(examples, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gemini_ml_dataset_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('تم تصدير مجموعة بيانات التعلم الآلي بنجاح!');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed: unknown = JSON.parse(String(event.target?.result));
        if (Array.isArray(parsed)) {
          const imported = parsed.flatMap((value, index): LearnedExample[] => {
            if (!value || typeof value !== 'object') return [];
            const candidate = value as Partial<LearnedExample>;
            if (typeof candidate.request !== 'string' || typeof candidate.winningPrompt !== 'string') return [];
            return [{
              id: typeof candidate.id === 'string' ? candidate.id : `imported-${Date.now()}-${index}`,
              title: typeof candidate.title === 'string' ? candidate.title.slice(0, 160) : candidate.request.slice(0, 80),
              request: candidate.request.slice(0, 4_000),
              winningPrompt: candidate.winningPrompt.slice(0, 20_000),
              notes: typeof candidate.notes === 'string' ? candidate.notes.slice(0, 2_000) : undefined,
              isActive: candidate.isActive !== false,
              createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
              tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12) : undefined,
              useCount: typeof candidate.useCount === 'number' ? Math.max(0, Math.floor(candidate.useCount)) : 0,
              successCount: typeof candidate.successCount === 'number' ? Math.max(0, Math.floor(candidate.successCount)) : 0,
              lastUsedAt: typeof candidate.lastUsedAt === 'string' ? candidate.lastUsedAt : undefined,
            }];
          }).slice(0, 150);
          if (imported.length === 0) throw new Error('No valid examples');
          onImportExamples(imported);
          showToast(`تم استيراد ${imported.length} أمثلة تدريبية صالحة!`);
        } else {
          showToast('ملف غير صالح: يجب أن يحتوي على مصفوفة JSON من الأمثلة.');
        }
      } catch {
        showToast('خطأ في قراءة ملف JSON.');
      }
    };
    reader.readAsText(file);
  };

  const activeCount = examples.filter((e) => e.isActive).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0f0f13] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-purple-900/20 via-blue-900/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                ذاكرة التعلم التكيفية بالأمثلة
                <span className="text-xs px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-full font-mono">
                  {activeCount} أمثلة مفعلة
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                علّم نموذج جيميناي 3.6 فلور بإدخال أمثلة ناتجة ممتازة جربتها ونجحت معك ليحاكيها دائماً.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs & Sub-Header Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'list' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>الأمثلة التدريبية المحفوظة ({examples.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'add' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مثال تدريبي جديد</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              title="تصدير قاعدة بيانات التعلم"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">تصدير</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 hover:text-white transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">استيراد</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>

            <button
              onClick={onResetDefaults}
              title="استعادة الأمثلة المرجعية"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">أمثلة افتراضية</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {toastMessage && (
            <div className="mb-4 p-3 bg-purple-500/20 border border-purple-500/40 text-purple-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="space-y-4">
              {examples.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                  <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-300">لا توجد أمثلة تدريبية حتى الآن</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    أضف طلبك والبرومبت الذي أثبت جودته. النظام سيقيس الصلة والجودة ويختار الأمثلة الأقرب تلقائيًا لكل طلب جديد.
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-600/30 inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة مثال تدريبي الآن</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {examples.map((item) => (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.isActive 
                          ? 'bg-purple-950/10 border-purple-500/30 hover:border-purple-500/50' 
                          : 'bg-white/[0.02] border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onToggleExample(item.id)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                              item.isActive 
                                ? 'bg-purple-600 border-purple-500 text-white' 
                                : 'border-gray-600 bg-white/5 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              {item.title}
                              {item.isActive ? (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-semibold">
                                  مفعل للتعلم
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 bg-gray-500/10 border border-gray-500/20 text-gray-400 rounded-full font-semibold">
                                  معطل
                                </span>
                              )}
                            </h3>
                            <span className="text-[10px] text-gray-500">{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => onDeleteExample(item.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذا المثال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">الطلب / الفكرة التي أدخلتها:</span>
                          <p className="text-gray-200 leading-relaxed font-sans">{item.request}</p>
                        </div>

                        <div className="bg-black/30 p-3 rounded-xl border border-purple-500/20">
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">البرومبت الناجح (النتيجة المعتمدة):</span>
                          <p className="text-purple-200 leading-relaxed font-mono text-[11px] dir-ltr text-left overflow-x-auto whitespace-pre-wrap">{item.winningPrompt}</p>
                        </div>
                      </div>

                      {item.images && item.images.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 overflow-x-auto pt-2 border-t border-white/5">
                          <span className="text-[10px] text-gray-500 font-semibold flex items-center gap-1 shrink-0">
                            <ImageIcon className="w-3 h-3" /> المرفقات ({item.images.length}):
                          </span>
                          {item.images.map((img, idx) => (
                            <img 
                              key={idx} 
                              src={img} 
                              alt={`ref-${idx}`} 
                              className="w-10 h-10 object-cover rounded-lg border border-white/10"
                            />
                          ))}
                        </div>
                      )}

                      {item.notes && (
                        <div className="mt-2 text-[11px] text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                          <strong className="text-gray-300">ملاحظات النموذج:</strong> {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  عنوان أو تصنيف المثال التدريبي <span className="text-[10px] text-purple-400 font-normal">(اختياري - سيتم إنشاؤه تلقائياً من الفكرة إذا تركته فارغاً)</span>
                </label>
                <input 
                  type="text"
                  placeholder="مثال: تصميم دعوة عقد قران (أو اتركه فارغاً للإنشاء التلقائي)..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">طلبك أو فكرة المستخدم (Input Request) *</label>
                <textarea 
                  rows={3}
                  placeholder="اكتب الطلب الأصلي (مثال: عايز كارت عقد قران باسم [اسم الزوج] و[اسم الزوجة] داخل برواز فخم)..."
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-300 mb-1 flex items-center justify-between">
                  <span>نتيجة البرومبت الناجحة الممتازة (Approved Winning Prompt Output) *</span>
                  <span className="text-[10px] text-gray-400 font-normal">النتيجة التي جربتها وعجبتك</span>
                </label>
                <textarea 
                  rows={4}
                  placeholder="الصق البرومبت النهائي الممتاز. سيُستخدم كمرجع أسلوبي عندما يكون قريبًا من الطلب الجديد..."
                  value={winningPrompt}
                  onChange={(e) => setWinningPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-purple-500/30 rounded-xl text-xs text-purple-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-left dir-ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-300">
                    صور الملفات أو النتيجة الناجحة (مرفقات اختيارية)
                  </label>
                  {activeSessionImages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleFetchSessionImages}
                      className="text-xs px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-medium"
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>سحب صور المحادثة الحالية تلقائياً ({activeSessionImages.length})</span>
                    </button>
                  )}
                </div>

                {/* Drag and Drop Zone + Paste zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative p-4 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-purple-500 bg-purple-500/20 scale-[1.01]'
                      : 'border-white/15 hover:border-purple-500/40 bg-black/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-200">
                        اسحب الصور وأفلتها هنا، أو اضغط للاختيار
                      </p>
                      <p className="text-[10px] text-purple-300 font-mono mt-0.5 flex items-center gap-1 flex-wrap">
                        <span>💡 يمكنك أيضاً اللصق المباشر من الذاكرة الحافظة باستخدام</span>
                        <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-[9px] text-yellow-300 font-bold dir-ltr">Ctrl + V</kbd>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                    <label className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md">
                      <Upload className="w-3.5 h-3.5" />
                      <span>اختيار ملفات الصور</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    </label>

                    {activeSessionImages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleFetchSessionImages}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-xl transition-all border border-white/10 cursor-pointer flex items-center gap-1"
                      >
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span>استيراد من المحادثة ({activeSessionImages.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {images.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs text-purple-300 font-semibold mb-2 block">
                      الصور المرفقة ({images.length}):
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative group shrink-0">
                          <img src={img} alt={`upload-${idx}`} className="w-16 h-16 object-cover rounded-xl border border-white/20 shadow-md" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">ملاحظات وقواعد خاصة للنموذج (اختياري)</label>
                <input 
                  type="text"
                  placeholder="مثال: ركز دائماً على استخدام ألوان الذهبي والأسود والأكريليك ثلاثي الأبعاد..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-600/30 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>حفظ وإضافة المثال لنظام التعلم</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-white/[0.01] border-t border-white/10 text-center text-[11px] text-gray-500 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>ذاكرة Few-Shot تكيفية؛ تختار الأمثلة بالصلة والجودة ولا تعدّل أوزان موديل Gemini نفسه.</span>
          </div>
          <span>الموديل النشط: Gemini 3.7 Flash</span>
        </div>

      </div>
    </div>
  );
};
