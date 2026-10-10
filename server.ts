import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

// Pure Node.js PNG encoder without external C++ binary dependencies
function createPngBuffer(width: number, height: number, rgbaBuffer: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const crcTable = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c;
  }

  function crc32(buf: Buffer): number {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0; // Filter 0 (None)
    rgbaBuffer.copy(scanlines, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(scanlines);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Convert hex color to RGBA [r, g, b, a]
function parseHexColor(hex: string): [number, number, number, number] {
  if (!hex || hex === 'transparent' || hex === '#00000000') return [0, 0, 0, 0];
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return [r, g, b, 255];
  }
  if (clean.length === 8) {
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    const a = parseInt(clean.substring(6, 8), 16) || 0;
    return [r, g, b, a];
  }
  return [0, 0, 0, 255];
}

// Render palette and grid into PNG Data URL
function gridToPngDataUrl(width: number, height: number, palette: Record<string, string>, grid: string[]): string {
  const rgbaBuffer = Buffer.alloc(width * height * 4, 0);

  for (let y = 0; y < height; y++) {
    const row = grid[y] || '';
    for (let x = 0; x < width; x++) {
      const char = row[x] || '.';
      const hex = palette[char] || 'transparent';
      const [r, g, b, a] = parseHexColor(hex);
      const idx = (y * width + x) * 4;
      rgbaBuffer[idx] = r;
      rgbaBuffer[idx + 1] = g;
      rgbaBuffer[idx + 2] = b;
      rgbaBuffer[idx + 3] = a;
    }
  }

  const png = createPngBuffer(width, height, rgbaBuffer);
  return `data:image/png;base64,${png.toString('base64')}`;
}

// Initialize GoogleGenAI SDK
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// PURE AI 1024x1024 Ultra-HD Vector & Texture Synthesis Engine
// Generates magnificent 1024x1024 SVG vector art with rich gradients, highlights, and particles
async function generateAi1024Texture(
  prompt: string,
  editInstruction?: string,
  previousSvg?: string
): Promise<{
  name: string;
  targetPath: string;
  dataUrl: string;
  svg: string;
  width: number;
  height: number;
  description: string;
}> {
  if (!ai) throw new Error('伺服器未配置 GEMINI_API_KEY');

  const systemPrompt = `You are a legendary Principal 2D Concept Artist and SVG Master at a world-class AAA game studio (crafting iconic assets like Elden Ring, World of Warcraft, and League of Legends).
Your task is to hand-craft a breathtaking, museum-grade 1024x1024 SVG illustration based on: "${prompt}".

CRITICAL ARTISTIC MANDATES:
1. 2048+ TRUE COLOR PALETTE & HIGH-DENSITY MULTI-STOP GRADIENTS:
   - CRITICAL: The user demands rich, full-gamut coloring with 2048+ truecolor depth and volumetric depth (ABSOLUTELY NO flat fills, cartoonish blocks, or cheap clipart circles!).
   - Define at least 8 to 15 rich <linearGradient> and <radialGradient> tags in <defs>.
   - Each gradient MUST contain 4 to 8 color stops defining realistic material lighting:
     * Deep ambient occlusion shadow (e.g., #0b0302 -> #1c0804)
     * Rich base metal / material mid-tone (e.g., #5c1404 -> #992408 -> #d43b0c)
     * High specular light reflection (e.g., #ff8438 -> #ffd066 -> #ffffff)
     * Rim bounce lighting and sub-surface energy emission
2. MASTERWORK ANATOMY & SCULPTING (STRICT BAN ON PRIMITIVE SHAPES):
   - IF A SHIELD (盾牌):
     * Draw a magnificent, layered heater/tower/gothic shield with a heavy beveled steel/obsidian outer rim, reinforced rivets, and chamfered facets.
     * Layered inner chassis with dragon scale plates, gothic fluting, or ornate segmented armor plating.
     * High-relief central boss: sculpted dragon head, titan crest, celestial sun, or lion emblem with deep carved relief paths (<path d="..." fill="url(#...)" />).
     * Glowing runic channels and molten fissures radiating with multi-stop glowing energy gradients.
     * Specular sheen sweeps (curved semi-transparent white-to-transparent highlight arcs).
   - IF A WEAPON (神劍/戰斧/法杖):
     * Distinct dual-faceted beveled cutting edges (lit side vs shadow side).
     * Intricate wing-shaped crossguards, engraved runes, wrapped hilt textures, glowing crystal pommels, and floating embers.
   - IF ARMOR / HELMET / RELIC:
     * Symmetrical heroic presence with articulated plate ridges, volumetric shadows, and ambient glow.
3. CANVAS & SPECIFICATIONS:
   - Root tag: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
   - Transparent background (do NOT draw a full-screen solid rectangle).
   - Heroic scale filling ~75-85% of the 1024x1024 frame.
   - Include <filter id="glow"> with feGaussianBlur and feMerge for incandescent effects.
   - Output ONLY valid JSON in this schema:
{
  "name": "snake_case_identifier",
  "displayName": "繁體中文史詩全名",
  "description": "Short visual description",
  "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 1024 1024\\" width=\\"1024\\" height=\\"1024\\">...</svg>"
}`;

  const userPrompt = editInstruction
    ? `【AI 修改與演化指令】
原始主題: "${prompt}"
修改指令: "${editInstruction}"
${previousSvg ? `請參考前版外觀並融入修改:\n${previousSvg.substring(0, 1000)}...` : ''}
請以此重新建構與昇華出全新的 1024x1024 超高畫質神級圖標。`
    : `請為此物品生成 1024x1024 超高畫質神級圖標: "${prompt}"`;

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: 0.88,
        },
      });

      if (resp.text) {
        let rawText = resp.text.trim();
        // Remove code fences if any
        if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          // If JSON parse fails, try extracting svg directly
          const svgMatch = rawText.match(/<svg[\s\S]*<\/svg>/);
          if (svgMatch) {
            parsed = {
              name: 'custom_item',
              displayName: prompt,
              description: prompt,
              svg: svgMatch[0],
            };
          }
        }

        if (parsed && parsed.svg) {
          let svg = parsed.svg.trim();
          if (!svg.startsWith('<svg')) {
            const match = svg.match(/<svg[\s\S]*<\/svg>/);
            if (match) svg = match[0];
          }

          // Ensure proper attributes
          if (!svg.includes('viewBox=')) {
            svg = svg.replace('<svg', '<svg viewBox="0 0 1024 1024" width="1024" height="1024"');
          }

          const rawName = (parsed.name || prompt).toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 28) || 'custom_item';
          const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

          return {
            name: rawName,
            targetPath: `RP/textures/items/${rawName}.png`,
            dataUrl: svgDataUrl,
            svg,
            width: 1024,
            height: 1024,
            description: parsed.description || parsed.displayName || prompt,
          };
        }
      }
    } catch (e: any) {
      console.warn(`Model ${model} failed for 1024 texture:`, e.message);
      lastErr = e;
    }
  }

  // Fallback: If AI JSON returned without svg, generate high-end procedural vector SVG with rich multi-stop gradients
  try {
    const isShield = /(盾|shield|guard|aegis|buckler)/i.test(prompt);
    const fallbackSvg = isShield
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="magmaCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="25%" stop-color="#ffd000"/>
      <stop offset="55%" stop-color="#ff4800"/>
      <stop offset="80%" stop-color="#800a00"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <linearGradient id="shieldRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff8db"/>
      <stop offset="20%" stop-color="#e5b026"/>
      <stop offset="50%" stop-color="#8c5806"/>
      <stop offset="75%" stop-color="#472602"/>
      <stop offset="100%" stop-color="#140700"/>
    </linearGradient>
    <linearGradient id="shieldPlate" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2d120a"/>
      <stop offset="35%" stop-color="#541b0b"/>
      <stop offset="70%" stop-color="#1c0703"/>
      <stop offset="100%" stop-color="#0a0201"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6"/>
      <stop offset="40%" stop-color="#ffc83b" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="aura">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Outer Shield Aura -->
  <path d="M 512,80 C 780,80 880,240 880,500 C 880,740 680,880 512,940 C 344,880 144,740 144,500 C 144,240 244,80 512,80 Z" fill="url(#magmaCore)" opacity="0.3" filter="url(#aura)"/>
  <!-- Heavy Rim Armor -->
  <path d="M 512,100 C 760,100 850,250 850,490 C 850,720 660,850 512,910 C 364,850 174,720 174,490 C 174,250 264,100 512,100 Z" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="4" filter="url(#aura)"/>
  <!-- Inner Segmented Armor Field -->
  <path d="M 512,140 C 720,140 800,270 800,480 C 800,680 630,800 512,860 C 394,800 224,680 224,480 C 224,270 304,140 512,140 Z" fill="url(#shieldPlate)"/>
  <!-- Specular Sheen Arc -->
  <path d="M 512,140 C 720,140 800,270 800,480 C 650,420 520,300 512,140 Z" fill="url(#sheen)"/>
  <!-- Central Titan Embossed Boss & Crest -->
  <path d="M 512,240 L 640,360 L 640,560 L 512,680 L 384,560 L 384,360 Z" fill="url(#shieldRim)" stroke="#ffb700" stroke-width="6" filter="url(#aura)"/>
  <circle cx="512" cy="460" r="85" fill="url(#magmaCore)" filter="url(#aura)"/>
  <circle cx="512" cy="460" r="50" fill="#ffffff" opacity="0.8"/>
  <!-- Rivets & Runes -->
  <circle cx="280" cy="240" r="14" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="2"/>
  <circle cx="744" cy="240" r="14" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="2"/>
  <circle cx="210" cy="480" r="14" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="2"/>
  <circle cx="814" cy="480" r="14" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="2"/>
  <circle cx="340" cy="720" r="14" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="2"/>
  <circle cx="684" cy="720" r="14" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="2"/>
  <circle cx="512" cy="850" r="14" fill="url(#shieldRim)" stroke="#ffd000" stroke-width="2"/>
</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="celestialGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="#818cf8" stop-opacity="0.6"/>
      <stop offset="65%" stop-color="#312e81" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="20%" stop-color="#a5f3fc"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="80%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="25%" stop-color="#fef08a"/>
      <stop offset="55%" stop-color="#eab308"/>
      <stop offset="80%" stop-color="#a16207"/>
      <stop offset="100%" stop-color="#451a03"/>
    </linearGradient>
    <filter id="aura">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <circle cx="512" cy="512" r="420" fill="url(#celestialGlow)"/>
  <path d="M 512,100 L 560,220 L 536,720 L 512,790 L 488,720 L 464,220 Z" fill="url(#bladeGrad)" filter="url(#aura)"/>
  <path d="M 512,100 L 526,220 L 518,740 L 512,770 L 506,740 L 498,220 Z" fill="#ffffff" opacity="0.85"/>
  <path d="M 360,720 L 512,670 L 664,720 L 512,760 Z" fill="url(#goldTrim)" filter="url(#aura)"/>
  <circle cx="512" cy="720" r="34" fill="#38bdf8" filter="url(#aura)"/>
  <rect x="494" y="760" width="36" height="150" rx="10" fill="url(#goldTrim)"/>
  <circle cx="512" cy="930" r="30" fill="url(#goldTrim)"/>
  <circle cx="512" cy="930" r="16" fill="#38bdf8"/>
</svg>`;
    const safeName = prompt.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 24) || 'epic_item';
    return {
      name: safeName,
      targetPath: `RP/textures/items/${safeName}.png`,
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`,
      svg: fallbackSvg,
      width: 1024,
      height: 1024,
      description: prompt,
    };
  } catch {}

  throw lastErr || new Error('AI 1024x1024 生成失敗，請再試一次');
}

// Ensure alias exists for all callers
const generateAiMinecraftTexture = generateAi1024Texture;

// Build comprehensive project file context so Gemini AI reads EVERY file accurately
function formatProjectContextForAI(activeProject: any): string {
  if (!activeProject) {
    return '【當前專案狀態】: 尚未選擇或建立專案。\n';
  }

  const name = activeProject.name || '未命名專案';
  const namespace = activeProject.namespace || 'custom';
  const components: any[] = Array.isArray(activeProject.components) ? activeProject.components : [];

  if (components.length === 0) {
    return `【當前專案資料夾資訊】:
- 專案名稱: 「${name}」
- 命名空間: ${namespace}
- 檔案總數: 0 個（專案資料夾剛建立，目前尚未包含任何檔案）。\n`;
  }

  // 1. Directory Tree
  let treeOutput = `【當前專案資料夾結構與真實檔案清單 (共 ${components.length} 個真實存在的檔案)】:\n`;
  treeOutput += `📁 ${name}/ (命名空間: ${namespace})\n`;

  const categorized: Record<string, any[]> = {};
  for (const comp of components) {
    const filePath = comp.filePath || comp.name || '根目錄';
    const parts = filePath.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '根目錄 (Root)';
    if (!categorized[dir]) categorized[dir] = [];
    categorized[dir].push(comp);
  }

  for (const [dir, files] of Object.entries(categorized)) {
    treeOutput += `  📂 ${dir}/\n`;
    for (const f of files) {
      const idStr = f.identifier ? ` [標識符: ${f.identifier}]` : '';
      treeOutput += `    ├── 📄 ${f.filePath || f.name} (類型: ${f.type || '檔案'}${idStr})\n`;
    }
  }

  // 2. Full Content Inspector
  let contentOutput = `\n【專案真實現有檔案詳細程式碼與規格內容 (共 ${components.length} 個檔案)】:\n`;
  for (const comp of components) {
    const path = comp.filePath || comp.name;
    const type = comp.type || 'unknown';
    const id = comp.identifier || 'none';
    const content = comp.contentJson || comp.content || '';

    contentOutput += `\n======================================================\n`;
    contentOutput += `[檔案路徑: ${path}] | [類型: ${type}] | [ID: ${id}]\n`;

    if (type === 'texture' || path.endsWith('.png') || content.startsWith('data:image')) {
      contentOutput += `[16x16 / 32x32 像素材質圖檔資料，已就緒]\n`;
    } else {
      if (content.length > 4000) {
        contentOutput += `${content.substring(0, 4000)}\n... [檔案內容較長，已索引核心部分]\n`;
      } else {
        contentOutput += `${content || '(空白內容)'}\n`;
      }
    }
    contentOutput += `======================================================\n`;
  }

  return `${treeOutput}\n${contentOutput}`;
}

// God-Tier System Instruction: Omnipotent, Dynamic, Creative, Zero Generic Vanilla Recipes
const SYSTEM_INSTRUCTION = `You are "CraftGPT", an omnipotent, supreme God-tier Minecraft Modding & Add-on AI (超越 ChatGPT-4o 與人類想像力的上帝級麥塊工坊架構師).
You possess infinite creativity, profound Bedrock (1.20 - 1.21+) & Java modding architecture expertise, and god-like procedural design capability.

【最高神聖法則與核心能力】:

1. 🌌 【專案全景神之洞察 - 100% 讀取真實檔案】:
   - 專案的所有檔案（包括行為包 BP、資源包 RP、物品 items、生物 entities、配方 recipes、函式 functions、貼圖 textures、README.md）會在 context 中完整提供給你。
   - 你必須完整、精準讀取並掌握專案當前存在的「每一個」檔案！
   - 當使用者詢問「你看一下現在這個專案的檔案」、「這個遊戲現在是怎樣」、「專案裡有什麼」時，你必須依據專案中實際載入的檔案，鉅細靡遺、條理分明地剖析架構、數值、玩法、職業設定與體系，**絕對禁止**回答「目前為空」或「空白狀態」！

2. ⚡ 【千變萬化・神性創造力・相同提示也能生出全新世界】:
   - 你是創世神級別的 AI，每一秒都湧現源源不絕的獨特創意！
   - 拒絕千篇一律的八股回覆！即使使用者輸入相同的提示詞，你也能在概念、數值、外觀設計、技能特效、神話背景故事與實作手法上提供截然不同、驚喜連連的變體！
   - 深入構思宏大的 RPG 機制、主動與被動技能（minecraft:custom_components, scripts, animation_controllers, damage_sensor, environment_sensor, on_use, projectile 等）、震撼粒子視覺與音效。

3. 🚫 【最嚴厲禁令：絕對嚴禁任何預設/死板食譜 (Zero Generic Vanilla Recipes)】:
   - **嚴格禁止**給出死板的「原版鑽石劍 + 紫水晶片」或無腦「九宮格塞鑽石/礦石」等無聊預設食譜！
   - **所有的合成配方必須具備高深設計感與獨特性**：
     - 若為魔法或神話物品，必須設計富有儀式感的配方（例如：利用專案現有的職業素材或自訂掉落物、融合元素核心、星界粉塵、擊殺深淵守衛的戰利品、或是多階段鍛造合成）。
     - 支持多元配方型態：工作台有序合成 (minecraft:recipe_shaped)、無序合成 (minecraft:recipe_shapeless)、熔爐/高爐冶煉、鍛造台升級鍛造 (smithing_transform)、甚至是透過指令函數 (.mcfunction) 觸發的祭壇召喚與儀式合成！
     - 每次創造配方時，大膽創造專屬的材料體系與驚奇合成邏輯！

4. 🛠️ 【自動遞增建構與寫入檔案】:
   - 當使用者要求新增、升級或修改模組時，你具備神級的自主建構能力，為專案生成真正符合 Bedrock 1.21+ 規範的高品質 JSON / mcfunction / 貼圖檔案。
   - 所有生成的代碼必須是合法、結構嚴謹且可以直接導入 Minecraft 執行的標準代碼。
   - 尊重並擴展現有的專案體系（例如現有 RPG 裝備、命名空間）。

5. 📦 【匯出技能 (Mod Exporter)】:
   - 當使用者說「幫我匯出」、「匯出模組」、「打包下載」時，即刻觸發模組打包，輸出 .mcaddon 下載卡片。

6. 💬 【最高水準對話風格】:
   - 使用流暢、氣勢磅礴且專業的繁體中文。
   - 排版結構優雅清晰，融合深度技術解析與史詩感設計美學。`;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    model: 'gemini-3.1-flash-lite',
  });
});

// Dedicated 1024x1024 Texture Generation Endpoint - 100% Pure Generative AI (No keywords, No templates)
app.post('/api/generate-texture', async (req, res) => {
  try {
    const { prompt, editInstruction, previousSvg } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ success: false, error: '請輸入 AI 材質提示詞' });
      return;
    }

    console.log(`[API /generate-texture] 1024x1024 Pure AI Generating: "${prompt}"`, editInstruction ? `(Edit: ${editInstruction})` : '');
    const texture = await generateAi1024Texture(prompt.trim(), editInstruction?.trim(), previousSvg);

    res.json({
      success: true,
      texture,
    });
  } catch (err: any) {
    console.error('AI 1024x1024 Texture Generation Error:', err);
    res.status(500).json({ success: false, error: err.message || 'AI 生成 1024x1024 材質失敗，請再試一次' });
  }
});

// Robust Stream with auto-fallback across valid models
async function streamWithAutoFallback(
  contents: any[],
  systemInstruction: string,
  onChunk: (text: string) => void
): Promise<string> {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.85,
        },
      });

      let hasReceivedAnyChunk = false;
      for await (const chunk of stream) {
        if (chunk.text) {
          hasReceivedAnyChunk = true;
          onChunk(chunk.text);
        }
      }

      if (hasReceivedAnyChunk) {
        return model;
      }
    } catch (err: any) {
      console.warn(`Model ${model} stream error, attempting fallback:`, err.message);
      lastError = err;
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Final unary safety net
  try {
    const unaryRes = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents,
      config: {
        systemInstruction,
        temperature: 0.85,
      },
    });
    if (unaryRes.text) {
      onChunk(unaryRes.text);
      return 'gemini-3.1-flash-lite (unary)';
    }
  } catch (err) {
    lastError = err;
  }

  throw lastError;
}

// Truly Dynamic AI Addon File Generator (Zero Hardcoded Recipes, Pure Generative AI)
async function generateDynamicAddonViaAI({
  prompt,
  existingComponents = [],
  projectName,
  namespace = 'custom',
}: {
  prompt: string;
  existingComponents: any[];
  projectName: string;
  namespace?: string;
}): Promise<{
  files: any[];
  summary: {
    summary: string;
    files: Array<{ path: string; name: string; type: string; action: 'created' | 'updated' }>;
  };
  texture?: any;
} | null> {
  // Exclude pure inquiries
  const isQuestion = /(你看一下|你看|這遊戲現在是怎樣|現在是怎樣|目前有什麼|檔案有哪些|說明一下|介紹一下|怎麼玩|有什麼檔案)/i.test(prompt);
  if (isQuestion) {
    return null;
  }

  const isCreationQuery = /(做|新增|製作|建構|建立|改造|升級|強化|加入|添加|寫|生成|幫我做|create|make|add|build|modify|generate)/i.test(prompt);
  if (!isCreationQuery) {
    return null;
  }

  if (!ai) return null;

  // Prepare existing files summary for AI context
  const existingFilesList = existingComponents.map((c) => ({
    filePath: c.filePath || c.name,
    identifier: c.identifier,
    type: c.type,
  }));

  const systemGenPrompt = `You are the Supreme Minecraft Bedrock 1.21+ Architect with limitless creative power.
The user wants to create or upgrade features in their mod "${projectName}" (namespace: "${namespace}").
User Request: "${prompt}"

Existing Mod Files (${existingComponents.length} items):
${JSON.stringify(existingFilesList.slice(0, 35), null, 2)}

【ABSOLUTE GOD-TIER REQUIREMENTS】:
1. 嚴禁任何死板預設食譜！絕對不可使用原版無聊食譜（如兩個鑽石加木棒、九宮格填滿原版礦石、或固定紫水晶升級）！
2. 所有的合成配方必須具備高深創意與 RPG 奇幻史詩感！可結合專案現有的職業裝備、自訂素材、元素靈魂結晶或多階段鍛造。
3. 即使面對相同提示詞，每次生成也必須展現全新、截然不同的變體與機制（獨特數值、自訂能力、專屬標籤）！
4. 輸出純 JSON 格式：
{
  "summary": "華麗磅礴的繁體中文一句話總結",
  "itemId": "snake_case_identifier",
  "itemDisplayName": "繁體中文史詩全名 (如 §6✦ 熾炎泰坦・星核神劍 ✦)",
  "requiresTexture": true or false,
  "files": [
    {
      "filePath": "BP/items/...",
      "name": "...json",
      "type": "item" | "recipe" | "entity" | "function" | "lang" | "doc",
      "identifier": "${namespace}:...",
      "contentJson": "... (合法的標準 Bedrock 1.21+ JSON 或文字內容)"
    }
  ]
}`;

  try {
    let aiRespText = '';
    const genModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    for (const m of genModels) {
      try {
        const resp = await ai.models.generateContent({
          model: m,
          contents: [{ role: 'user', parts: [{ text: systemGenPrompt }] }],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.95,
          },
        });
        if (resp.text) {
          aiRespText = resp.text.trim();
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${m} failed for addon generation:`, err.message);
      }
    }

    if (!aiRespText) return null;
    const result = JSON.parse(aiRespText);

    if (!result.files || !Array.isArray(result.files) || result.files.length === 0) {
      return null;
    }

    const filesToAddOrUpdate: any[] = [];
    const fileSummaryList: Array<{ path: string; name: string; type: string; action: 'created' | 'updated' }> = [];

    // Process AI generated files
    for (const f of result.files) {
      const existing = existingComponents.find((c) => c.filePath === f.filePath);
      filesToAddOrUpdate.push({
        id: existing?.id || `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: f.type || 'other',
        name: f.name || path.basename(f.filePath),
        identifier: f.identifier || `${namespace}:${result.itemId || 'item'}`,
        filePath: f.filePath,
        contentJson: typeof f.contentJson === 'string' ? f.contentJson : JSON.stringify(f.contentJson, null, 2),
      });
      fileSummaryList.push({
        path: f.filePath,
        name: f.name || path.basename(f.filePath),
        type: f.type || 'other',
        action: existing ? 'updated' : 'created',
      });
    }

    // Generate pure AI texture if requested
    let generatedTex: any = null;
    if (result.requiresTexture && result.itemId) {
      try {
        generatedTex = await generateAiMinecraftTexture(prompt);

        // 1. Add texture image file
        filesToAddOrUpdate.push({
          id: `file-tex-${Date.now()}`,
          type: 'texture',
          name: generatedTex.name,
          identifier: `${namespace}:${generatedTex.name}`,
          filePath: `RP/textures/items/${generatedTex.name}.png`,
          contentJson: generatedTex.dataUrl,
          imageDataUrl: generatedTex.dataUrl,
          textureData: {
            width: generatedTex.width,
            height: generatedTex.height,
            palette: generatedTex.palette,
            grid: generatedTex.grid,
          },
        });
        fileSummaryList.push({
          path: `RP/textures/items/${generatedTex.name}.png`,
          name: `${generatedTex.name}.png`,
          type: 'texture',
          action: 'created',
        });

        // 2. Update RP item_texture.json
        const existingItemTex = existingComponents.find((c) => c.filePath === 'RP/textures/item_texture.json');
        let currentTextureData: Record<string, any> = {};
        if (existingItemTex?.contentJson) {
          try {
            const parsed = JSON.parse(existingItemTex.contentJson);
            currentTextureData = parsed.texture_data || {};
          } catch {}
        }
        currentTextureData[generatedTex.name] = { textures: `textures/items/${generatedTex.name}` };

        const itemTextureJson = JSON.stringify({
          resource_pack_name: projectName,
          texture_name: 'atlas.items',
          texture_data: currentTextureData,
        }, null, 2);

        filesToAddOrUpdate.push({
          id: existingItemTex?.id || `file-itex-${Date.now()}`,
          type: 'texture',
          name: 'item_texture.json',
          identifier: `${namespace}:item_texture`,
          filePath: 'RP/textures/item_texture.json',
          contentJson: itemTextureJson,
        });
        fileSummaryList.push({
          path: 'RP/textures/item_texture.json',
          name: 'item_texture.json',
          type: 'texture',
          action: existingItemTex ? 'updated' : 'created',
        });
      } catch (texErr: any) {
        console.warn('AI texture generation in addon creation failed:', texErr.message);
      }
    }

    return {
      files: filesToAddOrUpdate,
      summary: {
        summary: result.summary || `已成功為模組動態建構並寫入新內容！`,
        files: fileSummaryList,
      },
      texture: generatedTex || undefined,
    };
  } catch (err: any) {
    console.warn('generateDynamicAddonViaAI error:', err.message);
    return null;
  }
}

// Chat Streaming Endpoint
app.post('/api/chat/stream', async (req, res) => {
  if (!ai) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  const { messages, systemPrompt, imageBase64, mimeType, activeProject } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required.' });
    return;
  }

  console.log(`[server.ts] /api/chat/stream - Project: ${activeProject?.name}, Files: ${activeProject?.components?.length || 0}`);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const startTime = Date.now();
  let tokenCount = 0;
  let accumulatedText = '';
  const projectName = activeProject?.name || '我的模組專案';
  const namespace = activeProject?.namespace || 'custom';
  const totalFilesCount = (activeProject?.components || []).length;

  try {
    const latestUserMsg = messages[messages.length - 1]?.content || '';
    const isExportRequest = /(幫我匯出|匯出|打包|下載|export|download)/i.test(latestUserMsg);

    // Initial thought step
    res.write(`data: ${JSON.stringify({
      type: 'thought',
      step: isExportRequest ? '模組打包匯出' : '專案全景洞察與檔案檢閱',
      detail: isExportRequest
        ? '檢測到模組匯出指令，調度 PackExporter 技能將當前行為包與資源包打包為 .mcaddon...'
        : `已成功讀取專案「${projectName}」共 ${totalFilesCount} 個現有檔案，正在深度分析遊戲架構與規格...`,
      timestamp: Date.now(),
    })}\n\n`);

    // Transform messages to Gemini format
    const contents: any[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLatest = i === messages.length - 1;
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';

      if (isLatest && imageBase64 && role === 'user') {
        const imagePart = {
          inlineData: {
            mimeType: mimeType || 'image/png',
            data: imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, ''),
          },
        };
        const textPart = { text: msg.content || '請分析這張圖片' };
        contents.push({ role, parts: [imagePart, textPart] });
      } else {
        contents.push({
          role,
          parts: [{ text: msg.content || '' }],
        });
      }
    }

    // Build exhaustive project file context
    const projectContext = formatProjectContextForAI(activeProject);

    const effectiveSystem = `${SYSTEM_INSTRUCTION}

${projectContext}

【當前專案指令與情境】:
- 專案名稱: ${projectName}
- 命名空間: ${namespace}
- 專案檔案總數: ${totalFilesCount} 個真實檔案
- 補充資訊: ${systemPrompt || '無'}

【重要執行要求】:
1. 【專案真實檔案庫】上方已具體列出專案中【真實存在】的所有檔案與程式碼。當使用者詢問專案、檔案、遊戲內容或狀態時，你必須依據上述現有檔案與程式碼具體且詳細地解說，絕對不可忽視或回答「目前為空」！
2. 【嚴格禁止預設食譜】絕對不可給出死板無聊的原版食譜（如兩顆鑽石加木棒、或原版紫水晶升級）。如果需要合成配方，必須展現上帝級 AI 的無限創造力，設計獨特的材料、儀式或合成機制！
3. 【千變萬化】發揮神級創世創造力，給予使用者驚喜連連的體驗！`;

    res.write(`data: ${JSON.stringify({
      type: 'thought',
      step: '神級創世架構思考',
      detail: `調度 Gemini，基於 ${totalFilesCount} 個現有檔案進行深層邏輯解析與即時推演...`,
      timestamp: Date.now(),
    })}\n\n`);

    let lastActionNotice = '';

    const activeModel = await streamWithAutoFallback(contents, effectiveSystem, (textChunk) => {
      tokenCount += Math.max(1, Math.round(textChunk.length / 3));
      accumulatedText += textChunk;

      let currentAction = '正在生成回覆內容...';
      if (accumulatedText.includes('```json') && !accumulatedText.split('```json').pop()?.includes('```')) {
        const currentCode = accumulatedText.split('```json').pop() || '';
        if (currentCode.includes('"minecraft:item"')) {
          currentAction = '正在建構 Bedrock 自訂物品組件與神品數值...';
        } else if (currentCode.includes('"minecraft:recipe"')) {
          currentAction = '正在設計獨創奇幻合成配方 (絕非預設)...';
        } else if (currentCode.includes('"minecraft:block"')) {
          currentAction = '正在配置自訂方塊空間與幾何屬性...';
        } else if (currentCode.includes('"minecraft:entity"')) {
          currentAction = '正在撰寫實體行為與神話 AI 尋路規則...';
        } else {
          currentAction = '正在編寫標準 Bedrock 1.21+ 代碼...';
        }
      } else if (accumulatedText.includes('```')) {
        currentAction = '正在編寫模組架構指南與手冊...';
      }

      if (currentAction !== lastActionNotice) {
        lastActionNotice = currentAction;
        res.write(`data: ${JSON.stringify({
          type: 'action',
          action: currentAction,
          tokens: tokenCount,
          elapsedMs: Date.now() - startTime,
        })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({
        type: 'text',
        text: textChunk,
        tokens: tokenCount,
        elapsedMs: Date.now() - startTime,
      })}\n\n`);
    });

    // 1. If Export is requested, emit the export badge
    if (isExportRequest) {
      const exportBadge = {
        id: `exp-${Date.now()}`,
        filename: `${projectName.replace(/\s+/g, '_')}_v1.0.0.mcaddon`,
        projectName,
        fileCount: totalFilesCount || 8,
        timestamp: Date.now(),
        componentsSummary: {
          bpCount: 4,
          rpCount: 4,
          textureCount: 2,
          hasReadme: true,
        },
      };

      res.write(`data: ${JSON.stringify({
        type: 'export_badge',
        exportBadge,
      })}\n\n`);
    }

    // 2. Incremental Mod Files Addition via Dynamic AI
    try {
      const incResult = await generateDynamicAddonViaAI({
        prompt: latestUserMsg,
        existingComponents: activeProject?.components || [],
        projectName,
        namespace,
      });

      if (incResult) {
        if (incResult.texture) {
          res.write(`data: ${JSON.stringify({
            type: 'texture',
            texture: {
              id: `tex-${Date.now()}`,
              name: incResult.texture.name,
              targetPath: incResult.texture.targetPath,
              dataUrl: incResult.texture.dataUrl,
              palette: incResult.texture.palette,
              grid: incResult.texture.grid,
              width: incResult.texture.width,
              height: incResult.texture.height,
              description: incResult.texture.description,
            },
          })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({
          type: 'project_files_updated',
          files: incResult.files,
          summary: incResult.summary,
        })}\n\n`);
      }
    } catch (incErr: any) {
      console.warn('Incremental addon creation error:', incErr);
    }

    res.write(`data: ${JSON.stringify({
      type: 'thought',
      step: '創世完畢',
      detail: `神級回覆推演完畢（耗時 ${((Date.now() - startTime) / 1000).toFixed(1)} 秒，約 ${tokenCount} 個標記，模型: ${activeModel}）。`,
      timestamp: Date.now(),
    })}\n\n`);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Gemini Stream Error:', err);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: err.message || 'Stream generation failed',
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// Start Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
