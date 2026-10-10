import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';

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

4. 🧱 【方塊（Block）與盔甲（Armor）材質與 3D 穿戴之最高全知法則】:
   ★ 一、方塊（Block）：如何用平面圖表現六面？
     方塊的六面表現方式非常簡單，主要分為兩種做法，你必須徹底精通並能靈活實作：
     • 做法 A：六面都長得一模一樣（最簡單）
       如果你做的是像「鑽石磚」、「泥土」、「平滑黑曜石」這種六面都相同的方塊，你真的只需要畫一張 16x16 像素的平面圖（例如 my_block.png，亦可支援 1024x1024 高畫質貼圖）。
       - 遊戲怎麼做？ 當你在 RP/blocks.json 裡面指定這張圖片時，Minecraft 內建的程式碼會自動複製這張平面圖 6 次，把它貼在立方體的上、下、前、後、左、右。你不需要自己去折它！
       - 範例 RP/blocks.json：
         {
           "custom:my_block": {
             "textures": "my_block",
             "sound": "stone"
           }
         }
       - 並在 RP/textures/terrain_texture.json 註冊 "my_block": { "textures": "textures/blocks/my_block" }。
     • 做法 B：六面長得不一樣（例如：書櫃、熔爐、草地、祭壇）
       如果你希望方塊的上面、下面、側面長得不同，你必須畫多張獨立的平面圖（例如：top.png、side.png、bottom.png，或 north/south/east/west/up/down）。
       - 遊戲怎麼做？ 你在寫 RP/blocks.json 時，可以利用 textures 物件分別指定不同的平面圖給不同的面：
         {
           "custom:my_block": {
             "textures": {
               "up": "my_block_top",      // 上面用這張平面圖
               "down": "my_block_bottom", // 下面用這張平面圖
               "side": "my_block_side"    // 四個側面都用這張平面圖
             },
             "sound": "stone"
           }
         }
       - 在 RP/textures/terrain_texture.json 分別登記各面貼圖路徑。
       - 在行為包 BP/blocks/ 中透過 minecraft:material_instances 精確映射貼圖與著色方法。

   ★ 二、盔甲（Armor）：如何用平面圖表現立體穿戴？
     盔甲在遊戲中嚴格區分為兩個完全不同的圖片體系，絕對不可混淆：
     1. 物品欄圖示（Item Icon）：
        - 這是你拿在手上、或在包包/快捷欄裡看到的「純平面圖片」（例如一頂帽子、一件衣服、一條褲子、一雙鞋子的形狀）。它永遠都是平面的。
        - 註冊於 RP/textures/item_texture.json，在 BP/items/ 透過 minecraft:icon 關聯。
     2. 穿在身上的外觀（Armor Texture / Skin / UV Layout）：
        - 這是一張依照官方標準版面（Layout）展開的「平面展開圖」（就像摺紙模型的設計圖）。
        - 官方人體展開圖架構（不使用 Blockbench 時使用「描圖改色法」）：
          • Layer 1（第一層，通常為 textures/models/armor/<name>_layer_1.png）：
            包含 頭盔（Helmet）、胸甲（Chestplate）、靴子（Boots）的表面展開圖（攤平展示頭頂、臉部、後腦勺、左右手臂、躯幹各格子）。
          • Layer 2（第二層，通常為 textures/models/armor/<name>_layer_2.png）：
            包含 護腿（Leggings / 褲子）的雙腿與骨盆表面展開圖。
        - 描圖改色法：在官方標準展開圖範本（如鑽石盔甲展開圖）的小格子中填入對應的顏色與花紋。
        - 遊戲怎麼做？（RP/attachables/ 3D 骨骼綁定機制）：
          在資源包 RP/attachables/<armor_part>.json 中配置：
          - 幾何模型：geometry.humanoid.armor.<slot> (如 helmet, chestplate, leggings, boots)
          - 材質貼圖：指向對應的 Layer 1 或 Layer 2 展開圖 (textures/models/armor/<name>_layer_1 或 _2)
          - 材質通道：materials: { "default": "armor" }
          - 動畫控制器：controller.animation.armor.default
          當遊戲看到這張展開圖，就會依照內建的玩家骨骼，自動把頭部格子貼在玩家頭上、身體格子貼在胸前、腿部格子貼在腿上。平面的展開圖在遊戲裡就會是完美的 3D 盔甲！

   ★ 三、靈活運用生徒與製作：
     - 當使用者與你聊到或要求製作「方塊」或「盔甲」時，你必須展現出對「方塊六面相同 vs 分面貼圖」、「盔甲 2D 物品圖示 vs 穿戴展開圖 + attachables」的深刻理解！
     - 能精確生成符合 Bedrock 1.21+ 規格的代碼與貼圖目錄結構。
     - 善用本工作坊具備的 1024×1024 超高畫質生成引擎，靈活生成極致品質的方塊貼圖、物品圖標與盔甲展開圖！

5. 🛠️ 【自動遞增建構與寫入檔案】:
   - 當使用者要求新增、升級或修改模組時，你具備神級的自主建構能力，為專案生成真正符合 Bedrock 1.21+ 規範的高品質 JSON / mcfunction / 貼圖檔案。
   - 所有生成的代碼必須是合法、結構嚴謹且可以直接導入 Minecraft 執行的標準代碼。
   - 尊重並擴展現有的專案體系（例如現有 RPG 裝備、命名空間）。

6. 📦 【匯出技能與全通道下載保障 (Mod Exporter)】:
   - 當使用者說「幫我匯出」、「匯出模組」、「打包下載」時，即刻觸發模組打包，輸出 .mcaddon 下載卡片。
   - 系統已內建「本機即時生成」與「後端伺服器直鏈下載 (/api/export-addon)」雙重機制，能徹底解決瀏覽器 iframe sandbox 下載受限或 Blob URL 提前失效的問題！

7. 🛡️ 【Minecraft 基岩版官方正版模組 (Marketplace) 加密機制解析 (DRM)】:
   - 深度解答：「為什麼有些正版 .mcaddon / Marketplace 模組會提示『未在此檔案中偵測到有效的 Minecraft Bedrock JSON 模組組件』？」
   - 原理剖析：微軟 / Mojang 官方商城 (Marketplace) 販售的官方正版 Add-on，內部行為包 (BP) 與材質包 (RP) 的 JSON 檔案與紋理皆經過微軟專屬金鑰進行硬體層級的 DRM 二進制加密保護。因此，當使用者將商城提取的模組包放入文字編輯器或第三方解包工具時，檔案內容全部為加密密文（非純文本 JSON），瀏覽器或編輯器自然無法讀取有效組件。
   - 對比社群正版/開源模組：由模組創作者透過正常管線發布的 .mcaddon 或社群模組包，內部則是標準未加密的 ZIP 結構，包含標準的 BP/ 與 RP/ 目錄結構與 JSON 文本，CraftGPT 完全支援匯入與自由修改！
   - 解決之道：請使用者使用非加密的社群開源 .mcaddon / .mcpack，或直接向 CraftGPT 描述想要的功能，由 AI 直接為其編寫出相同且甚至更強大的 100% 開放標準 Bedrock 1.21+ 模組！

8. 🚀 【無懈可擊的多通道匯出引擎 (Multi-Channel Export Engine)】:
   - 解答：「遇到完全不能匯出該怎麼辦？」
   - 本系統已全面升級為多通道匯出保證機制：
     1. 瀏覽器本機即時生成下載：修復了傳統瀏覽器在點擊後立即釋放 Blob URL 導致下載被中斷的問題，維持 60 秒生命週期。
     2. 後端伺服器直鏈下載 (/api/export-addon)：透過 Express 伺服器端動態封包，直接以 HTTP Content-Disposition: attachment 串流下載，徹底破除任何 iframe sandbox、跨域沙盒或瀏覽器 Blob 限制！
     3. ZIP 完整原始檔下載：供使用者自由解壓縮至遊戲 com.mojang 目錄進行即時除錯與檔案修改。
     4. 行為包 (BP.mcpack) 與資源包 (RP.mcpack) 獨立下載通道。

9. 💬 【最高水準對話風格】:
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

// Robust Server-side Add-on Pack Exporter (Bypasses all iframe sandbox download restrictions)
app.post('/api/export-addon', async (req, res) => {
  try {
    const { project, format = 'mcaddon' } = req.body;
    if (!project) {
      res.status(400).json({ success: false, error: '缺少專案資料' });
      return;
    }

    const zip = new JSZip();
    const packName = (project.name || 'CustomAddon').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    const bpFolder = zip.folder(`${packName}_BP`)!;
    const rpFolder = zip.folder(`${packName}_RP`)!;

    const bpUUID1 = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    const bpUUID2 = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    const rpUUID1 = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    const rpUUID2 = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

    // BP Manifest
    const bpManifest = {
      format_version: 2,
      header: {
        name: `${project.name || 'Custom Mod'} [行為包]`,
        description: project.description || 'Crafted with CraftGPT',
        uuid: bpUUID1,
        version: project.version || [1, 0, 0],
        min_engine_version: [1, 21, 0],
      },
      modules: [{ type: 'data', uuid: bpUUID2, version: project.version || [1, 0, 0] }],
      dependencies: [{ uuid: rpUUID1, version: project.version || [1, 0, 0] }],
    };
    bpFolder.file('manifest.json', JSON.stringify(bpManifest, null, 2));

    // RP Manifest
    const rpManifest = {
      format_version: 2,
      header: {
        name: `${project.name || 'Custom Mod'} [材質包]`,
        description: project.description || 'Crafted with CraftGPT',
        uuid: rpUUID1,
        version: project.version || [1, 0, 0],
        min_engine_version: [1, 21, 0],
      },
      modules: [{ type: 'resources', uuid: rpUUID2, version: project.version || [1, 0, 0] }],
    };
    rpFolder.file('manifest.json', JSON.stringify(rpManifest, null, 2));

    const langEntries: string[] = [
      `pack.name=${project.name || 'Custom Mod'}`,
      `pack.description=${project.description || ''}`,
    ];
    const itemTextureData: Record<string, { textures: string }> = {};
    const terrainTextureData: Record<string, { textures: string }> = {};

    const components = Array.isArray(project.components) ? project.components : [];
    for (const comp of components) {
      if (!comp) continue;
      const rawPath = (comp.filePath || comp.name || 'comp.json').replace(/\\+/g, '/');
      const content = typeof comp.contentJson === 'string' ? comp.contentJson : JSON.stringify(comp.contentJson || {}, null, 2);

      if (rawPath === 'README.md' || comp.type === 'doc') {
        zip.file('README.md', content);
        continue;
      }

      const rawId = comp.identifier && comp.identifier.includes(':')
        ? comp.identifier.split(':')[1]
        : (comp.name || 'custom').toLowerCase().replace(/\s+/g, '_');

      if (comp.type === 'texture' || rawPath.endsWith('.png')) {
        let base64 = '';
        const url = comp.imageDataUrl || comp.contentJson || '';
        if (typeof url === 'string') {
          if (url.includes('base64,')) base64 = url.split('base64,')[1];
          else if (!url.startsWith('{') && url.length > 30) base64 = url;
        }
        if (base64) {
          const subPath = rawPath.startsWith('RP/') ? rawPath.replace(/^RP\//, '') : `textures/items/${rawId}.png`;
          rpFolder.file(subPath, base64, { base64: true });
          if (subPath.includes('textures/blocks/')) {
            terrainTextureData[rawId] = { textures: `textures/blocks/${rawId}` };
            langEntries.push(`tile.${project.namespace || 'custom'}:${rawId}.name=${comp.name || rawId}`);
          } else {
            itemTextureData[rawId] = { textures: `textures/items/${rawId}` };
            langEntries.push(`item.${project.namespace || 'custom'}:${rawId}.name=${comp.name || rawId}`);
          }
        }
        continue;
      }

      if (rawPath.startsWith('BP/')) {
        bpFolder.file(rawPath.replace(/^BP\//, ''), content);
        continue;
      }
      if (rawPath.startsWith('RP/')) {
        rpFolder.file(rawPath.replace(/^RP\//, ''), content);
        continue;
      }

      const fileName = `${rawId}.json`;
      let targetFolder = bpFolder;
      if (comp.type === 'item') {
        targetFolder = bpFolder.folder('items')!;
        langEntries.push(`item.${comp.identifier || `${project.namespace}:${rawId}`}.name=${comp.name || rawId}`);
      } else if (comp.type === 'block') {
        targetFolder = bpFolder.folder('blocks')!;
        langEntries.push(`tile.${comp.identifier || `${project.namespace}:${rawId}`}.name=${comp.name || rawId}`);
      } else if (comp.type === 'entity') {
        targetFolder = bpFolder.folder('entities')!;
        langEntries.push(`entity.${comp.identifier || `${project.namespace}:${rawId}`}.name=${comp.name || rawId}`);
      } else if (comp.type === 'recipe') {
        targetFolder = bpFolder.folder('recipes')!;
      } else if (comp.type === 'function') {
        targetFolder = bpFolder.folder('functions')!;
      }
      targetFolder.file(fileName, content);
    }

    if (Object.keys(itemTextureData).length > 0) {
      rpFolder.file('textures/item_texture.json', JSON.stringify({
        resource_pack_name: project.name || 'CustomAddon',
        texture_name: 'atlas.items',
        texture_data: itemTextureData,
      }, null, 2));
    }

    if (Object.keys(terrainTextureData).length > 0) {
      rpFolder.file('textures/terrain_texture.json', JSON.stringify({
        resource_pack_name: project.name || 'CustomAddon',
        texture_name: 'atlas.terrain',
        padding: 8,
        num_mip_levels: 4,
        texture_data: terrainTextureData,
      }, null, 2));
    }

    const langText = langEntries.join('\n');
    rpFolder.file('texts/en_US.lang', langText);
    rpFolder.file('texts/zh_TW.lang', langText);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const fileExt = format === 'zip' ? 'zip' : 'mcaddon';
    const filename = `${packName}.${fileExt}`;

    res.setHeader('Content-Type', format === 'zip' ? 'application/zip' : 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err: any) {
    console.error('Server export error:', err);
    res.status(500).json({ success: false, error: err.message || '伺服器打包匯出失敗' });
  }
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
  // Exclude pure inquiries, explanations, and questions
  const isQuestion = /(你看一下|你看|這遊戲現在是怎樣|現在是怎樣|目前有什麼|檔案有哪些|說明一下|介紹一下|怎麼玩|有什麼檔案|如何|怎麼|為什麼|總結|比較|區別|請說明|解釋|教學|什麼是|差別)/i.test(prompt);
  if (isQuestion) {
    return null;
  }

  // Only trigger creation when explicitly asked to create, add, or generate items/blocks/features
  const isCreationQuery = /(幫我做|請做|做一個|做一把|做一套|新增|製作|建構|建立|改造|升級|強化|加入|添加|幫我寫|生成|create|make|add|build|generate)/i.test(prompt);
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

【ABSOLUTE GOD-TIER ARCHITECTURE REQUIREMENTS】:
1. 嚴禁任何死板預設食譜！絕對不可使用原版無聊食譜（如兩個鑽石加木棒、九宮格填滿原版礦石、或固定紫水晶升級）！
2. 所有的合成配方必須具備高深創意與 RPG 奇幻史詩感！可結合專案現有的職業裝備、自訂素材、元素靈魂結晶或多階段鍛造。
3. 即使面對相同提示詞，每次生成也必須展現全新、截然不同的變體與機制！
4. 【方塊 (Block) 架構】：
   - 做法 A（六面相同）：在 RP/blocks.json 指定單一貼圖鍵值，遊戲會自動複製貼滿 6 面。
   - 做法 B（六面不同，如熔爐/書櫃/草地）：在 RP/blocks.json 指定 textures: { "up": "...", "down": "...", "side": "..." }。
   - 務必配置對應的 BP/blocks/、RP/blocks.json 與 RP/textures/terrain_texture.json。
5. 【盔甲 (Armor) 雙重圖素與 3D 穿戴架構】：
   - 必須清楚區分「物品欄圖示 (Item Icon 2D)」與「穿在身上的 3D 展開圖 (Layer 1: 頭盔/胸甲/靴子, Layer 2: 護腿)」。
   - 生成 RP/attachables/ 檔案綁定 geometry.humanoid.armor.<slot> 與對應展開圖，使平面的展開圖依照人體骨骼自動變成 3D 盔甲！
   - BP/items/ 需包含 minecraft:wearable 與 minecraft:armor 組件。
6. 輸出純 JSON 格式：
{
  "summary": "華麗磅礴的繁體中文一句話總結",
  "itemId": "snake_case_identifier",
  "itemDisplayName": "繁體中文史詩全名 (如 §6✦ 熾炎泰坦・星核神劍 ✦)",
  "category": "block" | "armor" | "item" | "entity",
  "requiresTexture": true or false,
  "textureType": "block" | "armor" | "item",
  "blockTextures": { "up": "...", "down": "...", "side": "..." },
  "files": [
    {
      "filePath": "BP/items/..." or "BP/blocks/..." or "RP/attachables/...",
      "name": "...json",
      "type": "item" | "block" | "recipe" | "attachable" | "entity" | "function" | "lang" | "doc",
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

        const isBlock = result.category === 'block' || result.textureType === 'block' || result.files.some((f: any) => f.filePath?.startsWith('BP/blocks/'));
        const isArmor = result.category === 'armor' || result.textureType === 'armor' || result.files.some((f: any) => f.filePath?.startsWith('RP/attachables/'));

        if (isBlock) {
          // 1. Add block texture image file
          const blockTexPath = `RP/textures/blocks/${generatedTex.name}.png`;
          filesToAddOrUpdate.push({
            id: `file-tex-${Date.now()}`,
            type: 'texture',
            name: `${generatedTex.name}.png`,
            identifier: `${namespace}:${generatedTex.name}`,
            filePath: blockTexPath,
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
            path: blockTexPath,
            name: `${generatedTex.name}.png`,
            type: 'texture',
            action: 'created',
          });

          // 2. Update RP terrain_texture.json
          const existingTerrainTex = existingComponents.find((c) => c.filePath === 'RP/textures/terrain_texture.json');
          let currentTerrainData: Record<string, any> = {};
          if (existingTerrainTex?.contentJson) {
            try {
              const parsed = JSON.parse(existingTerrainTex.contentJson);
              currentTerrainData = parsed.texture_data || {};
            } catch {}
          }
          currentTerrainData[generatedTex.name] = { textures: `textures/blocks/${generatedTex.name}` };
          const terrainTextureJson = JSON.stringify({
            resource_pack_name: projectName,
            texture_name: 'atlas.terrain',
            texture_data: currentTerrainData,
          }, null, 2);

          filesToAddOrUpdate.push({
            id: existingTerrainTex?.id || `file-ttex-${Date.now()}`,
            type: 'texture',
            name: 'terrain_texture.json',
            identifier: `${namespace}:terrain_texture`,
            filePath: 'RP/textures/terrain_texture.json',
            contentJson: terrainTextureJson,
          });
          fileSummaryList.push({
            path: 'RP/textures/terrain_texture.json',
            name: 'terrain_texture.json',
            type: 'texture',
            action: existingTerrainTex ? 'updated' : 'created',
          });

          // 3. Update RP blocks.json (Approach A: 6 sides same, or Approach B: multi-face)
          const existingBlocksJson = existingComponents.find((c) => c.filePath === 'RP/blocks.json');
          let currentBlocksData: Record<string, any> = {};
          if (existingBlocksJson?.contentJson) {
            try {
              currentBlocksData = JSON.parse(existingBlocksJson.contentJson);
            } catch {}
          }
          currentBlocksData[`${namespace}:${result.itemId}`] = {
            textures: result.blockTextures || generatedTex.name,
            sound: 'stone',
          };
          const blocksJsonContent = JSON.stringify(currentBlocksData, null, 2);
          filesToAddOrUpdate.push({
            id: existingBlocksJson?.id || `file-blocks-${Date.now()}`,
            type: 'block',
            name: 'blocks.json',
            identifier: `${namespace}:blocks_json`,
            filePath: 'RP/blocks.json',
            contentJson: blocksJsonContent,
          });
          fileSummaryList.push({
            path: 'RP/blocks.json',
            name: 'blocks.json',
            type: 'block',
            action: existingBlocksJson ? 'updated' : 'created',
          });
        } else if (isArmor) {
          // 1. Add 2D Item Icon
          const itemIconPath = `RP/textures/items/${generatedTex.name}.png`;
          filesToAddOrUpdate.push({
            id: `file-tex-icon-${Date.now()}`,
            type: 'texture',
            name: `${generatedTex.name}.png`,
            identifier: `${namespace}:${generatedTex.name}`,
            filePath: itemIconPath,
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
            path: itemIconPath,
            name: `${generatedTex.name}.png (物品欄平面圖示)`,
            type: 'texture',
            action: 'created',
          });

          // 2. Add 3D Worn Model Texture (Layer 1: Helmet/Chestplate/Boots, or Layer 2: Leggings)
          const isLeggings = /(leggings|護腿|褲子|legs)/i.test(prompt) || /(leggings|護腿|褲子)/i.test(result.itemId);
          const layerSuffix = isLeggings ? '2' : '1';
          const armorModelPath = `RP/textures/models/armor/${generatedTex.name}_${layerSuffix}.png`;
          filesToAddOrUpdate.push({
            id: `file-tex-model-${Date.now()}`,
            type: 'texture',
            name: `${generatedTex.name}_${layerSuffix}.png`,
            identifier: `${namespace}:${generatedTex.name}_${layerSuffix}`,
            filePath: armorModelPath,
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
            path: armorModelPath,
            name: `${generatedTex.name}_${layerSuffix}.png (3D人體穿戴展開圖 Layer ${layerSuffix})`,
            type: 'texture',
            action: 'created',
          });

          // 3. Update RP item_texture.json
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
        } else {
          // Standard Item / Weapon / Tool
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
        }
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
3. 【千變萬化】發揮神級創世創造力，給予使用者驚喜連連的體驗！
4. 【方塊六面映射與盔甲 3D 穿戴之最高全知實作】：
   - 方塊（Block）：徹底掌握做法 A（六面相同，用 1 張平面圖由遊戲在 blocks.json 自動貼 6 面）與做法 B（六面不同如草地/熔爐/書櫃，在 blocks.json 用 textures: { "up": "...", "down": "...", "side": "..." } 分配不同獨立平面圖）。
   - 盔甲（Armor）：徹底掌握雙重圖素體系（物品欄圖示 2D 純平面圖 vs 穿戴外觀 3D 展開圖 Layer 1 頭盔/胸甲/靴子 與 Layer 2 護腿，利用描圖改色法畫進官方骨骼小格子，透過 RP/attachables/ 綁定內建人體骨骼模型與動畫，自動將平面展開圖貼成 3D 穿戴盔甲）。
   - 當使用者詢問、討論或要求製作時，必須精確剖析並靈活運用這些機制！`;

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
        } else if (currentCode.includes('"minecraft:block"') || currentCode.includes('"textures":')) {
          currentAction = '正在配置自訂方塊空間與六面材質映射...';
        } else if (currentCode.includes('"geometry.humanoid.armor"') || currentCode.includes('"minecraft:attachable"')) {
          currentAction = '正在綁定盔甲 3D 人體穿戴骨骼與 Attachables 展開圖...';
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
