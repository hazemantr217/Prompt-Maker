import React, { useState, useEffect, useRef } from "react";
import { ModelId, CreativeMode, SavedPrompt, MODEL_PRESETS, ChatModelId, INSTANT_TIPS, LearnedExample } from "./types";
import { DEFAULT_LEARNED_EXAMPLES } from "./data/defaultExamples";
import { MachineLearningModal } from "./components/MachineLearningModal";
import Sidebar from "./components/Sidebar";
import { 
  Sparkles, 
  Copy, 
  RotateCcw, 
  Image as ImageIcon, 
  Compass, 
  Lock, 
  Send, 
  RefreshCw, 
  Check, 
  Sliders, 
  Flame, 
  Zap, 
  HelpCircle, 
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
  Save
} from "lucide-react";

interface DailyAdvice {
  date: string;
  tip: string;
  ideaTitle: string;
  ideaDescription: string;
  suggestedEnglishPrompt: string;
  suggestedModel: string;
}

export default function App() {
  // State Initialization from LocalStorage safely
  const [history, setHistory] = useState<SavedPrompt[]>(() => {
    try {
      const saved = localStorage.getItem("gipm_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse history from localStorage. Clearing the key to heal the browser state.", e);
      try {
        localStorage.removeItem("gipm_history");
      } catch (err) {}
    }
    return [];
  });
  
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  
  // Workspace Parameters
  const [currentOriginal, setCurrentOriginal] = useState("");
  const [currentOptimized, setCurrentOptimized] = useState("");
  const [currentModel, setCurrentModel] = useState<ModelId>("Nano Banana 2");
  const [currentChatModel, setCurrentChatModel] = useState<ChatModelId>("Gemini 3.7 Flash");
  const [currentMode, setCurrentMode] = useState<CreativeMode>("Optimized");
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
  
  // UI Controls
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showChatModelPicker, setShowChatModelPicker] = useState(false);
  const [showAspectPicker, setShowAspectPicker] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const [mockDetails, setMockDetails] = useState<any>(null);
  const [isTempChat, setIsTempChat] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Multi-Prompt variations states
  interface PromptVariation {
    prompt: string;
    style: string;
    lighting: string;
    explanation: string;
  }
  const [isMultiPromptActive, setIsMultiPromptActive] = useState(false);
  const [variationType, setVariationType] = useState<'similar' | 'different'>('different');
  const [currentVariations, setCurrentVariations] = useState<PromptVariation[]>([]);
  const [expandingIndices, setExpandingIndices] = useState<number[]>([]);
  const [expandedHeights, setExpandedHeights] = useState<number[]>([]);

  // Machine Learning Few-Shot System state
  const [learnedExamples, setLearnedExamples] = useState<LearnedExample[]>(() => {
    try {
      const saved = localStorage.getItem("gemini_ml_examples");
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse ML examples from localStorage", e);
    }
    return DEFAULT_LEARNED_EXAMPLES;
  });

  const [showMLModal, setShowMLModal] = useState(false);
  const [mlPrefillData, setMlPrefillData] = useState<{ request?: string; winningPrompt?: string; title?: string } | null>(null);
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

  useEffect(() => {
    try {
      localStorage.setItem("gemini_ml_examples", JSON.stringify(learnedExamples));
    } catch (err) {
      console.warn("Failed to persist ML examples", err);
    }
  }, [learnedExamples]);

  const handleAddLearnedExample = (example: Omit<LearnedExample, 'id' | 'createdAt'>) => {
    const newEx: LearnedExample = {
      ...example,
      id: `ml-ex-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString()
    };
    setLearnedExamples(prev => [newEx, ...prev]);
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

  // Quota & Rate limits Status States
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [requestCount, setRequestCount] = useState<number>(() => {
    const todayStr = new Date().toISOString().split('T')[0]; // Reset exactly at UTC Midnight (3:00 AM Egypt)
    const storedDate = localStorage.getItem("gipm_usage_date");
    const storedCount = localStorage.getItem("gipm_usage_count");
    if (storedDate === todayStr && storedCount) {
      return parseInt(storedCount, 10);
    }
    return 0;
  });

  const incrementUsage = () => {
    const todayStr = new Date().toISOString().split('T')[0]; // Reset exactly at UTC Midnight (3:00 AM Egypt)
    const currentStoredCount = parseInt(localStorage.getItem("gipm_usage_count") || "0", 10);
    const nextCount = currentStoredCount + 1;
    setRequestCount(nextCount);
    localStorage.setItem("gipm_usage_count", nextCount.toString());
    localStorage.setItem("gipm_usage_date", todayStr);
  };
  
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      
      // Free tier resets at next midnight UTC (24:00 UTC)
      const nextMidnightUTC = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1, // Next day
        0, 0, 0, 0
      );
      
      const diff = nextMidnightUTC - now.getTime();
      
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Daily Advice fetch guided by Egypt timezone
  useEffect(() => {
    const fetchFreshAdvice = async () => {
      let egyptDate = "";
      try {
        egyptDate = new Date().toLocaleDateString("en-US", { timeZone: "Africa/Cairo" });
      } catch (timezoneErr) {
        egyptDate = new Date().toLocaleDateString("en-US"); // Safe fallback if browser lacks localized tables
      }
      
      const cachedDate = localStorage.getItem("gipm_advice_date_cairo");
      const cachedAdvice = localStorage.getItem("gipm_advice_content");

      if (cachedDate === egyptDate && cachedAdvice) {
        try {
          const parsed = JSON.parse(cachedAdvice);
          setDailyAdvice(parsed);
          return; // Uses cached advise, prevents multiple queries on same day!
        } catch (e) {
          console.warn("Cached daily advice corrupted, resetting to heal...", e);
          try {
            localStorage.removeItem("gipm_advice_content");
          } catch (err) {}
        }
      }

      setAdviceLoading(true);
      try {
        const res = await fetch("/api/daily-gemini-advice");
        if (res.ok) {
          const data = await res.json();
          setDailyAdvice(data);
          localStorage.setItem("gipm_advice_date_cairo", egyptDate);
          localStorage.setItem("gipm_advice_content", JSON.stringify(data));
        } else {
          throw new Error("API responded with an error");
        }
      } catch (err) {
        console.error("Failed to fetch daily advisor insights from Google developer logs:", err);
        // Fallback tip localized for Egypt time
        const fallback: DailyAdvice = {
          date: egyptDate,
          tip: "نصيحة اليوم: يدعم موديل Nano Banana ميزة الفهم الدقيق للتكوين والإضاءة ثلاثية الأبعاد بامتياز، مع الحفاظ على التناسق اللوني ونقاء المشهد.",
          ideaTitle: "لقطة سينمائية لغروب دافئ في الأهرامات الكلاسيكية",
          ideaDescription: "محاكاة خيالية مذهلة لتمثال أبو الهول وتحته غبار صحراوي ذهبي يطير تحت أشعة دافئة.",
          suggestedEnglishPrompt: "Cinematic shot of ancient Sphinx at sunset, glowing amber lights, realistic golden desert dust particle effects, 8k resolution, shot on 35mm lens",
          suggestedModel: "Nano Banana Pro"
        };
        setDailyAdvice(fallback);
        localStorage.setItem("gipm_advice_date_cairo", egyptDate);
        localStorage.setItem("gipm_advice_content", JSON.stringify(fallback));
      } finally {
        setAdviceLoading(false);
      }
    };

    fetchFreshAdvice();
  }, []);

  const chatModelMap: Record<ChatModelId, string> = {
    'Gemini 3.7 Flash': 'gemini-3.7-flash',
    'Gemini 3.6 Flash': 'gemini-3.6-flash',
    'Gemini 3.5 Flash': 'gemini-3.5-flash',
    'Gemini 3.1 Flash Lite': 'gemini-3.1-flash-lite',
    'Gemini 3.1 Pro Preview': 'gemini-3.1-pro-preview',
    'Gemini 2.5 Pro': 'gemini-2.5-pro',
    'Gemini 2.5 Flash': 'gemini-2.5-flash',
    'Gemini 2.5 Flash-Lite': 'gemini-2.5-flash-lite'
  };

  // Auto-save active sessions to localStorage on changes safely, optimizing storage size
  useEffect(() => {
    try {
      // Create a copy of history with trimmed older base64 images to prevent localStorage quota overflows (max 4.5MB limit)
      const optimizedHistory = history.map((item, idx) => {
        // Keep actual base64 reference only for the first 3 active items, strip from older to keep JSON light
        if (idx > 2 && (item.referenceImage || (item.referenceImages && item.referenceImages.length > 0))) {
          return {
            ...item,
            referenceImage: undefined,
            referenceImages: []
          };
        }
        return item;
      });
      localStorage.setItem("gipm_history", JSON.stringify(optimizedHistory));
    } catch (err) {
      console.warn("localStorage quota hit, saving minimal prompt history representation...", err);
      // Fallback: strip ALL images if we still fail
      try {
        const minimalHistory = history.map(item => ({
          ...item,
          referenceImage: undefined,
          referenceImages: []
        }));
        localStorage.setItem("gipm_history", JSON.stringify(minimalHistory));
      } catch (innerErr) {
        console.error("Even minimal history save failed:", innerErr);
      }
    }
  }, [history]);

  // Adjust optimal configurations on model changes
  useEffect(() => {
    const preset = MODEL_PRESETS[currentModel];
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
    setCopyToast(msg);
    setTimeout(() => {
      setCopyToast(null);
    }, 2500);
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
    setMockDetails(null);
    const preset = MODEL_PRESETS[currentModel];
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
      setCurrentMode(item.mode);
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

  // Compress and resize image client-side to prevent network bottlenecks and Gemini API timeouts
  const compressAndResizeImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width > height) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            } else {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
            resolve({ base64: compressedDataUrl, mimeType: "image/jpeg" });
            return;
          }
          resolve({ base64: e.target?.result as string, mimeType: file.type });
        };
        img.onerror = () => {
          resolve({ base64: e.target?.result as string, mimeType: file.type });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve({ base64: "", mimeType: file.type });
      };
      reader.readAsDataURL(file);
    });
  };

  // Convert File object to Base64 String - Support multiple files addition
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerToast("خطأ: يرجى رفع ملف صورة فقط.");
      return;
    }
    try {
      const { base64, mimeType } = await compressAndResizeImage(file);
      if (!base64) return;
      const imgId = Math.random().toString(36).substring(7);
      setReferencedImages(prev => [
        ...prev,
        { base64, mimeType, id: imgId }
      ]);
      triggerToast("تم إضافة الصورة المرجعية بنجاح!");
    } catch (err) {
      console.error("Failed to process image file", err);
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

    setIsLoading(true);
    setMockDetails(null);

    // Let prompt instructions adjust if expanding/shortening
    let requestedPrompt = currentOriginal;
    if (modifierAction === 'shorten') {
      requestedPrompt = `Shorten and make this prompt extremely dense and precise for generation: ${currentOriginal}`;
    } else if (modifierAction === 'expand') {
      requestedPrompt = `Expand this prompt with rich scene assets, high contrast volumetric illumination details, and complex depth configurations: ${currentOriginal}`;
    }

    try {
      const res = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: requestedPrompt,
          mode: currentMode,
          model: currentModel,
          images: referencedImages.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
          imageBase64: referencedImages[0]?.base64 || null,
          imageMimeType: referencedImages[0]?.mimeType || null,
          aspect_ratio: currentAspectRatio,
          creativity: currentCreativity,
          chatModel: chatModelMap[currentChatModel],
          modifierAction: modifierAction,
          multiPrompt: isMultiPromptActive,
          variationType: variationType,
          learnedExamples: learnedExamples.filter(ex => ex.isActive)
        })
      });

      if (!res.ok) {
        const errObj = await res.json();
        throw new Error(errObj.error || "Failed prompt optimization");
      }

      const data = await res.json();
      setCurrentOptimized(data.optimizedPrompt);
      
      if (data.variations && data.variations.length > 0) {
        setCurrentVariations(data.variations);
      } else {
        setCurrentVariations([]);
      }

      incrementUsage();
      
      // Update or create active item session
      const updatedPrompt: SavedPrompt = {
        id: activePromptId || Math.random().toString(36).substring(7),
        original: currentOriginal,
        optimized: data.optimizedPrompt,
        model: currentModel,
        chatModel: currentChatModel,
        mode: currentMode as any,
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
    } catch (err: any) {
      console.error(err);
      triggerToast(`عطل: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Individual expansion handler for a single prompt variation under the 3 prompts layout
  const handleExpandSingleVariation = async (index: number, silentToast = false) => {
    if (expandingIndices.includes(index)) return;
    const targetVariant = currentVariations[index];
    if (!targetVariant) return;

    setExpandingIndices(prev => [...prev, index]);
    try {
      const res = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: targetVariant.prompt,
          mode: currentMode,
          model: currentModel,
          aspect_ratio: currentAspectRatio,
          creativity: currentCreativity,
          chatModel: chatModelMap[currentChatModel],
          modifierAction: 'expand',
          multiPrompt: false
        })
      });

      if (!res.ok) {
        throw new Error("حدث خطأ في الاتصال بالخادم.");
      }

      const data = await res.json();
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
    } catch (err: any) {
      console.error(err);
      triggerToast(`فشل توسيع الخيار ${index + 1}: ${err.message}`);
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

    setImageLoading(true);
    setMockDetails(null);

    try {
      const res = await fetch("/api/generate-visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: testPrompt,
          model: currentModel,
          aspect_ratio: currentAspectRatio,
          imageSize: "1K"
        })
      });

      if (!res.ok) {
        throw new Error("خطأ في الاتصال بالرسام الافتراضي.");
      }

      const data = await res.json();
      if (data.success) {
        setGeneratedImageUrl(data.imageUrl);
        incrementUsage();
        if (data.mockData) {
          setMockDetails(data.mockData);
        }

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
    } catch (err: any) {
      console.error(err);
      triggerToast("فشل توليد التكوين البصري: " + err.message);
    } finally {
      setImageLoading(false);
    }
  };

  // Tick tips forward
  const handleNextTip = () => {
    setActiveTipIndex(prev => prev + 1);
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

  // Preset aspect ratio lists based on Nano Banana 2 specifications
  const getAspectRatios = () => {
    if (currentModel === 'Nano Banana 2' || currentModel === 'Gemini 3.1 Flash') {
      return ["1:1", "3:4", "4:3", "16:9", "9:16", "21:9", "4:1", "8:1"];
    }
    return ["1:1", "3:4", "4:3", "16:9", "9:16"];
  };

  const activePromptData = activePromptId ? history.find(p => p.id === activePromptId) || null : null;

  return (
    <div dir="rtl" className="h-screen w-full bg-[#050505] text-[#e5e7eb] font-sans flex overflow-hidden relative selection:bg-yellow-400 selection:text-black">
      
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
                  setShowModelPicker(false);
                  setShowAspectPicker(false);
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
                  {([
                    'Gemini 3.7 Flash',
                    'Gemini 3.6 Flash',
                    'Gemini 3.5 Flash',
                    'Gemini 3.1 Flash Lite',
                    'Gemini 3.1 Pro Preview',
                    'Gemini 2.5 Pro',
                    'Gemini 2.5 Flash',
                    'Gemini 2.5 Flash-Lite'
                  ] as ChatModelId[]).map((key) => {
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
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>

            {/* Machine Learning Few-Shot Learning Hub button */}
            <div>
              <span className="text-[9px] text-purple-400/80 font-bold uppercase tracking-wider block mb-0.5">نظام التعلم الآلي والتدريب بالأمثلة</span>
              <button 
                onClick={() => setShowMLModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl text-xs text-purple-300 font-bold transition-all cursor-pointer shadow-sm hover:shadow-purple-500/10"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                <span>نظام التعلم الآلي ({learnedExamples.filter(e => e.isActive).length} أمثلة مفعلة)</span>
              </button>
            </div>

          </div>

          <div className="flex items-center gap-3 shrink-0 hidden lg:flex">
            {isTempChat && (
              <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-400/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
                <span>⏱️ شات مؤقت</span>
              </span>
            )}
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: "10s" }} />
              <span>استهلاكك اليوم: {requestCount}/20 • تجديد الحصة خلال: {timeLeft.hours.toString().padStart(2, '0')}س {timeLeft.minutes.toString().padStart(2, '0')}د</span>
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
                        <span>معالج بنظام التعلم الآلي ({learnedExamples.filter(e => e.isActive).length} أمثلة)</span>
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
                            const correctModel: ModelId = dailyAdvice.suggestedModel as any;
                            if (MODEL_PRESETS[correctModel]) {
                               setCurrentModel(correctModel);
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

                  {/* Section 3: Quota & 429 Rate Limits Info */}
                  <div className="bg-gradient-to-br from-indigo-500/[0.02] to-emerald-500/[0.02] border border-white/10 p-5 rounded-xl flex flex-col justify-between space-y-4 text-right shadow-xl">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          مراقبة حية للحصة
                        </span>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs font-bold text-[#e5e7eb]">حالة باقة الاستخدام المجانية</span>
                          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-emerald-400 font-bold">{requestCount} / 20</span>
                          <span className="text-gray-300 font-medium">الاستهلاك اليومي الحالي:</span>
                        </div>
                        
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full duration-500 transition-all ${
                              requestCount >= 17 ? 'bg-red-500' : requestCount >= 10 ? 'bg-yellow-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (requestCount / 20) * 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[11px] pt-1 text-gray-400">
                          <span className="text-yellow-400 font-bold">{Math.max(0, 20 - requestCount)} طلب</span>
                          <span>الطلبات المتبقية اليوم:</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[10px] text-gray-400 mt-2 font-mono">
                        <div className="flex justify-between items-center bg-white/[0.01] px-2.5 py-1.5 rounded">
                          <span className="text-yellow-400 font-bold">20 طلب يومياً (مشترك للبروجيكت)</span>
                          <span>سعة الباقة الكاملة:</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/[0.01] px-2.5 py-1.5 rounded">
                          <span className="text-amber-400 font-bold">الساعة 3:00 فجراً بتوقيت مصر</span>
                          <span>موعد تجديد الباقة القادم:</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/[0.01] px-2.5 py-1.5 rounded">
                          <span className="text-indigo-300">يومياً 24:00 بالتوقيت العالمي UTC</span>
                          <span>دورة تصفير العداد:</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] text-gray-400 block mb-1">الوقت المتبقي بدقة لتصفير الباقة وتجديدها:</span>
                        <div className="flex items-center justify-center gap-2 bg-black/50 border border-white/10 px-3 py-2 rounded-xl text-center font-mono shadow-inner">
                          <div className="text-yellow-400 text-sm font-bold flex items-center gap-1.5" dir="ltr">
                            <span className="text-amber-400 font-bold">{timeLeft.hours.toString().padStart(2, '0')}</span>
                            <span className="text-gray-500 text-[10px]">H</span>
                            <span className="text-gray-600 font-medium">:</span>
                            <span className="text-amber-400 font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                            <span className="text-gray-500 text-[10px]">M</span>
                            <span className="text-gray-600 font-medium">:</span>
                            <span className="text-amber-400 font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                            <span className="text-gray-500 text-[10px]">S</span>
                          </div>
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-yellow-300/90 bg-yellow-400/5 p-2 rounded-lg border border-yellow-400/10 leading-relaxed font-semibold">
                      💡 لتجنب الوقف عند الـ 429 وتفعيل التوليد اللانهائي؛ فعّل مفتاحك الخاص ⚙️ بالأعلى.
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
