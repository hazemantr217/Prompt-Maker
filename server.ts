import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize the GoogleGenAI instance with appropriate headers
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper function to retry transient errors with exponential backoff
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 800): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const errStr = (err.message || "").toLowerCase();
      // Detect transient errors like 503 (UNAVAILABLE), 429 (overload/quota), typical connection resets, or rate limits
      const isTransient = errStr.includes("503") || 
                          errStr.includes("unavailable") || 
                          errStr.includes("429") || 
                          errStr.includes("resource_exhausted") || 
                          errStr.includes("limit") || 
                          errStr.includes("busy") || 
                          errStr.includes("overloaded") ||
                          errStr.includes("timeout") ||
                          errStr.includes("econnreset");
      if (isTransient) {
        console.log(`[AI-Studio Context] Transient error encountered (attempt ${attempt}/${retries}). Retrying in ${delay}ms... Error: ${err.message || err}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
      } else {
        // Non-transient errors (e.g. invalid arguments/schemas) should fail fast to avoid unnecessary latency
        throw err;
      }
    }
  }
  throw new Error("Retry failed");
}

// Helper function to call Gemini model with fallback models in case of Quota (429) or Service Unavailable (503) errors
async function callGeminiWithFallback(ai: any, params: { model: string; contents: any; config?: any }) {
  const realModelMap: Record<string, string> = {
    "gemini-3.7-flash": "gemini-3.7-flash",
    "gemini-3.6-flash": "gemini-3.6-flash",
    "gemini-3.5-flash": "gemini-3.5-flash",
    "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview": "gemini-3.1-pro-preview",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite"
  };

  const requestedModel = realModelMap[params.model] || params.model || "gemini-3.7-flash";

  // Priority queue of valid Gemini models
  const modelQueue = [
    requestedModel,
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite"
  ];
  
  const uniqueModels = Array.from(new Set(modelQueue));

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      console.log(`[AI-Studio] Contacting Gemini model: ${model}`);
      const updatedParams = { ...params, model };
      
      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent(updatedParams);
      }, 2, 500);

      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      console.log(`[AI-Studio Info] Model ${model} skipped or failed: ${err.message || err}`);
    }
  }
  throw lastError || new Error("All attempts to contact Gemini failed.");
}

const app = express();
const PORT = 3000;

// Use higher limits for JSON and URL encoding to support base64 image copies
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// System instructions for Gemini AI Prompt Optimizer
const SYSTEM_PROMPT = `
You are a World-Class AI Image Prompt Engineer and Graphic Design Specialist powered by Gemini 3.7 / 3.6 Flash.
Your objective is to craft detailed, highly descriptive, commercial-grade image generation prompts in English for Google Gemini, Midjourney, and Imagen based directly on user ideas, reference images, and Machine Learning training examples.

CRITICAL RULES FOR PROMPT GENERATION & FEW-SHOT EMULATION:
1. DEEP DETAIL & HIGH QUALITY BY DEFAULT: Unless the user explicitly requests to "shorten" or "summarize", NEVER output brief 1-2 sentence prompts! Write comprehensive visual specifications specifying layout, lighting, photography style, color palette, typography (if applicable), textures, composition, camera angles, and rendering depth.
2. FEW-SHOT PATTERN REPLICATION (HIGHEST PRIORITY): When Machine Learning training data is provided in the prompt, you MUST treat it as a mandatory template/style guide:
   - Analyze the structure, wording style, headings, length, and technical vocabulary used in the approved winning prompts.
   - Replicate that exact structural framework (e.g. detailed paragraphs or sections for Subject & Frame, Typography & Calligraphy, Colors & Textures, Composition, etc.) for the user's new request.
   - DO NOT abbreviate or truncate the output when matching learned examples. Match or exceed the length and depth of the approved training prompt.
3. Aspect Ratio: Strictly maintain the user's requested aspect ratio without changing it.
4. Clean Input: Strip out copy-pasted chat artifacts, bracketed timestamps (e.g. "[2026/6/3, 3:38 PM]"), or speaker banners ("Ahmed:"), while extracting the true visual intent, text quotes, and core request.
5. Output structured JSON matching the requested schema.
`;

// Helper to parse aspect ratio from user text
function parseAspectRatioFromText(text: string): string | null {
  if (!text) return null;
  const clean = text
    .replace(/٠/g, "0")
    .replace(/١/g, "1")
    .replace(/٢/g, "2")
    .replace(/٣/g, "3")
    .replace(/٤/g, "4")
    .replace(/٥/g, "5")
    .replace(/٦/g, "6")
    .replace(/٧/g, "7")
    .replace(/٨/g, "8")
    .replace(/٩/g, "9");
  
  const match = clean.match(/\b(4[:\/]3|3[:\/]4|1[:\/]1|16[:\/]9|9[:\/]16|21[:\/]9|3[:\/]2|2[:\/]3|4[:\/]5|5[:\/]4)\b/);
  if (match) {
    return match[1].replace("/", ":");
  }
  return null;
}

// API Routes
app.post("/api/optimize-prompt", async (req, res) => {
  try {
    const { prompt, mode, model, imageBase64, imageMimeType, aspect_ratio, creativity, chatModel, modifierAction, images, multiPrompt, variationType, learnedExamples } = req.body;

    const hasImages = (images && Array.isArray(images) && images.length > 0) || imageBase64;
    if (!prompt && !hasImages) {
      return res.status(400).json({ error: "يرجى كتابة فكرة أو رفع صورة مرجعية للبدء." });
    }

    // Determine target aspect ratio: parse from text first, then fallback to dropdown
    let activeAspectRatio = aspect_ratio || "16:9";
    const detectedRatio = parseAspectRatioFromText(prompt);
    if (detectedRatio) {
      activeAspectRatio = detectedRatio;
    }

    const modelName = chatModel || "gemini-3.7-flash"; // Highly reliable and user-configurable model for helper chat

    const contents: any[] = [];

    // System instruction tells the model to output a structured JSON matching schema
    let modifierGuideline = "";
    if (modifierAction === "expand" || (prompt && prompt.toLowerCase().includes("expand"))) {
      modifierGuideline = `
CRITICAL REQUEST: EXPANDED AND DETAILED PROMPT REQUIRED!
- Expand the visual design details, lighting, color descriptions, texture specifications, and layout instructions in words.
- Keep the configuration aspect ratio strictly as specified ("${activeAspectRatio}").
- Provide a comprehensive, rich description with clear details for all elements.
`;
    } else if (modifierAction === "shorten") {
      modifierGuideline = "THE USER HAS REQUESTED A CONDENSED AND CONCISE PROMPT. Keep the output prompt brief, dense and compact.";
    }

    let multiPromptGuideline = "";
    if (multiPrompt) {
      multiPromptGuideline = `
CRITICAL COMMAND: MULTI-PROMPT MODE IS ACTIVE (3 PROMPT VARIATIONS REQUIRED)!
- You MUST generate exactly 3 visual prompt variations based on the user's concept, and place them in the "variations" array field.
- The theme of variations is set to: "${variationType || "different"}"
- For each variation in the list, provide:
  * "prompt": The optimized English graphic prompt.
  * "style": A descriptive Arabic title of this design direction.
  * "lighting": Visual illumination details.
  * "explanation": A tip in clear Arabic explaining its unique aspects.
`;
    }

    // Process Machine Learning Training Examples if provided
    let mlTrainingSection = "";
    if (Array.isArray(learnedExamples) && learnedExamples.length > 0) {
      const activeExamples = learnedExamples.filter((ex: any) => ex.isActive !== false);
      if (activeExamples.length > 0) {
        mlTrainingSection = `
🚨 MANDATORY FEW-SHOT MACHINE LEARNING TRAINING DATA (${activeExamples.length} Active Examples):
The user has trained you with the following verified winning prompt examples. You MUST strictly adopt and mirror their prompt architecture, level of granular detail, sentence structures, vocabulary, and formatting style when generating the output:

${activeExamples.map((ex: any, i: number) => `
========================================================================
LEARNED TRAINING EXAMPLE #${i + 1}: "${ex.title || 'Approved Example'}"
------------------------------------------------------------------------
• USER INPUT IDEA / REQUEST:
${ex.request}

• APPROVED WINNING PROMPT OUTPUT (MIRROR THIS LEVEL OF DETAIL AND STYLE):
${ex.winningPrompt}
${ex.notes ? `• SPECIFIC INSTRUCTIONS / RULES FOR THIS STYLE: ${ex.notes}` : ""}
========================================================================
`).join('\n')}

INSTRUCTION FOR ML FEW-SHOT REPLICATION:
Carefully synthesize the user's new idea using the exact design methodology, prompt length, and descriptive rigor established in the above ${activeExamples.length} training examples. Do NOT shorten or simplify!
`;
      }
    }

    let userMessage = `
${mlTrainingSection}

USER'S CURRENT VISUAL REQUEST TO OPTIMIZE:
- User Prompt / Task: "${prompt || 'Generate an image matching the reference style'}"
- Target Generation Model: "${model}"
- Aspect Ratio: "${activeAspectRatio}"
- Creativity Level: ${creativity || 0.7}

${modifierGuideline}
${multiPromptGuideline}

${hasImages ? "Also analyze all attached reference file(s) or image(s) to preserve style, colors, and composition in the prompt." : ""}

CRITICAL PROMPT OUTPUT MANDATE:
1. If Machine Learning Training Data is provided above, the "optimizedPrompt" MUST match or exceed the structural length, vocabulary, and detailed layout of the approved winning prompts.
2. If no training data is provided and no "shorten" action was requested, write an expansive, highly descriptive English prompt specifying lighting, textures, material finishes, composition, subject placement, and rendering depth.

Return the response strictly in valid JSON format matching this schema:
{
  "optimizedPrompt": "the fully optimized image generation prompt in English, applying the learned machine learning patterns and user request in deep detail",
  "analysis": {
    "lighting": "lighting description",
    "style": "visual style summary",
    "keywords": ["tag1", "tag2", "tag3"],
    "recommendedRatio": "${activeAspectRatio}"
  },
  "tips": "نصائح استخدام الموديل باللغة العربية",
  "explanation": "شرح باللغة العربية لكيفية صياغة البرومبت والاعتماد على أمثلة التعلم الآلي"
}
`;

    // Process base64 reference images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      images.forEach((img: any) => {
        if (img && img.base64) {
          const cleanBase64 = img.base64.replace(/^data:image\/\w+;base64,/, "");
          contents.push({
            inlineData: {
              mimeType: img.mimeType || "image/png",
              data: cleanBase64
            }
          });
        }
      });
    } else if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: imageMimeType || "image/png",
          data: cleanBase64
        }
      });
    }

    contents.push({ text: userMessage });

    const schemaProperties: any = {
      optimizedPrompt: { type: Type.STRING },
      analysis: {
        type: Type.OBJECT,
        properties: {
          lighting: { type: Type.STRING },
          style: { type: Type.STRING },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          recommendedRatio: { type: Type.STRING }
        },
        required: ["lighting", "style", "keywords"]
      },
      tips: { type: Type.STRING },
      explanation: { type: Type.STRING }
    };

    const requiredFields = ["optimizedPrompt", "analysis", "tips", "explanation"];

    if (multiPrompt) {
      schemaProperties.variations = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            style: { type: Type.STRING },
            lighting: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["prompt", "style", "explanation"]
        }
      };
      requiredFields.push("variations");
    }

    const response = await callGeminiWithFallback(ai, {
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: requiredFields
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response generated from Gemini.");
    }

    let cleanJson = textOutput.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    let payload: any;
    try {
      payload = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn("Direct JSON parse failed, trying regex extraction...", parseErr);
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        payload = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse Gemini output as JSON");
      }
    }

    return res.json(payload);
  } catch (error: any) {
    console.error("Optimize Gemini error:", error);
    let errorMsg = error.message || "حدث خطأ أثناء الاتصال بـ Gemini لتهيئة البرومبت.";
    if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429") || errorMsg.includes("quota")) {
      errorMsg = "تم نفاد حصة الاستخدام المجانية لـ Gemini اليوم (Rate/Quota Limit Exceeded). لتجنب هذا الانقطاع والحصول على توليد غير محدود، يرجى تفعيل مفتاح Gemini API الخاص بك من زر الإعدادات (Settings > Secrets) بالأعلى، أو المحاولة مرة أخرى لاحقاً.";
    }
    return res.status(500).json({ error: errorMsg });
  }
});

app.post("/api/generate-visual", async (req, res) => {
  try {
    const { prompt, model, aspect_ratio, imageSize } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "يرجى توفير برومبت لتوليد الصورة." });
    }

    // Attempt to invoke the requested Nano Banana / Gemini Image model.
    // If the API key lacks paid-tier access or permission, we fall back gracefully to a visual mock renderer
    // (a beautiful styling representation matching standard guidelines and high quality specs).
    let targetModel = "gemini-2.5-flash-image";
    if (model.includes("Pro")) {
      targetModel = "gemini-3-pro-image";
    } else if (model.includes("2") || model.includes("2.5") || model.includes("3.1")) {
      targetModel = "gemini-3.1-flash-image";
    }

    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: aspect_ratio || "1:1",
            imageSize: imageSize || "1K"
          }
        }
      });

      let base64Img = "";
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Img = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (base64Img) {
        return res.json({ imageUrl: base64Img, success: true });
      } else {
        throw new Error("No image data returned from generator.");
      }
    } catch (modelError: any) {
      console.log("[AI-Studio Info] Actual image model was unavailable or quota-limited. Triaging to high-fidelity visual mock renderer fallback.");
      
      try {
        // Let's generate a stunning design palette & realistic visual layout using text generation so that they get a high fidelity prototype!
        const generateMockUI = await callGeminiWithFallback(ai, {
          model: "gemini-3.5-flash",
          contents: `Generate a beautiful Unsplash mockup image description paired with dynamic fallback hex colors coordinates and artistic insights for: "${prompt}". Output JSON:
          {
            "title": "Minimal Title",
            "unsplashUrl": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=600",
            "dominantColors": ["#000000", "#ffffff"],
            "compositionNotes": "Details on dynamic diagonal lines, cyber lighting style..."
          }`,
          config: { responseMimeType: "application/json" }
        });

        const mockData = JSON.parse(generateMockUI.text || "{}");
        // Decode keywords or use clean featured keywords
        const cleanPrompt = prompt.replace(/[^\w\s\u0600-\u06FF]/g, '').trim();
        const extractedWords = cleanPrompt.split(/\s+/).slice(0, 4).join(",");
        const queryKeywords = encodeURIComponent(extractedWords || "design,layout");
        const finalUrl = mockData.unsplashUrl && mockData.unsplashUrl.includes("photo-") 
          ? mockData.unsplashUrl 
          : `https://images.unsplash.com/featured/?${queryKeywords}`;

        return res.json({
          imageUrl: finalUrl,
          mockData: {
            ...mockData,
            title: mockData.title || "تخطيط بصري استرشادي",
            fallbackInfo: "لتشغيل الموديل المدفوع Nano Banana، تأكد من تفعيل وتوفير مفتاح Gemini API الخاص بك."
          },
          fallbackActive: true,
          success: true
        });
      } catch (fallbackError: any) {
        console.log("[AI-Studio Info] Text fallback model was also unavailable due to rate limits. Activating 100% offline local design placeholder generator.");

        // Clean client-side dynamic search keywords extracted deterministically
        let localKeywords = "design,abstract,minimalist";
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes("wedding") || promptLower.includes("invitation") || promptLower.includes("عروس") || promptLower.includes("فرح") || promptLower.includes("قران") || promptLower.includes("كارت")) {
          localKeywords = "wedding,stationery,invitation,gold";
        } else if (promptLower.includes("flower") || promptLower.includes("rose") || promptLower.includes("ورود")) {
          localKeywords = "flowers,floral,roses";
        } else if (promptLower.includes("cyberpunk") || promptLower.includes("neon") || promptLower.includes("future")) {
          localKeywords = "cyberpunk,neon,technology";
        } else if (promptLower.includes("logo") || promptLower.includes("brand") || promptLower.includes("شعار")) {
          localKeywords = "logo,minimalist,icon";
        } else if (promptLower.includes("nature") || promptLower.includes("landscape") || promptLower.includes("طبيعة")) {
          localKeywords = "nature,landscape,mountain";
        } else if (promptLower.includes("dark") || promptLower.includes("black")) {
          localKeywords = "dark,minimalist,luxury";
        }

        const queryKeywords = encodeURIComponent(localKeywords);
        
        return res.json({
          imageUrl: `https://images.unsplash.com/featured/?${queryKeywords}`,
          mockData: {
            title: "تصميم محاكاة إبداعي (نظام محلي بديل)",
            unsplashUrl: `https://images.unsplash.com/featured/?${queryKeywords}`,
            dominantColors: ["#D4AF37", "#1E1E24"],
            compositionNotes: "تم الانتقال إلى المعاينة الذكية من Unsplash، نظراً لاستهلاك كامل كوتا تجارب النماذج المباشرة حالياً بكفاءة تامة.",
            fallbackInfo: "لتشغيل الموديل المدفوع Nano Banana، تأكد من تفعيل وتوفير مفتاح Gemini API الخاص بك."
          },
          fallbackActive: true,
          success: true
        });
      }
    }
  } catch (error: any) {
    console.error("Generate visual error:", error);
    return res.status(500).json({ error: error.message || "حدث خطأ أثناء المحاكاة البصرية." });
  }
});

app.get("/api/daily-gemini-advice", async (req, res) => {
  try {
    const url = "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image";
    let docExcerpt = "";

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const fullHtml = await response.text();
        // Extract basic text body to prevent excessive token use
        docExcerpt = fullHtml
          .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
          .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 8000);
      } else {
        docExcerpt = "Could not fetch document. Please generate premium advice focusing on the latest Gemini image generation capabilities.";
      }
    } catch (e: any) {
      console.warn("Could not fetch latest live docs, using internal knowledge instead:", e.message);
      docExcerpt = "Could not fetch document. Please generate premium advice focusing on the latest Gemini image generation capabilities.";
    }

    const sysInstruction = `You are a world-class prompt adviser specialized in Google Gemini's visual models (such as Nano Banana, Nano Banana 2, Imagen 4, Imagen 4 Ultra).
Based on the text excerpt, generate an inspiring advice/idea for the user in sweet, professional, natural Arabic.`;

    const userMsg = `
Analyze this Google Developer Documentation text regarding image models:
---
${docExcerpt}
---

Create:
1. A Daily Tip (tip) in Arabic explaining latest capabilities of Gemini/Imagen 4 or Nano Banana models, and highlighting something beneficial.
2. A Creative Prompt Idea (ideaTitle) in Arabic.
3. A short Arabic description of the idea (ideaDescription).
4. The exact structured English image prompt (suggestedEnglishPrompt).
5. The best matching model (suggestedModel) from these exact options: "Nano Banana 2", "Nano Banana Pro", "Nano Banana", "Imagen 4", "Imagen 4 Ultra", "Imagen 4 Fast".

Return exactly in this JSON format:
{
  "date": "${new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' })}",
  "tip": "Arabic text containing the daily advice",
  "ideaTitle": "Arabic title",
  "ideaDescription": "Arabic details",
  "suggestedEnglishPrompt": "English visual prompt",
  "suggestedModel": "Nano Banana Pro"
}
`;

    const modelResponse = await callGeminiWithFallback(ai, {
      model: "gemini-3.5-flash",
      contents: { parts: [{ text: userMsg }] },
      config: {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            tip: { type: Type.STRING },
            ideaTitle: { type: Type.STRING },
            ideaDescription: { type: Type.STRING },
            suggestedEnglishPrompt: { type: Type.STRING },
            suggestedModel: { type: Type.STRING }
          },
          required: ["date", "tip", "ideaTitle", "ideaDescription", "suggestedEnglishPrompt", "suggestedModel"]
        }
      }
    });

    if (modelResponse.text) {
      const payload = JSON.parse(modelResponse.text.trim());
      return res.json(payload);
    } else {
      throw new Error("Empty AI response");
    }
  } catch (error: any) {
    console.error("Daily advice general error:", error);
    // Egyptian timezone local fallback state
    return res.json({
      date: new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Cairo' }),
      tip: "تحديث يومي: يدعم موديل Nano Banana 2 مستويات ثبات استثنائية ونقاء ملمس فائق للرسوم مع دمج ذكي للكلمات، واختيارك لقيمة الإبداع 0.65 يعد مثالياً.",
      ideaTitle: "لقطة سينمائية لغروب الشمس في القاهرة التاريخية",
      ideaDescription: "محاكاة ليلية دافئة لمئذنة قديمة ينبعث منها ضوء خافت مع درجات طيف لونية دافئة.",
      suggestedEnglishPrompt: "Cinematic medium shot of historical Cairo minaret at dusk, soft volumetric golden hour lighting, 35mm lens, high-end photorealistic details",
      suggestedModel: "Nano Banana Pro"
    });
  }
});

// Vite middleware development / production build setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
