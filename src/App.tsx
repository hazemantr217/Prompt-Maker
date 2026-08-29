import React, { useState, useEffect, useRef } from "react";
import { SavedPrompt, LearnedExample } from "./types";
import { DEFAULT_LEARNED_EXAMPLES } from "./data/defaultExamples";
import { MachineLearningModal } from "./components/MachineLearningModal";
import { ApiKeyModal } from "./components/ApiKeyModal";
import Sidebar from "./components/Sidebar";
import {
  clearUserGeminiApiKey,
  generateVisual,
  getDailyAdvice,
  getGeminiAuthStatus,
  hasUserGeminiApiKey,
  isGeminiApiKeyError,
  optimizePrompt,
  setUserGeminiApiKey,
  type PromptVariation,
} from "./services/api";
import { loadLearnedExamples, loadPromptHistory, saveLearnedExamples, savePromptHistory } from "./lib/storage";
import { MAX_REFERENCE_IMAGES, prepareImageFile } from "./lib/images";
import { markExamplesUsed, rankLearnedExamples, reinforceLearnedExample } from "../shared/learning";
import {
  CHAT_MODELS,
  CHAT_MODEL_IDS,
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  IMAGE_MODEL_IDS,
  getChatModelApiId,
  isModelId,
  type ChatModelId,
  type ModelId,
} from "../shared/models";
import { 
  Sparkles, 
  Copy, 
  Image as ImageIcon, 
  Compass, 
  RefreshCw, 
  Sliders, 
  Zap, 
  Download, 
  ExternalLink,
  ChevronDown,
  MessageSquare,
  X,
  Clock,
  Activity,
  Brain,
  Edit3,
  ThumbsUp,
  Heart,
  Save,
  KeyRound
} from "lucide-react";

interface DailyAdvice {
  date: string;
  tip: string;
  ideaTitle: string;
  ideaDescription: string;
  suggestedEnglishPrompt: string;
  suggestedModel: string;
}

type GeminiAuthMode = 'checking' | 'managed' | 'user-required' | 'unavailable';

export default function App() {
  // State Initialization from LocalStorage safely
  const [history, setHistory] = useState<SavedPrompt[]>(loadPromptHistory);
  
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  
  // Workspace Parameters
  const [currentOriginal, setCurrentOriginal] = useState("");
  const [currentOptimized, setCurrentOptimized] = useState("");
  const [currentModel, setCurrentModel] = useState<ModelId>(DEFAULT_IMAGE_MODEL);
  const [currentChatModel, setCurrentChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [currentAspectRatio, setCurrentAspectRatio] = useState("16:9");
  const [currentCreativity, setCurrentCreativity] = useState(0.7);
  
  // Reference Image Handling (Base64) - Support for multiple reference images
  interface ReferenceImageObj {
    base64: string;
    mimeType: string;
    id: string;
  }
  const [referencedImages, setReferencedImages] = useState<ReferenceImageObj[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawInputRef = useRef<HTMLTextAreaElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // UI Controls
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showChatModelPicker, setShowChatModelPicker] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [isTempChat, setIsTempChat] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [geminiAuthMode, setGeminiAuthMode] = useState<GeminiAuthMode>('checking');
  const [hasSessionApiKey, setHasSessionApiKey] = useState(hasUserGeminiApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Multi-Prompt variations states
  const [isMultiPromptActive, setIsMultiPromptActive] = useState(false);
  const [variationType, setVariationType] = useState<'similar' | 'different'>('different');
  const [currentVariations, setCurrentVariations] = useState<PromptVariation[]>([]);
  const [expandingIndices, setExpandingIndices] = useState<number[]>([]);
  const [expandedHeights, setExpandedHeights] = useState<number[]>([]);

  // Machine Learning Few-Shot System state
  const [learnedExamples, setLearnedExamples] = useState<LearnedExample[]>(loadLearnedExamples);

  const [showMLModal, setShowMLModal] = useState(false);
  const [mlPrefillData, setMlPrefillData] = useState<{ request?: string; winningPrompt?: string; title?: string; images?: string[] } | null>(null);
  const [isCompanionBoardOpen, setIsCompanionBoardOpen] = useState(false);
  
  // Prompt Manual Editing & Like State
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPromptText, setEditedPromptText] = useState("");
  const [likedPrompts, setLikedPrompts] = useState<string[]>([]);

  // Sync edited text with currentOptimized
  useEffect(() => {
    setEditedPromptText(currentOptimized);
    setIsEditingPrompt(false);
  }, [currentOptimized]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    getGeminiAuthStatus()
      .then(({ mode }) => {
        if (!active) return;
        setGeminiAuthMode(mode);
        if (mode === 'user-required' && !hasUserGeminiApiKey()) setShowApiKeyModal(true);
      })
      .catch(() => {
        if (active) setGeminiAuthMode('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveLearnedExamples(learnedExamples);
  }, [learnedExamples]);

  const handleAddLearnedExample = (example: Omit<LearnedExample, 'id' | 'createdAt'>) => {
    setLearnedExamples((previous) => reinforceLearnedExample(previous, example).examples);
  };

  const handleDeleteLearnedExample = (id: string) => {
    setLearnedExamples(prev => prev.filter(e => e.id !== id));
  };

  const handleToggleLearnedExample = (id: string) => {
    setLearnedExamples(prev => prev.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e));
  };

  const handleResetLearnedExamples = () => {
    setLearnedExamples(DEFAULT_LEARNED_EXAMPLES);
    triggerToast("تمت استعادة الأمثلة المرجعية الافتراضية بنجاح!");
  };

  const handleImportLearnedExamples = (imported: LearnedExample[]) => {
    setLearnedExamples(imported);
    triggerToast(`تم استيراد ${imported.length} أمثلة تدريبية!`);
  };

  // Save manual edit to prompt
  const handleSaveEditedPrompt = () => {
    if (!editedPromptText.trim()) {
      triggerToast("لا يمكن ترك البرومبت فارغاً!");
      return;
    }
    setCurrentOptimized(editedPromptText.trim());
    setIsEditingPrompt(false);

    if (activePromptId) {
      setHistory(prev => prev.map(p => p.id === activePromptId ? { ...p, optimized: editedPromptText.trim() } : p));
    }
    triggerToast("تم حفظ التعديل على البرومبت بنجاح! ✍️");
  };

  // Open ML Modal prefilled with prompt
  const handleOpenMLWithPrompt = (winningPromptToAdd?: string, requestToAdd?: string) => {
    const pText = winningPromptToAdd || editedPromptText || currentOptimized;
    const reqText = requestToAdd || currentOriginal || "طلب برومبت تصميم محصن ومعدل";
    const sessionImgs = referencedImages.map(img => img.base64);
    
    setMlPrefillData({
      request: reqText,
      winningPrompt: pText,
      title: "",
      images: sessionImgs.length > 0 ? sessionImgs : undefined
    });
    setShowMLModal(true);
  };

  // Like prompt & automatically train ML model
  const handleLikePrompt = (promptText: string, originalReq?: string) => {
    if (!promptText.trim()) return;

    if (likedPrompts.includes(promptText)) {
      triggerToast("هذا البرومبت مضاف مسبقاً لنظام التعلم الآلي! 🧠");
      return;
    }

    setLikedPrompts(prev => [...prev, promptText]);
    
    const reqText = originalReq || currentOriginal || "طلب تصميم ممتاز";
    const autoTitle = reqText.length > 40 ? reqText.slice(0, 38) + "..." : reqText;
    const sessionImgs = referencedImages.map(img => img.base64);

    handleAddLearnedExample({
      title: autoTitle,
      request: reqText,
      winningPrompt: promptText,
      notes: "تمت إضافته تلقائياً عند النقر على زر الإعجاب بالنتيجة (Liked Prompt)",
      images: sessionImgs.length > 0 ? sessionImgs : undefined,
      isActive: true
    });

    triggerToast("شكراً لتقييمك! تم إضافته وحفظه في نظام التعلم الآلي بنجاح! 🧠❤️");
  };

  const handleToggleTempChat = (val: boolean) => {
    setIsTempChat(val);
    if (val) {
      setActivePromptId(null);
      triggerToast("تم تفعيل وضع الشات المؤقت! لن يتم حفظ هذه الجلسة.");
    } else {
      triggerToast("تم العودة إلى الوضع العادي وحفظ السجل.");
    }
  };

  // Daily Advisor States
  const [dailyAdvice, setDailyAdvice] = useState<DailyAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  // Daily Advice fetch guided by Egypt timezone and available Gemini credentials.
  useEffect(() => {
    if (geminiAuthMode === 'checking') return;

    const fallback: DailyAdvice = {
      date: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }),
      tip: "استخدم Nano Banana 2 لمعظم المهام، وPro فقط للتخطيطات المعقدة والكتابة الدقيقة داخل الصورة.",
      ideaTitle: "لقطة منتج بإضاءة محايدة نظيفة",
      ideaDescription: "تكوين تجاري بسيط يحافظ على اللون الحقيقي للمنتج وملمسه.",
      suggestedEnglishPrompt: "A clean commercial product hero shot with neutral white-balanced studio lighting, accurate material texture, controlled reflections, and a distraction-free background.",
      suggestedModel: "Nano Banana 2"
    };

    if (geminiAuthMode === 'user-required' && !hasSessionApiKey) {
      setDailyAdvice(fallback);
      return;
    }

    const fetchFreshAdvice = async () => {
      setAdviceLoading(true);
      try {
        setDailyAdvice(await getDailyAdvice<DailyAdvice>());
      } catch {
        setDailyAdvice(fallback);
      } finally {
        setAdviceLoading(false);
      }
    };

    fetchFreshAdvice();
  }, [geminiAuthMode, hasSessionApiKey]);

  useEffect(() => {
    savePromptHistory(history);
  }, [history]);

  // Adjust optimal configurations on model changes
  useEffect(() => {
    const preset = IMAGE_MODELS[currentModel];
    if (preset) {
      setCurrentAspectRatio(preset.bestAspectRatio);
      setCurrentCreativity(preset.bestCreativity);
    }
  }, [currentModel]);

  // Auto-growing bottom input height controller
  useEffect(() => {
    if (rawInputRef.current) {
      rawInputRef.current.style.height = "auto";
      rawInputRef.current.style.height = `${rawInputRef.current.scrollHeight}px`;
    }
  }, [currentOriginal]);

  // Copy toast controller helper
  const triggerToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setCopyToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setCopyToast(null);
    }, 2500);
  };

  const ensureGeminiAccess = (): boolean => {
    if (geminiAuthMode === 'checking') {
      triggerToast('جاري التحقق من اتصال Gemini...');
      return false;
    }
    if (geminiAuthMode === 'user-required' && !hasSessionApiKey) {
      setShowApiKeyModal(true);
      triggerToast('أدخل مفتاح Gemini API أولًا.');
      return false;
    }
    return true;
  };

  const handleGeminiRequestError = (error: unknown, prefix: string) => {
    if (geminiAuthMode === 'user-required' && isGeminiApiKeyError(error)) {
      clearUserGeminiApiKey();
      setHasSessionApiKey(false);
      setShowApiKeyModal(true);
      triggerToast('المفتاح غير صالح أو لا يملك الصلاحية المطلوبة. أدخل مفتاحًا آخر.');
      return;
    }
    triggerToast(`${prefix}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
  };

  const handleSaveApiKey = (apiKey: string) => {
    setUserGeminiApiKey(apiKey);
    setHasSessionApiKey(true);
    setShowApiKeyModal(false);
    triggerToast('تم ربط مفتاح Gemini لهذه الجلسة بنجاح.');
  };

  const handleClearApiKey = () => {
    clearUserGeminiApiKey();
    setHasSessionApiKey(false);
    triggerToast('تم حذف مفتاح Gemini من الجلسة الحالية.');
  };

  // Create a brand new workspace sequence
  const handleNewWorkspace = () => {
    setActivePromptId(null);
    setCurrentOriginal("");
    setCurrentOptimized("");
    setReferencedImages([]);
    setCurrentVariations([]);
    setIsMultiPromptActive(false);
    setGeneratedImageUrl(null);
    const preset = IMAGE_MODELS[currentModel];
    setCurrentAspectRatio(preset.bestAspectRatio);
    setCurrentCreativity(preset.bestCreativity);
    triggerToast("بدء مسودة برومبت فارغة جديدة");
  };

  // Delete Prompt item
  const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(p => p.id !== id);
    setHistory(updated);
    if (activePromptId === id) {
      handleNewWorkspace();
    }
    triggerToast("تم مسح البرومبت من الأرشيف");
  };

  // Select item from sidebar
  const handleSelectPrompt = (id: string) => {
    const item = history.find(p => p.id === id);
    if (item) {
      setActivePromptId(item.id);
      setCurrentOriginal(item.original);
      setCurrentOptimized(item.optimized);
      setCurrentModel(item.model);
      if (item.chatModel) {
        setCurrentChatModel(item.chatModel);
      }
      setCurrentAspectRatio(item.aspect_ratio);
      setCurrentCreativity(item.creativity);
      if (item.referenceImages && item.referenceImages.length > 0) {
        setReferencedImages(item.referenceImages.map((base64, i) => ({
          base64,
          mimeType: "image/png",
          id: `restored-${i}-${Math.random().toString(36).substring(7)}`
        })));
      } else if (item.referenceImage) {
        setReferencedImages([{
          base64: item.referenceImage,
          mimeType: "image/png",
          id: `restored-0-${Math.random().toString(36).substring(7)}`
        }]);
      } else {
        setReferencedImages([]);
      }
      if (item.variations && item.variations.length > 0) {
        setCurrentVariations(item.variations);
        setIsMultiPromptActive(true);
      } else {
        setCurrentVariations([]);
        setIsMultiPromptActive(false);
      }
      setGeneratedImageUrl(item.imageUrl || null);
    }
  };

  const processImageFile = async (file: File) => {
    if (referencedImages.length >= MAX_REFERENCE_IMAGES) {
      triggerToast(`الحد الأقصى ${MAX_REFERENCE_IMAGES} صور مرجعية.`);
      return;
    }
    try {
      const { base64, mimeType } = await prepareImageFile(file);
      const imgId = Math.random().toString(36).substring(7);
      setReferencedImages((previous) => previous.length >= MAX_REFERENCE_IMAGES
        ? previous
        : [...previous, { base64, mimeType, id: imgId }]);
      triggerToast("تم إضافة الصورة المرجعية بنجاح!");
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : "تعذر تجهيز الصورة.");
    }
  };

  // Handle Drag Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(file => {
        processImageFile(file as File);
      });
    }
  };

  // Handle Ctrl+V image copy/paste events from clipboard inside text-area
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file as File);
          e.preventDefault();
        }
      }
    }
  };

  // Trigger file manager manually on click
  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  // Input change on upload trigger
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        processImageFile(file as File);
      });
    }
  };

  // Copy output prompt helper
  const handleCopyPrompt = () => {
    const copyText = currentOptimized || currentOriginal;
    if (!copyText) {
      triggerToast("لا يوجد برومبت لنسخه حالياً!");
      return;
    }
    navigator.clipboard.writeText(copyText);
    triggerToast("تم نسخ البرومبت إلى الحافظة!");
  };

  // API Integration: Improve/Refine/Optimize Prompt
  const handleOptimizePrompt = async (modifierAction?: 'shorten' | 'expand') => {
    if (!currentOriginal && referencedImages.length === 0) {
      triggerToast("الرجاء كتابة فكرة أو تزويد صورة للتحسين.");
      return;
    }

    if (!ensureGeminiAccess()) return;

    setIsLoading(true);

    try {
      const learningCandidates = rankLearnedExamples(currentOriginal, learnedExamples, {
        maxExamples: 8,
        maxCharacters: 30_000,
      });
      const data = await optimizePrompt({
        prompt: currentOriginal,
        model: currentModel,
        images: referencedImages.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
        aspectRatio: currentAspectRatio,
        creativity: currentCreativity,
        chatModel: getChatModelApiId(currentChatModel),
        modifierAction,
        multiPrompt: isMultiPromptActive,
        variationType,
        learnedExamples: learningCandidates.map(({ example }) => {
          const { images: _images, ...textExample } = example;
          return textExample;
        }),
      });
      setCurrentOptimized(data.optimizedPrompt);
      
      if (data.variations && data.variations.length > 0) {
        setCurrentVariations(data.variations);
      } else {
        setCurrentVariations([]);
      }

      if (data.learning?.selectedIds.length) {
        setLearnedExamples((previous) => markExamplesUsed(previous, data.learning?.selectedIds ?? []));
      }

      // Update or create active item session
      const updatedPrompt: SavedPrompt = {
        id: activePromptId || Math.random().toString(36).substring(7),
        original: currentOriginal,
        optimized: data.optimizedPrompt,
        model: currentModel,
        chatModel: currentChatModel,
        mode: 'Optimized',
        aspect_ratio: currentAspectRatio,
        creativity: currentCreativity,
        referenceImage: referencedImages[0]?.base64 || undefined,
        referenceImages: referencedImages.map(img => img.base64),
        analysis: data.analysis,
        explanation: data.explanation,
        variations: data.variations,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };

      if (isTempChat) {
        triggerToast("تم تحسين البرومبت بنجاح! (نمط شات مؤقت - لم يتم الحفظ)");
      } else {
        if (activePromptId) {
          // Replace existing
          setHistory(prev => prev.map(p => p.id === activePromptId ? updatedPrompt : p));
        } else {
          // Add new
          setHistory(prev => [updatedPrompt, ...prev]);
          setActivePromptId(updatedPrompt.id);
        }
        triggerToast("تم تحليل الصورة وتحسين البرومبت برعاية جيميناي بنجاح!");
      }
    } catch (error) {
      handleGeminiRequestError(error, 'عطل');
    } finally {
      setIsLoading(false);
    }
  };

  // Individual expansion handler for a single prompt variation under the 3 prompts layout
  const handleExpandSingleVariation = async (index: number, silentToast = false) => {
    if (expandingIndices.includes(index)) return;
    const targetVariant = currentVariations[index];
    if (!targetVariant) return;
    if (!ensureGeminiAccess()) return;

    setExpandingIndices(prev => [...prev, index]);
    try {
      const learningCandidates = rankLearnedExamples(targetVariant.prompt, learnedExamples, {
        maxExamples: 6,
        maxCharacters: 24_000,
      });
      const data = await optimizePrompt({
        prompt: targetVariant.prompt,
        model: currentModel,
        aspectRatio: currentAspectRatio,
        creativity: currentCreativity,
        chatModel: getChatModelApiId(currentChatModel),
        modifierAction: 'expand',
        multiPrompt: false,
        learnedExamples: learningCandidates.map(({ example }) => {
          const { images: _images, ...textExample } = example;
          return textExample;
        }),
      });
      if (data.optimizedPrompt) {
        setCurrentVariations(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            prompt: data.optimizedPrompt,
            lighting: data.analysis?.lighting || updated[index].lighting,
            explanation: data.explanation || updated[index].explanation
          };
          return updated;
        });
        if (!silentToast) {
          triggerToast(`تم تطويل وتوسيع الخيار ${index + 1} بنجاح!`);
        }
      }
    } catch (error) {
      handleGeminiRequestError(error, `فشل توسيع الخيار ${index + 1}`);
    } finally {
      setExpandingIndices(prev => prev.filter(item => item !== index));
    }
  };

  // Bulk expansion handler for all 3 generated prompt variations
  const handleExpandAllVariations = async () => {
    if (currentVariations.length === 0) {
      triggerToast("الرجاء توليد الـ 3 خيارات أولاً!");
      return;
    }
    triggerToast("جاري البدء في توسيع الـ 3 ملقنات معاً في الخلفية...");
    const promises = currentVariations.map((_, index) => handleExpandSingleVariation(index, true));
    await Promise.all(promises);
    triggerToast("تم الانتهاء بنجاح من توسيع وتحسين جميع الـ 3 خيارات!");
  };

  // API Integration: Actually generate actual Image / falling back to highly beautiful visual layout with Unsplash
  const handleGenerateVisuals = async (customPrompt?: string) => {
    const testPrompt = customPrompt || currentOptimized || currentOriginal;
    if (!testPrompt) {
      triggerToast("الرجاء توفير برومبت محسن للجرأة والتوليد أولاً!");
      return;
    }

    if (!ensureGeminiAccess()) return;

    setImageLoading(true);

    try {
      const data = await generateVisual({
        prompt: testPrompt,
        model: currentModel,
        aspectRatio: currentAspectRatio,
        imageSize: "1K",
      });
      if (data.success) {
        setGeneratedImageUrl(data.imageUrl);

        // Save generated visual URL to existing active state
        if (activePromptId) {
          setHistory(prev => prev.map(p => {
            if (p.id === activePromptId) {
              return { ...p, imageUrl: data.imageUrl };
            }
            return p;
          }));
        }
        triggerToast("تم إنشاء الصورة الإلهامية للبرومبت بنجاح!");
      }
    } catch (error) {
      handleGeminiRequestError(error, 'فشل توليد التكوين البصري');
    } finally {
      setImageLoading(false);
    }
  };

  // Clear all loaded reference images helper
  const handleClearAllReferenceImages = () => {
    setReferencedImages([]);
    triggerToast("تم إزالة جميع الصور المرجعية.");
  };

  const handleRemoveReferenceImage = (idToClear: string) => {
    setReferencedImages(prev => prev.filter(img => img.id !== idToClear));
    triggerToast("تم إزالة الصورة المرجعية.");
  };

  const getAspectRatios = () => [...IMAGE_MODELS[currentModel].aspectRatios];

  return (
    <div dir="rtl" className="h-screen w-full bg-[#050505] text-[#e5e7eb] font-sans flex overflow-hidden relative selection:bg-yellow-400 selection:text-black">
      <ApiKeyModal
        isOpen={showApiKeyModal && geminiAuthMode === 'user-required'}
        hasExistingKey={hasSessionApiKey}
        onSave={handleSaveApiKey}
        onClear={handleClearApiKey}
        onClose={() => setShowApiKeyModal(false)}
      />
      
      {/* Absolute Toast Display */}
      {copyToast && (
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 z-50 bg-[#121212]/90 backdrop-blur-md border border-yellow-400/30 px-5 py-3 rounded-2xl text-xs text-yellow-300 shadow-xl shadow-yellow-500/10 flex items-center gap-2 animate-bounce">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="font-semibold">{copyToast}</span>
        </div>
      )}

      {/* Sidebar navigation and guides */}
      <Sidebar 
        history={history}
        activePromptId={activePromptId}
        onSelectPrompt={handleSelectPrompt}
        onNewWorkspace={handleNewWorkspace}
        onDeletePrompt={handleDeletePrompt}
        isTempChat={isTempChat}
        onToggleTempChat={handleToggleTempChat}
      />

      {/* Primary Workspace Space */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-b from-[#0a0a0a] to-[#050505]" onDragOver={handleDragOver} onDrop={handleDrop}>
        
        {/* Workspace Top Header Panel */}
        <header className="min-h-16 border-b border-white/5 px-6 sm:px-8 flex flex-col xl:flex-row items-center justify-between gap-4 py-3 bg-black/40 backdrop-blur-xl z-20 w-full">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full justify-start">
            
            {/* Chat Helper Model Selector dropdown */}
            <div className="relative">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-0.5">نموذج المساعد الذكي (الشات صانع البرومبت)</span>
              <button 
                onClick={() => {
                  setShowChatModelPicker(!showChatModelPicker);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 font-semibold transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>{currentChatModel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-indigo-400 transition-transform ${showChatModelPicker ? 'rotate-180' : ''}`} />
              </button>

              {showChatModelPicker && (
                <div className="absolute top-12 right-0 w-60 bg-[#0d0d0d] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in-50 duration-200">
                  <div className="text-[10px] text-gray-400 font-bold px-3 py-1.5 uppercase tracking-wide border-b border-white/5">اختر نموذج جيميناي للشات وتحسين البرومبت</div>
                  {CHAT_MODEL_IDS.map((key) => {
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setCurrentChatModel(key);
                          setShowChatModelPicker(false);
                          triggerToast(`تم تفعيل مساعد الشات: ${key}`);
                        }}
                        className={`w-full text-right px-3 py-2 rounded-xl text-xs flex flex-col gap-0.5 hover:bg-white/5 transition-colors cursor-pointer ${currentChatModel === key ? 'bg-indigo-400/10 text-indigo-300' : 'text-gray-300'}`}
                      >
                        <span className="font-bold">{key}</span>
                        <span className="text-[9px] text-gray-500 leading-relaxed">{CHAT_MODELS[key].description}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>

            <label className="flex flex-col gap-1 text-[9px] text-gray-500 font-bold">
              موديل توليد الصور
              <select
                value={currentModel}
                onChange={(event) => {
                  if (isModelId(event.target.value)) setCurrentModel(event.target.value);
                }}
                className="bg-[#111] border border-yellow-400/20 text-yellow-300 rounded-xl px-3 py-1.5 text-xs outline-none cursor-pointer"
              >
                {IMAGE_MODEL_IDS.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[9px] text-gray-500 font-bold">
              نسبة الأبعاد
              <select
                value={currentAspectRatio}
                onChange={(event) => setCurrentAspectRatio(event.target.value)}
                className="bg-[#111] border border-white/10 text-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none cursor-pointer"
              >
                {getAspectRatios().map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1 min-w-32 text-[9px] text-gray-500 font-bold">
              الإبداع: {currentCreativity.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentCreativity}
                onChange={(event) => setCurrentCreativity(Number(event.target.value))}
                className="accent-yellow-400 cursor-pointer"
              />
            </label>

            <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>

            {/* Machine Learning Few-Shot Learning Hub button */}
            <div>
              <span className="text-[9px] text-purple-400/80 font-bold uppercase tracking-wider block mb-0.5">ذاكرة تعلم تكيفية بالأمثلة</span>
              <button 
                onClick={() => setShowMLModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl text-xs text-purple-300 font-bold transition-all cursor-pointer shadow-sm hover:shadow-purple-500/10"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                <span>ذاكرة التعلم ({learnedExamples.filter(e => e.isActive).length} أمثلة مفعلة)</span>
              </button>
            </div>

          </div>

          <div className="flex items-center gap-3 shrink-0 hidden lg:flex">
            {isTempChat && (
              <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-400/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
                <span>⏱️ شات مؤقت</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (geminiAuthMode === 'user-required') setShowApiKeyModal(true);
                else if (geminiAuthMode === 'managed') triggerToast('بيئة التشغيل تدير مفتاح Gemini تلقائيًا وبأمان.');
              }}
              className={`text-[10px] border px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 transition-colors ${
                geminiAuthMode === 'managed'
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                  : geminiAuthMode === 'user-required' && hasSessionApiKey
                    ? 'text-sky-300 bg-sky-500/10 border-sky-500/20 cursor-pointer'
                    : geminiAuthMode === 'user-required'
                      ? 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20 cursor-pointer animate-pulse'
                      : 'text-gray-400 bg-white/5 border-white/10'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {geminiAuthMode === 'managed'
                  ? 'مفتاح المنصة متصل تلقائيًا'
                  : geminiAuthMode === 'user-required' && hasSessionApiKey
                    ? 'مفتاحك متصل'
                    : geminiAuthMode === 'user-required'
                      ? 'أدخل مفتاح Gemini'
                      : geminiAuthMode === 'checking'
                        ? 'فحص اتصال Gemini'
                        : 'تعذر فحص اتصال Gemini'}
              </span>
            </button>
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: "10s" }} />
              <span>حدود الاستخدام الفعلية تُدار من مشروع Gemini API</span>
            </span>
          </div>
        </header>

        {/* Workspace Central Core Editor */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6 scrollbar-thin">

          {/* Smart Workspace for Optimization */}
          <div className="w-full shrink-0 min-h-[350px]">
            {isLoading ? (
              <div className="flex flex-col bg-[#111]/40 border border-white/5 rounded-2xl p-8 relative shadow-2xl overflow-hidden min-h-[300px] justify-center items-center">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-pulse shadow-[0_0_12px_rgba(250,204,21,1)]"></div>
                <RefreshCw className="w-10 h-10 text-yellow-400 animate-spin mb-4" />
                <p className="text-sm font-bold text-yellow-300 italic text-center max-w-lg leading-relaxed animate-pulse">
                  {isMultiPromptActive 
                    ? "يقوم جيميناي الآن بإنشاء 3 بدائل ملقنات متنوعة للملقن بخصائص استثنائية مختلفة ومدروسة..."
                    : "يقوم جيميناي الآن بتشريح عناصر الصورة المرجعية وإضافة تفاصيل التظليل وعمق الألوان وتجهيز الملقن الهندسي..."
                  }
                </p>
                <span className="text-[10px] text-gray-500 font-mono mt-2">شغل عالي وثواني وهتنبهر!</span>
              </div>
            ) : (isMultiPromptActive && currentVariations.length > 0) ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                
                {/* Optimized Multi-Prompt Section Header with Bulk Expand All 3 Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>3 بدائل ملقنات متنوعة ({variationType === 'similar' ? 'خيارات متجانسة ومتشابهة' : 'بدائل إبداعية بستايلات مختلفة'})</span>
                    </span>
                    {variationType === 'different' && (
                      <span className="text-[9px] text-yellow-400 bg-yellow-400/5 border border-yellow-400/10 px-2.5 py-0.5 rounded-full font-bold">
                        🎨 تصاميم مختلفة
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Visual height expansion for all 3 prompts */}
                    <button
                      onClick={() => {
                        if (expandedHeights.length === currentVariations.length) {
                          setExpandedHeights([]);
                          triggerToast("تم تقليص مقاسات العرض لجميع البدائل.");
                        } else {
                          setExpandedHeights(currentVariations.map((_, i) => i));
                          triggerToast("تم توسيع مقاسات العرض لجميع البدائل الـ 3 لرؤية النص بالكامل!");
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>{expandedHeights.length === currentVariations.length ? "🤏 تقليص عرض الـ 3 ملقنات" : "↔️ تكبير عرض الـ 3 ملقنات معاً"}</span>
                    </button>

                    <button
                      onClick={handleExpandAllVariations}
                      disabled={expandingIndices.length > 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                      <span>🚀 تطوير بالذكاء للـ 3 ملقنات معاً</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {currentVariations.map((variant, index) => (
                    <div 
                      key={index} 
                      className={`flex flex-col bg-gradient-to-b from-white/[0.03] to-transparent border rounded-2xl p-5 relative shadow-xl transition-all duration-300 group ${
                        expandingIndices.includes(index) ? 'border-yellow-400/40 bg-yellow-400/[0.01]' : 'border-white/10 hover:border-yellow-400/35'
                      }`}
                    >
                      {/* Highlight index badge */}
                      <div className="absolute -top-3 -left-3 w-7 h-7 rounded-lg bg-yellow-400 text-black flex items-center justify-center font-bold text-xs shadow-md">
                        {index + 1}
                      </div>

                      <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-white/5 pl-4">
                        <span className="text-xs text-yellow-300 font-bold leading-none truncate max-w-[150px]">
                          {variant.style || `الخيار ${index + 1}`}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Option to visually expand prompt box */}
                          <button
                            onClick={() => {
                              if (expandedHeights.includes(index)) {
                                setExpandedHeights(prev => prev.filter(i => i !== index));
                              } else {
                                setExpandedHeights(prev => [...prev, index]);
                              }
                            }}
                            title={expandedHeights.includes(index) ? "تقليص المقاس" : "رؤية كامل النص بالكامل"}
                            className={`px-1.5 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              expandedHeights.includes(index)
                                ? "bg-amber-400 text-black shadow-md shadow-amber-500/10"
                                : "bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white"
                            }`}
                          >
                            <Sliders className="w-2.5 h-2.5" />
                            <span>{expandedHeights.includes(index) ? "تقليص" : "تكبير"}</span>
                          </button>

                          <button
                            onClick={() => handleOpenMLWithPrompt(variant.prompt, currentOriginal)}
                            title="إضافة هذا البديل لنظام التعلم الآلي"
                            className="p-1.5 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-all cursor-pointer"
                          >
                            <Brain className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleLikePrompt(variant.prompt, currentOriginal)}
                            title="إعجاب بالنتيجة وتدريب نظام التعلم الآلي"
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              likedPrompts.includes(variant.prompt)
                                ? "bg-pink-500/20 text-pink-400"
                                : "hover:bg-yellow-400/20 text-yellow-400"
                            }`}
                          >
                            {likedPrompts.includes(variant.prompt) ? (
                              <Heart className="w-3.5 h-3.5 fill-pink-400 text-pink-400" />
                            ) : (
                              <ThumbsUp className="w-3.5 h-3.5 text-yellow-400" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(variant.prompt);
                              triggerToast(`تم نسخ ملقن الخيار ${index + 1} إلى الذاكرة!`);
                            }}
                            title="نسخ للذاكرة"
                            className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className={`text-xs text-gray-200/90 leading-relaxed font-mono select-all bg-black/40 p-3.5 rounded-xl border border-white/5 text-left overflow-y-auto whitespace-pre-wrap break-words scrollbar-thin scrollbar-thumb-white/10 mb-4 transition-all duration-200 focus-within:border-yellow-400/30 ${
                            expandedHeights.includes(index) ? 'max-h-none' : 'max-h-[170px]'
                          }`}>
                            {variant.prompt}
                          </div>

                          <div className="space-y-3 text-right">
                            <div>
                              <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider mb-0.5">تفاصيل الإضاءة والجو العام</span>
                              <p className="text-[11px] text-gray-300 leading-normal block">{variant.lighting}</p>
                            </div>
                            
                            {variant.explanation && (
                              <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                                <span className="text-[9px] text-emerald-400 font-bold block uppercase tracking-wider mb-0.5">الرؤية وفكرة التصميم</span>
                                <p className="text-[11px] text-gray-400 leading-relaxed italic block">{variant.explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expand individual variation option */}
                        <div className="pt-4 mt-4 border-t border-white/5">
                          <button
                            onClick={() => handleExpandSingleVariation(index)}
                            disabled={expandingIndices.includes(index)}
                            className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-white/5 disabled:text-gray-500 text-black rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer transform active:scale-95"
                          >
                            {expandingIndices.includes(index) ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>جاري توسيع هذا البديل...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-black" />
                                <span>🚀 طوّل واشرح بالتفصيل (Expand)</span>
                              </>
                            )}
                          </button>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Optimized output preview layout for single prompt */
              <div className="flex flex-col bg-white/[0.02] border border-white/10 rounded-2xl p-6 relative shadow-2xl overflow-hidden group">
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>البرومبت المتظبط والجاهز للطباعة (Optimized Prompt)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {learnedExamples.filter(e => e.isActive).length > 0 && (
                      <span className="text-[10px] text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Brain className="w-3 h-3 text-purple-400" />
                        <span>اختيار ذكي من {learnedExamples.filter(e => e.isActive).length} أمثلة</span>
                      </span>
                    )}

                    {currentOptimized && (
                      <button
                        onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                        title={isEditingPrompt ? "إلغاء التعديل" : "تعديل البرومبت يدويًا"}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                          isEditingPrompt 
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" 
                            : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isEditingPrompt ? "إلغاء التعديل" : "تعديل النص"}</span>
                      </button>
                    )}

                    <button
                      onClick={handleCopyPrompt}
                      title="نسخ للذاكرة"
                      disabled={!currentOptimized}
                      className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-all disabled:opacity-50"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {currentOptimized ? (
                  <div className="flex-1 flex flex-col">
                    {isEditingPrompt ? (
                      <div className="flex flex-col space-y-3 bg-black/50 p-4 rounded-xl border border-purple-500/40 shadow-inner">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                            <span>تعديل البرومبت الحالي المباشر:</span>
                          </span>
                          <span className="text-[10px] text-gray-400">عدل النص الإنجليزي كما تحب ثم احفظه أو أضفه مباشرة للتعلم</span>
                        </div>
                        <textarea
                          value={editedPromptText}
                          onChange={(e) => setEditedPromptText(e.target.value)}
                          rows={6}
                          className="w-full bg-black/60 text-yellow-100 font-mono text-xs leading-relaxed p-3 rounded-lg border border-purple-500/20 focus:outline-none focus:border-purple-400 scrollbar-thin resize-y"
                          placeholder="اكتب أو عدل البرومبت الإنجليزي..."
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSaveEditedPrompt}
                              className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>حفظ التعديل</span>
                            </button>

                            <button
                              onClick={() => handleOpenMLWithPrompt(editedPromptText)}
                              className="px-3.5 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/50 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            >
                              <Brain className="w-3.5 h-3.5 text-purple-300" />
                              <span>حفظ وإضافة لنظام التعلم الآلي</span>
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setEditedPromptText(currentOptimized);
                              setIsEditingPrompt(false);
                            }}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded-xl transition-all cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-yellow-100/90 leading-relaxed font-mono select-all bg-black/35 p-4 rounded-xl border border-white/5 text-left max-h-[340px] overflow-y-auto whitespace-pre-wrap break-words scrollbar-thin scrollbar-thumb-white/10">
                        {currentOptimized}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-black/20 rounded-xl border border-dashed border-white/5 min-h-[220px]">
                    <Sparkles className="w-10 h-10 text-gray-700 mb-3 animate-pulse" />
                    <p className="text-xs text-gray-500 max-w-sm">
                      لا يوجد ملقن محسن حتى الآن. اكتب فكرتك في مربع الكتابة بالأسفل واضغط على زر <span className="text-yellow-400 font-bold">تحسين البرومبت</span> لتحويل الفكرة البسيطة إلى ملقن فائق الجودة والواقعية.
                    </p>
                  </div>
                )}

                {/* Internal actions bar overlay in the prompter context */}
                <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    <button 
                      onClick={() => handleOptimizePrompt('expand')}
                      disabled={isLoading || (!currentOriginal && referencedImages.length === 0)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-semibold border border-transparent hover:border-white/10 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      🚀 طوّل واشرح بالتفصيل (Expand)
                    </button>
                    <button 
                      onClick={() => handleOptimizePrompt('shorten')}
                      disabled={isLoading || (!currentOriginal && referencedImages.length === 0)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-semibold border border-transparent hover:border-white/10 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      ⚡ لخّص وصغر الملقن (Shorten)
                    </button>
                    {currentOptimized && !isEditingPrompt && (
                      <button 
                        onClick={() => setIsEditingPrompt(true)}
                        className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg text-[10px] font-bold border border-purple-500/20 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3 text-purple-400" />
                        <span>تعديل البرومبت (Edit)</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentOptimized && (
                      <>
                        <button
                          onClick={() => handleGenerateVisuals()}
                          disabled={imageLoading}
                          className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>{imageLoading ? 'جاري توليد الصورة...' : 'ولّد صورة تجريبية'}</span>
                        </button>

                        <button
                          onClick={() => handleOpenMLWithPrompt()}
                          title="إضافة هذا البرومبت المعتمد إلى أمثلة نظام التعلم الآلي"
                          className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Brain className="w-3.5 h-3.5 text-purple-400" />
                          <span>إضافة للتعلم الآلي</span>
                        </button>

                        <button
                          onClick={() => handleLikePrompt(currentOptimized)}
                          title="إعجاب بالنتيجة وإضافتها تلقائياً لنظام التعلم الآلي"
                          className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            likedPrompts.includes(currentOptimized)
                              ? "bg-pink-500/20 text-pink-300 border-pink-500/40"
                              : "bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border-yellow-400/30"
                          }`}
                        >
                          {likedPrompts.includes(currentOptimized) ? (
                            <>
                              <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                              <span>تم الإعجاب والتدريب 🧠</span>
                            </>
                          ) : (
                            <>
                              <ThumbsUp className="w-3.5 h-3.5 text-yellow-400" />
                              <span>إعجاب وتدريب بالتعلم الآلي</span>
                            </>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      onClick={handleCopyPrompt}
                      disabled={!currentOptimized}
                      className="text-xs text-white bg-white/10 hover:bg-white/15 px-4 py-1.5 rounded-full font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      انسخ النص اللى اتظبط
                    </button>
                  </div>
                </div>

                {imageLoading && (
                  <div className="mt-4 rounded-xl border border-indigo-500/20 bg-black/30 p-8">
                    <SplashLoadingAnimation />
                  </div>
                )}

                {!imageLoading && generatedImageUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/30 p-2">
                    <img src={generatedImageUrl} alt="الصورة المولدة من البرومبت" className="max-h-[520px] w-full rounded-lg object-contain" />
                  </div>
                )}

              </div>
            )}
          </div>

          {/* لوحة المرافقة والذكاء الشاملة - Collapsible & Toggleable */}
          <div className="bg-gradient-to-r from-yellow-400/[0.03] to-indigo-500/[0.02] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden group shrink-0 mt-2 text-right transition-all">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-yellow-400/[0.02] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/[0.02] rounded-full blur-3xl pointer-events-none" />

            {/* Title Header with Toggle Button */}
            <div 
              onClick={() => setIsCompanionBoardOpen(!isCompanionBoardOpen)}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-yellow-400/15 rounded-xl shrink-0">
                  <Compass className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold text-white flex flex-wrap items-center gap-2">
                    لوحة المرافقة التفاعلية والذكاء الشاملة (Smart Companion Board)
                    <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold transition-all ${
                      isCompanionBoardOpen 
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse"
                        : "bg-yellow-400/10 border border-yellow-400/20 text-yellow-300"
                    }`}>
                      {isCompanionBoardOpen ? "مستشار جيميناي النشط" : "انقر للإظهار 🧭"}
                    </span>
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                    توقيت مصر: {dailyAdvice?.date || new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' })} • مراقبة الباقة اليومية والنصائح
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 self-start md:self-auto">
                <a 
                  href="https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image" 
                  target="_blank" 
                  referrerPolicy="no-referrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1.5 bg-yellow-400/5 hover:bg-yellow-400/10 border border-yellow-400/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
                >
                  <span>وثائق النماذج الرسمية</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCompanionBoardOpen(!isCompanionBoardOpen);
                  }}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  <span>{isCompanionBoardOpen ? "إخفاء اللوحة" : "إظهار اللوحة"}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCompanionBoardOpen ? "rotate-180 text-yellow-400" : "text-gray-300"}`} />
                </button>
              </div>
            </div>

            {/* Collapsible Content */}
            {isCompanionBoardOpen && (
              <div className="p-5 pt-0 space-y-5 border-t border-white/5 animate-in fade-in duration-200">
                {/* Consolidated Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                  
                  {/* Right Box Section 1: الفكرة المقترحة لليوم */}
                  {adviceLoading ? (
                    <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center space-y-2 h-[150px] animate-pulse">
                      <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
                      <span className="text-[10px] text-gray-400">جاري تحميل فكرة التصميم...</span>
                    </div>
                  ) : dailyAdvice ? (
                    <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col justify-between space-y-3 text-right">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-bold text-yellow-300">الفكرة الفنية المقترحة لليوم</span>
                          <Zap className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                        </div>
                        <div className="flex justify-end">
                          <span className="text-[9px] text-[#e5e7eb] font-bold block bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-0.5 rounded">
                            {dailyAdvice.ideaTitle}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed font-semibold mt-1">
                          {dailyAdvice.ideaDescription}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-right">
                          <span className="text-[8px] text-gray-500 block">الموديل المناسب</span>
                          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-0.5 rounded-md border border-yellow-400/15">
                            {dailyAdvice.suggestedModel}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setCurrentOriginal(dailyAdvice.ideaDescription);
                            if (isModelId(dailyAdvice.suggestedModel)) {
                               setCurrentModel(dailyAdvice.suggestedModel);
                            }
                            setCurrentOptimized(dailyAdvice.suggestedEnglishPrompt);
                            triggerToast("تم تفعيل الفكرة والموديل! جاهز للرسم والتحسين.");
                          }}
                          className="bg-yellow-400 hover:bg-yellow-300 text-black px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <span>تطبيق مباشرة</span>
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center h-[150px] text-gray-500 text-xs">
                      الفكرة المقترحة غير متوفرة حالياً
                    </div>
                  )}

                  {/* Section 2: نصيحة النموذج اليومية */}
                  {adviceLoading ? (
                    <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center space-y-2 h-[150px] animate-pulse">
                      <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                      <span className="text-[10px] text-gray-400 font-mono">جاري استيراد نصيحة جيميناي اليومية...</span>
                    </div>
                  ) : dailyAdvice ? (
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-bold text-indigo-300">نصيحة الصياغة اليومية من الصحيفة</span>
                          <Compass className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed font-medium mt-1 font-semibold">
                          {dailyAdvice.tip}
                        </p>
                      </div>
                      <div className="text-[9px] text-gray-500 font-mono text-left pt-2 border-t border-white/5 font-bold">
                        مستخلص تلقائي عبر مستندات التطوير
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center h-[150px] text-gray-500 text-xs">
                      النصيحة اليومية غير متوفرة حالياً
                    </div>
                  )}

                  {/* Section 3: Accurate API status guidance */}
                  <div className="bg-gradient-to-br from-indigo-500/[0.02] to-emerald-500/[0.02] border border-white/10 p-5 rounded-xl flex flex-col justify-between space-y-4 text-right shadow-xl">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold flex items-center gap-1">
                          حماية فعالة
                        </span>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-bold text-[#e5e7eb]">حالة اتصال Gemini</span>
                          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                        التطبيق يتحقق من المدخلات، يحد عدد الطلبات، ولا يعرض مفتاح Gemini للمتصفح. عدد الطلبات المتبقية وموعد تجدد الحصة يختلفان حسب خطة مشروعك، لذلك لا يتم عرض عداد تقديري مضلل.
                      </p>
                    </div>

                    <div className="text-[10px] text-yellow-300/90 bg-yellow-400/5 p-2 rounded-lg border border-yellow-400/10 leading-relaxed font-semibold">
                      عند ظهور خطأ 429 انتظر قليلًا أو راجع حدود وفوترة مشروع Gemini API.
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

        </div>

        {/* Global Reference image floating thumbnail inside text container if uploaded */}
        {referencedImages.length > 0 && (
          <div className="px-8 flex flex-wrap gap-3 animate-in slide-in-from-bottom-2 duration-300">
            {referencedImages.map((img) => (
              <div key={img.id} className="relative bg-[#111111]/70 border border-white/10 p-1.5 rounded-xl flex items-center gap-2.5 shadow-md">
                <img 
                  src={img.base64} 
                  onClick={() => setPreviewImageUrl(img.base64)}
                  className="w-10 h-10 object-cover rounded-lg border border-white/10 cursor-pointer hover:rotate-1 hover:scale-110 active:scale-95 hover:border-yellow-400/50 transition-all duration-200" 
                  alt="Ref upload" 
                  title="اضغط لمشاهدة وتكبير الصورة المرجعية"
                />
                <div 
                  onClick={() => setPreviewImageUrl(img.base64)}
                  className="text-right cursor-pointer group/label"
                  title="اضغط لمشاهدة وتكبير الصورة المرجعية"
                >
                  <div className="text-[10px] text-gray-400 font-bold block group-hover/label:text-yellow-400 transition-colors">صورة مرجعية</div>
                  <div className="text-[8px] text-yellow-400 font-mono">طراز: صورة (تكبير)</div>
                </div>
                <button 
                  onClick={() => handleRemoveReferenceImage(img.id)}
                  className="p-1 hover:bg-white/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                  title="مسح هذه الصورة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {referencedImages.length > 1 && (
              <button
                onClick={handleClearAllReferenceImages}
                className="text-[10px] text-red-400 hover:text-red-300 hover:underline cursor-pointer flex items-center gap-1 self-center bg-red-500/5 border border-red-500/10 px-2.5 py-1.5 rounded-xl transition-all font-bold"
              >
                <span>مسح الكل ({referencedImages.length})</span>
              </button>
            )}
          </div>
        )}

        {/* Multi-Prompt Activation and Styles selector */}
        <div className="px-6 md:px-8 pb-3 flex flex-wrap gap-4 items-center justify-between text-right">
          <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
            <button
              onClick={() => {
                setIsMultiPromptActive(!isMultiPromptActive);
                triggerToast(!isMultiPromptActive ? "تم تفعيل نمط 3 بدائل! جيميناي هيبدعلك في 3 خيارات متنوعة." : "تم العودة لنمط الملقن الفردي.");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isMultiPromptActive
                  ? 'bg-yellow-400 text-black shadow-md shadow-yellow-500/10'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>توليد 3 خيارات (بدائل إضافية)</span>
              {isMultiPromptActive && (
                <span className="bg-black/25 text-[#000] text-[9px] px-1.5 py-0.5 rounded-md font-mono">نشط</span>
              )}
            </button>

            {isMultiPromptActive && (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/10 animate-in fade-in duration-200">
                <button
                  onClick={() => {
                    setVariationType('different');
                    triggerToast("تم اختيار نمط: بدائل بستايلات مختلفة وإبداعية");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    variationType === 'different'
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  بدائل بستايلات مختلفة 🎨
                </button>
                <button
                  onClick={() => {
                    setVariationType('similar');
                    triggerToast("تم اختيار نمط: خيارات متشابهة مع فروقات بسيطة");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    variationType === 'similar'
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  خيارات متشابهة ⚖️
                </button>
              </div>
            )}
          </div>

          {isMultiPromptActive && (
            <p className="text-[11px] text-gray-500 max-w-sm leading-normal">
              في هذا النمط، يقوم جيميناي بتصميم <span className="text-yellow-400 font-bold">3 ملوّنات كاملة</span> دفعة واحدة لتتمكن من مقارنة واختيار الأنسب لفكّرة التصميم.
            </p>
          )}
        </div>

        {/* Bottom UI Chat-bar style input box */}
        <div className="p-6 md:p-8 pt-0">
          <div className="relative bg-white/5 border border-white/10 rounded-2xl flex items-end p-2.5 gap-3 focus-within:border-yellow-400/40 transition-all shadow-2xl">
            
            {/* Folder attachment control and input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileInputChange} 
              accept="image/*" 
              multiple
              className="hidden" 
            />
            <button 
              onClick={handleSelectFileClick}
              title="إرفاق صورة مرجعية للتحليل"
              className="p-3 text-gray-400 hover:text-yellow-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer self-center"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <textarea 
              ref={rawInputRef}
              rows={1}
              value={currentOriginal}
              onChange={(e) => setCurrentOriginal(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleOptimizePrompt();
                }
              }}
              placeholder="اكتب فكرتك هنا أو الصق الصورة المرجعية (Ctrl + V)..." 
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-600 font-medium py-2.5 scrollbar-thin resize-none"
              style={{ minHeight: "24px", maxHeight: "150px" }}
            />

            {/* Main Action Trigger key */}
            <button 
              onClick={() => handleOptimizePrompt()}
              disabled={isLoading || (!currentOriginal && referencedImages.length === 0)}
              className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-black px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-yellow-500/10 flex items-center gap-1.5 transition-all cursor-pointer transform active:scale-95 mb-0.5 shrink-0"
            >
              <Sparkles className="w-4 h-4 text-black animate-pulse" />
              <span>ظبّط البرومبت بالذكاء</span>
            </button>
          </div>
        </div>

      </main>

      {/* Machine Learning System Modal */}
      <MachineLearningModal
        isOpen={showMLModal}
        onClose={() => {
          setShowMLModal(false);
          setMlPrefillData(null);
        }}
        examples={learnedExamples}
        onAddExample={handleAddLearnedExample}
        onDeleteExample={handleDeleteLearnedExample}
        onToggleExample={handleToggleLearnedExample}
        onResetDefaults={handleResetLearnedExamples}
        onImportExamples={handleImportLearnedExamples}
        prefillData={mlPrefillData}
        activeSessionImages={referencedImages.map(img => img.base64)}
      />

      {/* Reference Image Preview Popup Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[85vh] flex flex-col items-center justify-center cursor-default bg-zinc-950/40 p-4 rounded-3xl border border-white/5 active:scale-100 transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button ('X') */}
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 left-2 bg-black/60 hover:bg-red-500 text-white p-2.5 rounded-full transition-all cursor-pointer border border-white/10 flex items-center justify-center shadow-lg"
              title="إغلاق المعاينة"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Main high resolution display */}
            <img 
              src={previewImageUrl} 
              alt="صورة مرجعية بكامل الدقة" 
              className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] border border-white/10 animate-in zoom-in-95 duration-300"
            />

            {/* Bottom Actions footer bar */}
            <div className="mt-5 bg-black/80 border border-white/10 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-4 text-xs font-semibold text-gray-300 shadow-xl">
              <span className="text-yellow-400">معاينة الصورة المرجعية</span>
              <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></span>
              <button 
                type="button"
                onClick={() => {
                  const match = previewImageUrl.match(/^data:(image\/\w+);base64,/);
                  const ext = match ? match[1].split('/')[1] : 'png';
                  const a = document.createElement("a");
                  a.href = previewImageUrl;
                  a.download = `reference_master_image.${ext}`;
                  a.click();
                }}
                className="text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1.5 cursor-pointer hover:underline"
              >
                <Download className="w-4 h-4" />
                <span>حفظ الملف الأصلي للكمبيوتر</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Splash spinner helper when rendering simulation designs
function SplashLoadingAnimation() {
  return (
    <div className="flex space-x-2 justify-center items-center">
      <span className="sr-only">Loading...</span>
      <div className="h-4 w-4 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="h-4 w-4 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="h-4 w-4 bg-yellow-400 rounded-full animate-bounce"></div>
    </div>
  );
}
