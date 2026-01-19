
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import jsPDF from 'jspdf';
import { MAX_STORY_PAGES, BACK_COVER_PAGE, TOTAL_PAGES, INITIAL_PAGES, BATCH_SIZE, DECISION_PAGES, GENRES, TONES, LANGUAGES, ComicFace, Beat, Persona, ApiStatus } from './types';
import { Setup } from './Setup';
import { Book } from './Book';
import { useApiKey } from './useApiKey';
import { ApiKeyDialog } from './ApiKeyDialog';

// --- Constants ---
const MODEL_V3 = "gemini-3-pro-image-preview";
const MODEL_CHECK = "gemini-3-flash-preview";
const MODEL_IMAGE_GEN_NAME = MODEL_V3;
const MODEL_TEXT_NAME = MODEL_V3;
const API_TIMEOUT_MS = 90000; // 90s timeout for image generation

// Relaxed safety settings to prevent over-triggering on comic book violence/action
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const App: React.FC = () => {
  // --- API Key Hook ---
  const { validateApiKey, setShowApiKeyDialog, showApiKeyDialog, handleApiKeyDialogContinue } = useApiKey();

  const [hero, setHeroState] = useState<Persona | null>(null);
  const [friend, setFriendState] = useState<Persona | null>(null);
  const [selectedGenre, setSelectedGenreState] = useState(GENRES[0]);
  const [selectedLanguage, setSelectedLanguageState] = useState(LANGUAGES[0].code);
  const [customPremise, setCustomPremiseState] = useState("");
  const [storyTone, setStoryToneState] = useState(TONES[0]);
  const [richMode, setRichModeState] = useState(true);
  const [refStrength, setRefStrengthState] = useState(2); // 1=Loose, 2=Balanced, 3=Strict
  
  const [issueNumber, setIssueNumber] = useState(1);
  const [isFinale, setIsFinale] = useState(false);

  // --- Refs for Async Access (Fixes Stale Closures) ---
  const heroRef = useRef<Persona | null>(null);
  const friendRef = useRef<Persona | null>(null);
  const genreRef = useRef(GENRES[0]);
  const langRef = useRef(LANGUAGES[0].code);
  const premiseRef = useRef("");
  const toneRef = useRef(TONES[0]);
  const richModeRef = useRef(true);
  const refStrengthRef = useRef(2);
  const issueNumberRef = useRef(1);
  const isFinaleRef = useRef(false);
  const previousSummaryRef = useRef("");

  // Sync State and Refs
  const setHero = (p: Persona | null) => { setHeroState(p); heroRef.current = p; };
  const setFriend = (p: Persona | null) => { setFriendState(p); friendRef.current = p; };
  const setSelectedGenre = (v: string) => { setSelectedGenreState(v); genreRef.current = v; };
  const setSelectedLanguage = (v: string) => { setSelectedLanguageState(v); langRef.current = v; };
  const setCustomPremise = (v: string) => { setCustomPremiseState(v); premiseRef.current = v; };
  const setStoryTone = (v: string) => { setStoryToneState(v); toneRef.current = v; };
  const setRichMode = (v: boolean) => { setRichModeState(v); richModeRef.current = v; };
  const setRefStrength = (v: number) => { setRefStrengthState(v); refStrengthRef.current = v; };
  const setIssueNumberSync = (v: number) => { setIssueNumber(v); issueNumberRef.current = v; };
  const setIsFinaleSync = (v: boolean) => { setIsFinale(v); isFinaleRef.current = v; };

  const [apiStatus, setApiStatus] = useState<ApiStatus>('idle');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = (msg: string) => {
      console.log(`[InfiniteHeroes] ${msg}`); // Mirror to browser console
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString([], {hour12: false, minute:'2-digit', second:'2-digit'})}] ${msg}`].slice(-15));
  };

  const [comicFaces, setComicFaces] = useState<ComicFace[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  
  // --- Transition States ---
  const [showSetup, setShowSetup] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const generatingPages = useRef(new Set<number>());
  const historyRef = useRef<ComicFace[]>([]);

  // --- AI Helpers ---
  const getAI = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  };

  const handleAPIError = (e: any) => {
    const msg = String(e);
    console.error("API Error:", msg);
    setApiStatus('error');
    setApiErrorMessage(msg);
    addLog(`!! CRITICAL ERROR: ${msg.slice(0, 40)}...`);
    if (
      msg.includes('Requested entity was not found') || 
      msg.includes('API_KEY_INVALID') || 
      msg.toLowerCase().includes('permission denied')
    ) {
      setShowApiKeyDialog(true);
    }
  };

  // Helper to enforce strict timeouts on API calls
  const withTimeout = <T,>(promise: Promise<T>, ms: number = API_TIMEOUT_MS): Promise<T> => {
      return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
      ]);
  };

  const createPlaceholderImage = (text: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 768;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,512,768);
        ctx.strokeStyle = '#333'; ctx.lineWidth=10; ctx.strokeRect(0,0,512,768);
        
        // Draw warning icon
        ctx.fillStyle = '#ef4444'; 
        ctx.beginPath(); ctx.moveTo(256, 200); ctx.lineTo(356, 380); ctx.lineTo(156, 380); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 80px sans-serif'; ctx.textAlign='center'; ctx.fillText('!', 256, 350);

        ctx.fillStyle = '#eab308'; ctx.font = 'bold 30px sans-serif'; 
        ctx.fillText(text.toUpperCase(), 256, 450);
        
        ctx.fillStyle = '#666'; ctx.font = '20px monospace';
        ctx.fillText("Try a different genre/tone", 256, 500);
    }
    return canvas.toDataURL('image/jpeg');
  };

  const testConnection = async () => {
    const hasKey = await validateApiKey();
    if (!hasKey) return;

    setApiStatus('loading');
    setApiErrorMessage(null);
    addLog("Testing Interdimensional Link...");
    try {
      const ai = getAI();
      await withTimeout(ai.models.generateContent({
        model: MODEL_CHECK,
        contents: "Respond with 'OK' if you are ready to generate comics.",
        config: { safetySettings: SAFETY_SETTINGS }
      }), 15000);
      setApiStatus('success');
      addLog("Link established. Multiverse core online.");
    } catch (e) {
      handleAPIError(e);
    }
  };

  const testReferenceGeneration = async () => {
    const hasKey = await validateApiKey();
    if (!hasKey) return;

    setApiStatus('loading');
    setApiErrorMessage(null);
    addLog("Testing Multimodal Reference Link...");
    addLog(`Diagnostic: Stress testing image injection (Strength: ${refStrengthRef.current})...`);

    try {
        let refData = "";
        let refMime = "image/jpeg";
        let isPlaceholder = false;

        if (heroRef.current) {
            refData = heroRef.current.base64;
            refMime = heroRef.current.mimeType;
            addLog("Using uploaded HERO image for stress test...");
        } else {
             isPlaceholder = true;
             const canvas = document.createElement('canvas');
             canvas.width = 128; canvas.height = 128;
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 ctx.fillStyle = '#0000FF'; ctx.fillRect(0,0,128,128);
                 ctx.fillStyle = '#FFFFFF'; ctx.font = '20px sans-serif'; ctx.fillText('TEST', 10, 50);
             }
             const dataUrl = canvas.toDataURL('image/jpeg');
             refData = dataUrl.split(',')[1];
             addLog("No Hero uploaded. Using synthetic placeholder...");
        }

        // MIMIC PIPELINE LOGIC (Levels 0-2)
        const ai = getAI();
        const executeTest = async (level: number) => {
             const parts = [];
             parts.push({ text: "REFERENCE CHARACTER 1 (HERO) - FICTIONAL CHARACTER SHEET:" });
             parts.push({ inlineData: { mimeType: refMime, data: refData } });
             
             let prompt = `STYLE: ${genreRef.current} comic. Fictional Character Art. `;
             if (level > 0) prompt += "SAFE MODE: Fictional illustration. Fantasy art. No photorealism. ";
             
             // Strength logic
             if (refStrengthRef.current === 3) {
                 prompt += " Maintain strict resemblance to reference features. High fidelity. ";
             } else if (refStrengthRef.current === 1) {
                 prompt += " Loosely inspired by reference. Significant artistic stylization. ";
             } else {
                 prompt += " Use reference for costume/hair. Stylize face to comic style. ";
             }

             // Level 2 logic from pipeline
             let scene = "Character in a dramatic pose";
             if (level >= 1) scene = "Character standing in a neutral pose";
             
             prompt += `SCENE: ${scene}. `;
             prompt += `INSTRUCTIONS: Create a fictional comic book illustration based on the REFERENCE character. `;
             
             if (level > 0) {
                 prompt += `TRANSFORM THE CHARACTER: Alter features to fit the artistic style. Fictionalize the identity.`;
             }

             parts.push({ text: prompt });

             return await withTimeout(ai.models.generateContent({
                model: MODEL_IMAGE_GEN_NAME,
                contents: { parts },
                config: {
                    imageConfig: { aspectRatio: '1:1' },
                    safetySettings: SAFETY_SETTINGS
                }
            }), 45000);
        };

        // Try Level 0
        try {
            addLog("Attempt 1 (High Fidelity)...");
            const res = await executeTest(0);
            if (res.candidates && res.candidates.length > 0) {
                 setApiStatus('success');
                 addLog("Success at Level 0 (High Fidelity). Link Stable.");
                 if (isPlaceholder) addLog("(Used Placeholder. Upload Real Hero to Test Identity Filters)");
                 return;
            }
        } catch(e) { console.warn("L0 failed", e); }

        // Try Level 1
        try {
            addLog("Attempt 1 Blocked. Attempt 2 (Safe Mode)...");
            const res = await executeTest(1);
            if (res.candidates && res.candidates.length > 0) {
                 setApiStatus('success');
                 addLog("Success at Level 1 (Safe Mode). Link Stable.");
                 return;
            }
        } catch(e) { console.warn("L1 failed", e); }

        // Try Level 2
        try {
            addLog("Attempt 2 Blocked. Attempt 3 (Stylized)...");
            const res = await executeTest(2);
            if (res.candidates && res.candidates.length > 0) {
                 setApiStatus('success');
                 addLog("Success at Level 2 (Stylized). Link Stable.");
                 return;
            }
        } catch(e) { console.warn("L2 failed", e); }
        
        throw new Error("Reference Image Rejected at all levels.");

    } catch (e) {
        handleAPIError(e);
        addLog("Ref-Link Failed. The image triggers strict Safety Filters.");
    }
  };

  // Improved file processing with resizing and standardization
  const processFileUpload = (file: File): Promise<{base64: string, mimeType: string}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            // Reduce max size to 768px to minimize "photorealistic" safety triggers on reference images
            const MAX_SIZE = 768; 
            
            if (width > MAX_SIZE || height > MAX_SIZE) {
                if (width > height) {
                    height = Math.round(height * (MAX_SIZE / width));
                    width = MAX_SIZE;
                } else {
                    width = Math.round(width * (MAX_SIZE / height));
                    height = MAX_SIZE;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.fillStyle = '#FFFFFF'; // Prevent transparency issues
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Standardize to JPEG 0.85 quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const base64 = dataUrl.split(',')[1];
                resolve({ base64, mimeType: 'image/jpeg' });
            } else {
                reject(new Error("Canvas context failed"));
            }
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
  };

  const generateSummary = async (history: ComicFace[]): Promise<string> => {
      addLog("Archiving narrative thread...");
      // Extract text content only
      const text = history
          .filter(h => h.narrative)
          .map(h => `[Page ${h.pageIndex}] ${h.narrative?.caption || ''} ${h.narrative?.dialogue || ''} (Scene: ${h.narrative?.scene})`)
          .join(" ");

      if (!text) return "The story begins.";

      try {
          const ai = getAI();
          const res = await withTimeout(ai.models.generateContent({
              model: MODEL_TEXT_NAME,
              contents: `Summarize the events of this comic issue in 3 sentences. Focus on the ending cliffhanger or resolution. TEXT: ${text}`,
              config: { safetySettings: SAFETY_SETTINGS }
          }), 20000);
          return res.text || "To be continued...";
      } catch (e) {
          console.warn("Summary generation failed", e);
          return "The story continues...";
      }
  };

  const generateBeat = async (history: ComicFace[], isRightPage: boolean, pageNum: number, isDecisionPage: boolean): Promise<Beat> => {
    if (!heroRef.current) throw new Error("No Hero");
    addLog(`Drafting narrative arc for Page ${pageNum}...`);

    const isFinalPage = pageNum === MAX_STORY_PAGES;
    const langName = LANGUAGES.find(l => l.code === langRef.current)?.name || "English";

    // Filter valid history to avoid reading empty placeholder states
    const relevantHistory = history
        .filter(p => p.type === 'story' && p.narrative && (p.pageIndex || 0) < pageNum)
        .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

    const lastBeat = relevantHistory[relevantHistory.length - 1]?.narrative;
    const lastFocus = lastBeat?.focus_char || 'none';

    const historyText = relevantHistory.map(p => 
      `[Page ${p.pageIndex}] [Focus: ${p.narrative?.focus_char}] (Caption: "${p.narrative?.caption || ''}") (Dialogue: "${p.narrative?.dialogue || ''}") (Scene: ${p.narrative?.scene}) ${p.resolvedChoice ? `-> USER CHOICE: "${p.resolvedChoice}"` : ''}`
    ).join('\n');

    let friendInstruction = "Not yet introduced.";
    if (friendRef.current) {
        friendInstruction = "ACTIVE and PRESENT (User Provided).";
        if (lastFocus !== 'friend' && Math.random() > 0.4) {
             friendInstruction += " MANDATORY: FOCUS ON THE CO-STAR FOR THIS PANEL.";
        } else {
             friendInstruction += " Ensure they are woven into the scene even if not the main focus.";
        }
    }

    let coreDriver = `GENRE: ${genreRef.current}. TONE: ${toneRef.current}.`;
    if (genreRef.current === 'Custom') {
        coreDriver = `STORY PREMISE: ${premiseRef.current || "A totally unique, unpredictable adventure"}. (Follow this premise strictly over standard genre tropes).`;
    }
    
    // Inject previous issue summary if applicable
    let storyContext = "";
    if (issueNumberRef.current > 1 && previousSummaryRef.current) {
        storyContext += `PREVIOUS ISSUES RECAP: ${previousSummaryRef.current}\n`;
    }
    storyContext += `CURRENT ISSUE (${issueNumberRef.current}): ${historyText.length > 0 ? historyText : "Start of this issue."}`;

    const guardrails = `
    NEGATIVE CONSTRAINTS:
    1. UNLESS GENRE IS "Dark Sci-Fi" OR "Superhero Action" OR "Custom": DO NOT use technical jargon like "Quantum", "Timeline", "Portal", "Multiverse", or "Singularity".
    2. IF GENRE IS "Teen Drama" OR "Lighthearted Comedy": The "stakes" must be SOCIAL, EMOTIONAL, or PERSONAL (e.g., a rumor, a competition, a broken promise, being late, embarrassing oneself). Do NOT make it life-or-death. Keep it grounded.
    3. Avoid "The artifact" or "The device" unless established earlier.
    `;

    let instruction = `Continue the story. ALL OUTPUT TEXT (Captions, Dialogue, Choices) MUST BE IN ${langName.toUpperCase()}. ${coreDriver} ${guardrails}`;
    
    if (isFinaleRef.current) {
        instruction += " IMPORTANT: THIS IS THE GRAND FINALE ISSUE. You must resolve all major plot lines.";
    }

    if (richModeRef.current) {
        instruction += " RICH/NOVEL MODE ENABLED. Prioritize deeper character thoughts, descriptive captions, and meaningful dialogue exchanges over short punchlines.";
    }

    if (isFinalPage) {
        if (isFinaleRef.current) {
             instruction += " FINAL PAGE OF THE SERIES. CONCLUSIVE ENDING. End with 'THE END'. Do NOT leave a cliffhanger.";
        } else {
             instruction += " FINAL PAGE OF THIS ISSUE. KARMIC CLIFFHANGER REQUIRED. Text must end with 'TO BE CONTINUED...' (or localized equivalent).";
        }
    } else if (isDecisionPage) {
        instruction += " End with a PSYCHOLOGICAL choice about VALUES, RELATIONSHIPS, or RISK. (e.g., Truth vs. Safety, Forgive vs. Avenge). The options must NOT be simple physical actions like 'Go Left'.";
    } else {
        if (pageNum === 1) {
            instruction += isFinaleRef.current 
                ? " THE BEGINNING OF THE END. Establish the final conflict immediately."
                : " INCITING INCIDENT. An event disrupts the status quo. Establish the genre's intended mood.";
        } else if (pageNum <= 4) {
            instruction += " RISING ACTION. The heroes engage with the new situation. Focus on dialogue, character dynamics, and initial challenges.";
        } else if (pageNum <= 8) {
            instruction += " COMPLICATION. A twist occurs! A secret is revealed, a misunderstanding deepens, or the path is blocked.";
        } else {
            instruction += " CLIMAX. The confrontation with the main conflict.";
        }
    }

    const capLimit = richModeRef.current ? "max 35 words. Detailed narration or internal monologue" : "max 15 words";
    const diaLimit = richModeRef.current ? "max 30 words. Rich, character-driven speech" : "max 12 words";

    const prompt = `
You are writing a comic book script. PAGE ${pageNum} of ${MAX_STORY_PAGES}. ISSUE #${issueNumberRef.current}.
TARGET LANGUAGE FOR TEXT: ${langName} (CRITICAL: CAPTIONS, DIALOGUE, CHOICES MUST BE IN THIS LANGUAGE).
${coreDriver}

CHARACTERS:
- HERO: Active.
- CO-STAR: ${friendInstruction}

CONTEXT:
${storyContext}

RULES:
1. NO REPETITION. Do not use the same captions or dialogue from previous pages.
2. IF CO-STAR IS ACTIVE, THEY MUST APPEAR FREQUENTLY.
3. VARIETY. If page ${pageNum-1} was an action shot, make this one a reaction or wide shot.
4. LANGUAGE: All user-facing text MUST be in ${langName}.
5. Avoid saying "CO-star" and "hero" in the text captions. Use names if established, or generic descriptors.

INSTRUCTION: ${instruction}

OUTPUT STRICT JSON ONLY (No markdown formatting):
{
  "caption": "Unique narrator text in ${langName}. (${capLimit}).",
  "dialogue": "Unique speech in ${langName}. (${diaLimit}). Optional.",
  "scene": "Vivid visual description (ALWAYS IN ENGLISH for the artist model). MUST mention 'HERO' or 'CO-STAR' if they are present.",
  "focus_char": "hero" OR "friend" OR "other",
  "choices": ["Option A in ${langName}", "Option B in ${langName}"] (Only if decision page)
}
`;
    try {
        const ai = getAI();
        // Give text generation a shorter timeout (30s)
        const res = await withTimeout(ai.models.generateContent({ 
            model: MODEL_TEXT_NAME, 
            contents: prompt, 
            config: { 
                responseMimeType: 'application/json',
                safetySettings: SAFETY_SETTINGS
            } 
        }), 30000);
        let rawText = res.text || "{}";
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const parsed = JSON.parse(rawText);
        
        if (parsed.dialogue) parsed.dialogue = parsed.dialogue.replace(/^[\w\s\-]+:\s*/i, '').replace(/["']/g, '').trim();
        if (parsed.caption) parsed.caption = parsed.caption.replace(/^[\w\s\-]+:\s*/i, '').trim();
        if (!isDecisionPage) parsed.choices = [];
        if (isDecisionPage && !isFinalPage && (!parsed.choices || parsed.choices.length < 2)) parsed.choices = ["Option A", "Option B"];
        if (!['hero', 'friend', 'other'].includes(parsed.focus_char)) parsed.focus_char = 'hero';
        
        // CRITICAL: Ensure scene is never undefined to prevent downstream crashes
        if (!parsed.scene || typeof parsed.scene !== 'string') {
             parsed.scene = `A dramatic scene in the style of ${genreRef.current}. The characters react to the situation.`;
        }

        addLog(`Script for Page ${pageNum} finalized.`);
        return parsed as Beat;
    } catch (e) {
        console.error("Beat generation failed", e);
        // Only trigger critical error if it's auth related, otherwise return fallback
        const msg = String(e);
        if (msg.includes('API_KEY') || msg.includes('403') || msg.includes('Permission denied')) {
            handleAPIError(e);
        } else {
            addLog(`!! Script Gen Failed for Page ${pageNum}. Using default.`);
        }
        return { 
            caption: pageNum === 1 ? "It began..." : "...", 
            scene: `Generic scene for page ${pageNum}.`, 
            focus_char: 'hero', 
            choices: [] 
        };
    }
  };

  const generatePersona = async (desc: string): Promise<Persona> => {
      const style = genreRef.current === 'Custom' ? "Modern American comic book art" : `${genreRef.current} comic`;
      addLog(`Synthesizing character design: ${desc}...`);
      try {
          const ai = getAI();
          const res = await withTimeout(ai.models.generateContent({
              model: MODEL_IMAGE_GEN_NAME,
              contents: { text: `STYLE: Masterpiece ${style} character sheet, detailed ink, neutral background. FULL BODY. Character: ${desc}` },
              config: { 
                  imageConfig: { aspectRatio: '1:1' },
                  safetySettings: SAFETY_SETTINGS 
              }
          }), 45000);
          const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
          if (part?.inlineData?.data) {
              addLog("Character materialized successfully.");
              return { 
                  base64: part.inlineData.data, 
                  desc,
                  mimeType: part.inlineData.mimeType || 'image/jpeg' 
              };
          }
          throw new Error("Failed");
      } catch (e) { 
        // FIX: Don't call handleAPIError unconditionally. Just log and rethrow.
        // This allows the caller (generateSinglePage) to handle it by degrading gracefully (no sidekick).
        const msg = String(e);
        if (msg.includes('API_KEY') || msg.includes('403') || msg.includes('Permission denied')) {
             handleAPIError(e);
        } else {
             console.warn("Persona Gen Failed", e);
        }
        throw e; 
      }
  };

  const generateImage = async (beat: Beat, type: ComicFace['type'], pageNum: number): Promise<string> => {
    // Explicitly use pageNum argument for logging to avoid "Page 0" errors
    const label = type === 'cover' ? 'Cover' : type === 'back_cover' ? 'Back Cover' : `Page ${pageNum}`;
    addLog(`Rendering visual assets for ${label}...`);
    
    const styleEra = genreRef.current === 'Custom' ? "Modern American" : genreRef.current;
    
    // Safety check: Ensure we have a string for scene
    const originalScene = beat.scene || `A scene featuring the ${genreRef.current} style`;

    // Safety-optimized prompt construction
    const buildPrompt = (retryLevel: number) => {
        let text = `STYLE: ${styleEra} comic book art. Fictional Character Art. `;
        
        // Safety Context Injection
        if (retryLevel > 0) {
            text += "SAFE MODE: Fictional illustration. Fantasy art. No photorealism. ";
        }

        if (type === 'cover') {
            const langName = LANGUAGES.find(l => l.code === langRef.current)?.name || "English";
            let title = `ISSUE #${issueNumberRef.current}`;
            if (isFinaleRef.current) title = "THE FINALE";
            
            text += `TYPE: Comic Book Cover. TITLE: "INFINITE HEROES ${title}" (OR LOCALIZED TRANSLATION IN ${langName.toUpperCase()}). `;
            if (retryLevel > 0) {
                text += `Main visual: Character Portrait of [HERO]. Standing Pose. Masterpiece.`;
            } else {
                text += `Main visual: Dynamic action shot of [HERO].`;
            }
        } else if (type === 'back_cover') {
            const nextText = isFinaleRef.current ? "THE END" : "NEXT ISSUE SOON";
            text += `TYPE: Comic Back Cover. FULL PAGE VERTICAL ART. Dramatic teaser. Text: "${nextText}".`;
        } else {
            text += `TYPE: Vertical comic panel. `;
            
            // Level 2 Retry Logic: Simplification for safety
            if (retryLevel === 2) {
                 let safeScene = originalScene.replace(/fight|punch|kill|blood|attack|shoot|battle|war|weapon|corpse|violence|injury|death|dead/gi, "confrontation");
                 text += `SCENE: ${safeScene}. `;
            } else {
                let sceneToUse = originalScene;
                if (retryLevel === 1) {
                    sceneToUse = sceneToUse.replace(/fight|punch|kill|blood|attack|shoot|battle|war|weapon|corpse|violence|injury|death|dead/gi, "confrontation");
                }
                text += `SCENE: ${sceneToUse}. `;
            }
            
            text += `INSTRUCTIONS: Create a fictional comic book illustration. Artistic interpretation. `;
            
            if (beat.caption) text += ` INCLUDE CAPTION BOX: "${beat.caption}"`;
            if (beat.dialogue) text += ` INCLUDE SPEECH BUBBLE: "${beat.dialogue}"`;
        }
        return text;
    };

    const executeGen = async (useRefs: boolean, retryLevel: number = 0) => {
        const parts = [];
        
        // Logic for including references:
        // Include refs for Levels 0, 1, 2
        // If Level 3 is reached (last resort), we might skip them, but user requested digging deep.
        // So we will try to modify the prompt strategy for refs instead of dropping them immediately.
        
        // Only drop refs if we are at absolute final fallback (Level 3)
        const shouldIncludeRefs = useRefs && retryLevel < 3;

        if (shouldIncludeRefs) {
            // Interleave images with descriptive text to guide the model safely
            if (heroRef.current?.base64) {
                parts.push({ text: "REFERENCE CHARACTER 1 (HERO) - FICTIONAL CHARACTER SHEET:" });
                parts.push({ inlineData: { mimeType: heroRef.current.mimeType, data: heroRef.current.base64 } });
            }
            if (friendRef.current?.base64) {
                 parts.push({ text: "REFERENCE CHARACTER 2 (CO-STAR) - FICTIONAL CHARACTER SHEET:" });
                parts.push({ inlineData: { mimeType: friendRef.current.mimeType, data: friendRef.current.base64 } });
            }
             
             // Explicitly frame the usage to avoid "Real Person" triggers based on STRENGTH
             let usageInstruction = "";
             
             if (refStrengthRef.current === 3) {
                 usageInstruction = " (Use these REFERENCES strictly. Maintain character consistency and facial features as much as possible while applying the comic style).";
             } else if (refStrengthRef.current === 1) {
                 usageInstruction = " (Loosely inspired by the references. Create a new character with similar costume vibes but unique features).";
             } else {
                 // Default (2)
                 usageInstruction = " (Use these COSTUME REFERENCES to design the fictional characters. Do NOT generate a photorealistic replica. Stylize heavily).";
             }
             
             if (retryLevel > 0) {
                 // If we are retrying due to safety, we force the instruction towards fictionalization regardless of user setting.
                 usageInstruction += " TRANSFORM THE CHARACTER: Alter features slightly to fit the artistic style. Fictionalize the identity.";
             }

             const refPrompt = buildPrompt(retryLevel) + usageInstruction;
             parts.push({ text: refPrompt });
        } else {
             // Text only prompt with descriptors (Level 3 Fallback)
             let desc = "";
             if (heroRef.current?.desc) desc += ` HERO: ${heroRef.current.desc}.`;
             if (friendRef.current?.desc) desc += ` CO-STAR: ${friendRef.current.desc}.`;
             
             const suffix = " Fictional characters. Generic superhero features. High contrast comic art.";
             parts.push({ text: buildPrompt(retryLevel) + desc + suffix });
        }

        const ai = getAI();
        return await withTimeout(ai.models.generateContent({
          model: MODEL_IMAGE_GEN_NAME,
          contents: { parts }, // Explicitly wrap in parts for clarity
          config: { 
              imageConfig: { aspectRatio: '2:3' },
              safetySettings: SAFETY_SETTINGS
          }
        }));
    };

    const isSafetyBlock = (e: any) => {
        const msg = String(e);
        return msg.includes("Safety Block") || msg.includes("Refused") || msg.includes("SAFETY") || msg.includes("OTHER");
    };

    try {
        let res;
        try {
            // Attempt 1: Standard Generation (Level 0)
            res = await executeGen(!!heroRef.current?.base64, 0);
            if (!res.candidates || res.candidates.length === 0) throw new Error("Safety Block: Content Filtered");
        } catch (e) {
            if (isSafetyBlock(e)) {
                 // Attempt 2: Softened Prompt (Level 1)
                 console.warn("Retrying with safe prompt (Level 1)...", e);
                 addLog(`Scene intense. Softening visuals...`);
                 try {
                    res = await executeGen(!!heroRef.current?.base64, 1);
                    if (!res.candidates || res.candidates.length === 0) throw new Error("Safety Block: Content Filtered");
                 } catch (e2) {
                     // Attempt 3: Stylized/Looser Constraint (Level 2)
                     if (isSafetyBlock(e2)) {
                         console.warn("Retrying with stylized prompt (Level 2)...", e2);
                         addLog(`Retrying with stronger styling...`);
                         try {
                            res = await executeGen(!!heroRef.current?.base64, 2);
                            if (!res.candidates || res.candidates.length === 0) throw new Error("Safety Block: Content Filtered");
                         } catch (e3) {
                             // Attempt 4: Text Only Fallback (Level 3) - Only if absolutely necessary
                             if (isSafetyBlock(e3)) {
                                 console.warn("Retrying without references (Level 3)...", e3);
                                 addLog(`Visual link unstable. Using textual reconstruction...`);
                                 res = await executeGen(false, 3);
                             } else {
                                 throw e3;
                             }
                         }
                     } else {
                         throw e2;
                     }
                 }
            } else {
                throw e;
            }
        }
        
        // Final Check
        if (!res.candidates || res.candidates.length === 0) {
            throw new Error("Safety Block: Content Filtered");
        }

        // 1. Try to find image
        const part = res.candidates[0].content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
            addLog(`${label} successfully inked.`);
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        
        // 2. Check for text refusal/filtering (Model explains why it refused)
        const textPart = res.candidates[0].content?.parts?.find(p => p.text);
        if (textPart?.text) {
             throw new Error(`Model Refused: ${textPart.text.slice(0, 100)}...`);
        }
        
        // 3. Check finishReason (e.g. SAFETY, RECITATION)
        const finishReason = res.candidates[0].finishReason;
        if (finishReason && finishReason !== 'STOP') {
             throw new Error(`Generation stopped: ${finishReason}`);
        }

        throw new Error("No image data returned from API (Unknown Structure)");
    } catch (e) { 
        const msg = String(e);
        
        // Check for Auth/Permissions issue first - this is a critical error
        if (msg.includes('API_KEY') || msg.includes('403') || msg.includes('Permission denied')) {
            console.error("Critical Auth Error", e);
            handleAPIError(e);
            return createPlaceholderImage("AUTH ERROR");
        } 
        
        // If it's a safety block or refusal, show specific placeholder and warn instead of error
        if (msg.includes("Safety Block") || msg.includes("Refused") || msg.includes("SAFETY")) {
             console.warn(`Safety/Filter triggered for ${label}:`, msg);
             addLog(`!! Content Filtered for ${label}`);
             return createPlaceholderImage("CONTENT FILTERED");
        }

        // Generic error
        console.error("Image Gen Error", e);
        addLog(`!! Image Gen Failed for ${label}: ${msg.slice(0, 30)}...`);
        return createPlaceholderImage("IMAGE GEN FAILED");
    }
  };

  const updateFaceState = (id: string, updates: Partial<ComicFace>) => {
      setComicFaces(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      const idx = historyRef.current.findIndex(f => f.id === id);
      if (idx !== -1) historyRef.current[idx] = { ...historyRef.current[idx], ...updates };
  };

  const generateSinglePage = async (faceId: string, pageNum: number, type: ComicFace['type']) => {
      const isDecision = DECISION_PAGES.includes(pageNum);
      let beat: Beat = { scene: "", choices: [], focus_char: 'other' };

      if (type === 'cover') {
      } else if (type === 'back_cover') {
           beat = { scene: "Thematic teaser image", choices: [], focus_char: 'other' };
      } else {
           // Ensure we read from historyRef to get the most recent state
           beat = await generateBeat(historyRef.current, pageNum % 2 === 0, pageNum, isDecision);
      }

      if (beat.focus_char === 'friend' && !friendRef.current && type === 'story') {
          try {
              const newSidekick = await generatePersona(selectedGenre === 'Custom' ? "A fitting sidekick for this story" : `Sidekick for ${selectedGenre} story.`);
              setFriend(newSidekick);
          } catch (e) { 
              // Fallback if sidekick generation fails: don't use sidekick in this panel
              beat.focus_char = 'other'; 
          }
      }

      updateFaceState(faceId, { narrative: beat, choices: beat.choices, isDecisionPage: isDecision });
      const url = await generateImage(beat, type, pageNum);
      updateFaceState(faceId, { imageUrl: url, isLoading: false });
  };

  const generateBatch = async (startPage: number, count: number) => {
      const pagesToGen: number[] = [];
      for (let i = 0; i < count; i++) {
          const p = startPage + i;
          if (p <= TOTAL_PAGES && !generatingPages.current.has(p)) {
              pagesToGen.push(p);
          }
      }
      
      if (pagesToGen.length === 0) return;
      pagesToGen.forEach(p => generatingPages.current.add(p));

      const newFaces: ComicFace[] = [];
      pagesToGen.forEach(pageNum => {
          const type = pageNum === BACK_COVER_PAGE ? 'back_cover' : 'story';
          newFaces.push({ id: `page-${pageNum}`, type, choices: [], isLoading: true, pageIndex: pageNum });
      });

      setComicFaces(prev => {
          const existing = new Set(prev.map(f => f.id));
          return [...prev, ...newFaces.filter(f => !existing.has(f.id))];
      });
      newFaces.forEach(f => { if (!historyRef.current.find(h => h.id === f.id)) historyRef.current.push(f); });

      try {
          for (const pageNum of pagesToGen) {
               await generateSinglePage(`page-${pageNum}`, pageNum, pageNum === BACK_COVER_PAGE ? 'back_cover' : 'story');
               generatingPages.current.delete(pageNum);
               // Add a small delay between pages to prevent rate limiting
               await new Promise(r => setTimeout(r, 1000));
          }
      } catch (e) {
          console.error("Batch generation error", e);
      } finally {
          pagesToGen.forEach(p => generatingPages.current.delete(p));
      }
  }

  // Consolidated launch logic that handles both initial launch and next issue
  const startIssueGeneration = async (isNewIssue: boolean) => {
    setIsLaunching(true);
    if (!isNewIssue) {
        setLogs([]);
        addLog("Initializing Multiverse Core...");
    } else {
        addLog(`Preparing Issue #${issueNumberRef.current}...`);
    }

    const coverFace: ComicFace = { id: 'cover', type: 'cover', choices: [], isLoading: true, pageIndex: 0 };
    setComicFaces([coverFace]);
    historyRef.current = [coverFace];
    generatingPages.current.add(0);

    // Sequence the start
    await generateSinglePage('cover', 0, 'cover').finally(() => generatingPages.current.delete(0));
    
    addLog("Engaging Hyper-Transition...");
    setIsTransitioning(true);
    
    setTimeout(async () => {
        setIsStarted(true);
        setShowSetup(false);
        setIsTransitioning(false);
        // Wait for first 2 pages (Gate Page)
        addLog("Inking initial story sequence...");
        await generateBatch(1, INITIAL_PAGES);
        setIsLaunching(false);
        addLog("Ready to read!");
        // Continue with next batch (pages 3, 4, 5)
        generateBatch(3, 3);
    }, 1100);
  };

  const launchStory = async () => {
    const hasKey = await validateApiKey();
    if (!hasKey) return;
    
    if (!heroRef.current) return;
    if (selectedGenre === 'Custom' && !customPremise.trim()) {
        alert("Please enter a custom story premise.");
        return;
    }
    
    addLog(`Setting Genre: ${selectedGenre.toUpperCase()}`);
    let availableTones = TONES;
    if (selectedGenre === "Teen Drama / Slice of Life" || selectedGenre === "Lighthearted Comedy") {
        availableTones = TONES.filter(t => t.includes("CASUAL") || t.includes("WHOLESOME") || t.includes("QUIPPY"));
    } else if (selectedGenre === "Classic Horror") {
        availableTones = TONES.filter(t => t.includes("INNER-MONOLOGUE") || t.includes("OPERATIC"));
    }
    const tone = availableTones[Math.floor(Math.random() * availableTones.length)];
    setStoryTone(tone);
    addLog(`Harmonizing Tone: ${tone.split(' ')[0]}`);

    // Initial launch reset
    setIssueNumberSync(1);
    setIsFinaleSync(false);
    previousSummaryRef.current = "";

    startIssueGeneration(false);
  };

  const handleNextIssue = async (finale: boolean) => {
      // 1. Generate Summary of current book
      const summary = await generateSummary(historyRef.current);
      previousSummaryRef.current += `\n[Issue ${issueNumberRef.current} Summary]: ${summary}`;
      addLog("Issue archived.");

      // 2. Advance Issue Tracking
      setIssueNumberSync(issueNumberRef.current + 1);
      setIsFinaleSync(finale);
      
      // 3. Hard Reset for new book
      setComicFaces([]);
      setCurrentSheetIndex(0);
      historyRef.current = [];
      generatingPages.current.clear();
      
      // 4. Start
      startIssueGeneration(true);
  };

  const handleChoice = async (pageIndex: number, choice: string) => {
      addLog(`User made a choice: ${choice}. Branching timeline...`);
      updateFaceState(`page-${pageIndex}`, { resolvedChoice: choice });
      const maxPage = Math.max(...historyRef.current.map(f => f.pageIndex || 0));
      if (maxPage + 1 <= TOTAL_PAGES) {
          generateBatch(maxPage + 1, BATCH_SIZE);
      }
  }

  const resetApp = () => {
      setIsStarted(false);
      setShowSetup(true);
      setIsLaunching(false);
      setComicFaces([]);
      setCurrentSheetIndex(0);
      historyRef.current = [];
      setLogs([]);
      generatingPages.current.clear();
      setHero(null);
      setFriend(null);
      setApiStatus('idle');
      // Reset issue tracking
      setIssueNumberSync(1);
      setIsFinaleSync(false);
      previousSummaryRef.current = "";
  };

  const downloadPDF = () => {
    addLog("Compressing multiverse into PDF format...");
    const PAGE_WIDTH = 480;
    const PAGE_HEIGHT = 720;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE_WIDTH, PAGE_HEIGHT] });
    const pagesToPrint = comicFaces.filter(face => face.imageUrl && !face.isLoading).sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

    pagesToPrint.forEach((face, index) => {
        if (index > 0) doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
        if (face.imageUrl) doc.addImage(face.imageUrl, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    });
    doc.save(`Infinite-Heroes-Issue-${issueNumber}.pdf`);
    addLog("Download triggered.");
  };

  const handleHeroUpload = async (file: File) => {
       try { 
           const {base64, mimeType} = await processFileUpload(file); 
           setHero({ base64, mimeType, desc: "The Main Hero" }); 
           addLog("Hero identity confirmed."); 
       } catch (e) { alert("Hero upload failed"); }
  };
  const handleFriendUpload = async (file: File) => {
       try { 
           const {base64, mimeType} = await processFileUpload(file); 
           setFriend({ base64, mimeType, desc: "The Sidekick/Rival" }); 
           addLog("Sidekick/Rival identity confirmed."); 
       } catch (e) { alert("Friend upload failed"); }
  };

  const handleSheetClick = (index: number) => {
      if (!isStarted) return;
      if (index === 0 && currentSheetIndex === 0) return;
      if (index < currentSheetIndex) setCurrentSheetIndex(index);
      else if (index === currentSheetIndex && comicFaces.find(f => f.pageIndex === index)?.imageUrl) setCurrentSheetIndex(prev => prev + 1);
  };

  return (
    <div className="comic-scene">
      {showApiKeyDialog && <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />}
      
      <Setup 
          show={showSetup}
          isTransitioning={isTransitioning}
          isLaunching={isLaunching}
          logs={logs}
          hero={hero}
          friend={friend}
          selectedGenre={selectedGenre}
          selectedLanguage={selectedLanguage}
          customPremise={customPremise}
          richMode={richMode}
          refStrength={refStrength}
          apiStatus={apiStatus}
          apiErrorMessage={apiErrorMessage}
          onHeroUpload={handleHeroUpload}
          onFriendUpload={handleFriendUpload}
          onGenreChange={setSelectedGenre}
          onLanguageChange={setSelectedLanguage}
          onPremiseChange={setCustomPremise}
          onRichModeChange={setRichMode}
          onRefStrengthChange={setRefStrength}
          onLaunch={launchStory}
          onTestConnection={testConnection}
          onTestReferenceGen={testReferenceGeneration}
      />
      
      <Book 
          comicFaces={comicFaces}
          currentSheetIndex={currentSheetIndex}
          isStarted={isStarted}
          isSetupVisible={showSetup && !isTransitioning}
          logs={logs}
          isFinale={isFinale}
          onSheetClick={handleSheetClick}
          onChoice={handleChoice}
          onOpenBook={() => setCurrentSheetIndex(1)}
          onDownload={downloadPDF}
          onReset={resetApp}
          onNextIssue={(isFinale) => handleNextIssue(isFinale)}
      />
    </div>
  );
};

export default App;
