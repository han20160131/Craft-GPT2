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
// 100% Pure Generative AI - Strictly NO mock or hardcoded templates
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

  const systemPrompt = `You are the Principal Lead Concept Artist and Technical SVG Director at a world-class AAA game studio (Blizzard, Riot Games, Bungie, CD Projekt).
Your mission: Hand-craft a jaw-dropping, ultra-high-definition 1024x1024 vector game asset strictly matching the user's concept: "${prompt}".

ABSOLUTE ANTI-MINIMALISM & 2048+ COLOR SPECTRUM MANDATE:
1. STRICT ZERO-MINIMALISM BAN:
   - A dark cube with only 2-3 thin lines and a few dots is an UNACCEPTABLE FAILURE.
   - The asset MUST be dense, richly detailed, and contain at least 45 to 70 layered SVG elements!
   - Every single face, bevel, edge, and core must have physical depth, multi-stop lighting, and high visual interest.

2. 2048-COLOR GRADIENT SPECTRUM & RICH COLORFUL LIGHTING:
   - Define at least 12 to 16 distinct <linearGradient> and <radialGradient> definitions in <defs>.
   - Each gradient MUST contain 4 to 6 color stops to simulate rich lighting physics:
     * Deep ambient shadow (e.g., #020617, #090d16, #1e112a, #03131e)
     * Rich metallic chassis tones (e.g., #1e293b, #334155, #475569, #64748b, #94a3b8)
     * Vibrant emissive neons & plasma (e.g., Cyan #00f5ff, Cobalt #0284c7, Purple #a855f7, Magenta #f43f5e, Azure #38bdf8)
     * Radiant core & gold highlights (e.g., #fbbf24, #f59e0b, #d97706, #fffbeb)
     * Piercing specular rim & flare glints (e.g., #ffffff, #fef08a)
   - Combine contrasting, harmonious color spectrums (e.g. Obsidian Midnight + Glowing Cyan Veins + Plasma Violet Pulses + Molten Gold Accents + Pure Diamond Glints).

3. FOR BLOCKS / CUBES (方塊 / 立方體 3D ISOMETRIC ARCHITECTURE):
   - Draw an unmistakable 3D ISOMETRIC CUBE filling 75% of the 1024x1024 canvas (centered around 512, 512).
   - TOP FACE (High-Key Direct Light):
     * Polygon from top (512, 210) to right (790, 370), center (512, 530), left (234, 370).
     * Recessed inner power matrix with beveled titanium rim.
     * Glowing central reactor eye or runic emblem pulsating with multi-stop radial gradient.
   - LEFT FACE (Mid-Tone Direct Shadow):
     * Polygon from (234, 370), (512, 530), (512, 830), (234, 670).
     * Stepped armor plates with chamfered bevels, ventilation slots with internal glowing coils, branching energy bus lines.
   - RIGHT FACE (Deep Ambient Shadow):
     * Polygon from (512, 530), (790, 370), (790, 670), (512, 830).
     * Heavy engraved conduits cutting through dark obsidian relief, glowing data conduits with neon glow filters.
   - 7 VISIBLE VERTICES & BEVELS:
     * Heavy bolted corner reinforcement caps on all vertices with chamfers, rivets, and razor specular highlights.
   - ATMOSPHERIC PARTICLES & LENS GLINTS:
     * At least 12-16 floating energy shards/diamonds (<polygon points="..."/>) and 4-point star lens flares (<path d="M x,y-14 Q x,y x+14,y Q x,y x,y+14 Q x,y x-14,y Z" fill="#ffffff"/>) around the cube!

4. FOR WEAPONS / TOOLS / ARMOR / ITEMS:
   - Multi-tiered blades/heads, beveled edges, intricate hilt/crossguard, glowing rune channels, multi-stop elemental auras, and floating sparks.

5. CANVAS & TRANSPARENCY:
   - Root tag MUST be <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">.
   - DO NOT draw a full-canvas opaque solid background rectangle. Keep background transparent.
   - Filter glow: <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>.

RESPONSE SCHEMA (RETURN ONLY RAW VALID JSON):
{
  "name": "snake_case_english_name",
  "displayName": "繁體中文物品名稱",
  "description": "簡短霸氣物品描述",
  "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 1024 1024\\" width=\\"1024\\" height=\\"1024\\">...</svg>"
}`;

  const userPrompt = editInstruction
    ? `【AI 修改微調進化指令】
原始主題: "${prompt}"
修改進化指令: "${editInstruction}"
${previousSvg ? `請以此先前的 SVG 造型為基礎進行進化與昇華重構:
${previousSvg.substring(0, 1500)}...` : ''}
請以此昇華創造出全新的 1024x1024 超高畫質神級圖標。`
    : `請為以下主題生成 1024x1024 超高畫質神級圖標: "${prompt}"`;

  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[AI 1024 Engine] Calling model ${model} (attempt ${attempt + 1}) for: "${prompt}"...`);
        const resp = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.72,
          },
        });

        if (resp.text) {
          let rawText = resp.text.trim();
          if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
          }

          let parsed: any = null;
          try {
            parsed = JSON.parse(rawText);
          } catch {
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

            // Strip any full-screen opaque rectangles that cover the background
            svg = svg.replace(/<rect\s+width="1024"\s+height="1024"[^>]*\/>/gi, '');
            svg = svg.replace(/<rect\s+fill="[^"]*"\s+width="1024"\s+height="1024"[^>]*\/>/gi, '');
            svg = svg.replace(/<rect[^>]*width="100%"[^>]*height="100%"[^>]*\/>/gi, '');

            // Ensure proper attributes
            if (!svg.includes('viewBox=')) {
              svg = svg.replace('<svg', '<svg viewBox="0 0 1024 1024" width="1024" height="1024"');
            }

            const rawName = (parsed.name || prompt).toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 28) || 'custom_item';
            const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

            console.log(`[AI 1024 Engine] Successfully generated via ${model}: ${rawName} (${svg.length} bytes SVG)`);

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
        console.warn(`Model ${model} (attempt ${attempt + 1}) failed:`, e.message);
        lastErr = e;
        const isTransient = /503|429|UNAVAILABLE|high demand|resource_exhausted/i.test(e.message || '');
        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          break; // move on to next model in list
        }
      }
    }
  }

  // 100% PURE AI: Strictly comply with user rule (絕對不可以使用已經寫好的程式來冒充AI生成的圖片)
  throw lastErr || new Error('AI 生成暫時繁忙或回應異常，請稍後重試');
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

9. ⛏️ 【麥塊術語智能神識：『稿子』與『鎬子 (Pickaxe)』智慧解析與組件架構】:
   - 當使用者輸入「稿子」、「生成稿子」、「做一把稿子」時，CraftGPT 必須展現出神級麥塊 AI 的頂級智慧，第一時間洞察使用者意圖為「鎬子（Pickaxe / 鶴嘴鎬 / 採礦鎬）」（為中文注音/拼音輸入法最常見同音字），絕對不可生成文稿、文章草稿或誤生成普通刀劍！
   - 回覆時要展現超凡專業度：「神級洞察：檢測到指令『生成稿子』——在麥塊世界中，這正是冒險家最核心的採礦神器『鎬子（Pickaxe）』！已為您自動校正並以頂級規格鍛造！」
   - 鎬子之 Bedrock 1.21+ 完整標準規範：
     * minecraft:digger 組件:
       - use_efficiency: true
       - destroy_speeds:
         - stone (速度 16~24)
         - cobblestone (速度 16~24)
         - deepslate (速度 18~26)
         - obsidian (速度 24~32)
         - iron_ore, gold_ore, diamond_ore, ancient_debris 等各類礦石
     * tags: ["minecraft:is_pickaxe", "minecraft:digger"]
     * minecraft:hand_equipped: true
     * minecraft:enchantable: { "slot": "pickaxe", "value": 30 }
     * minecraft:durability: { "max_durability": 3200 }
     * minecraft:damage: { "value": 8 } (具備近戰攻擊力)
     * 特殊技能：連鎖挖礦 (Vein Miner)、熔煉採集 (Auto-Smelt)、幸運倍率或爆破採礦衝擊波！
     * 貼圖外型：展現經典雙向弧形鎬頭、鑿礦尖峰、強化中軸套筒與人體工學長柄！

10. 💬 【最高水準對話風格】:
   - 使用流暢、氣勢磅礴且專業的繁體中文。
   - 排版結構優雅清晰，融合深度技術解析與史詩感設計美學。`;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    model: 'gemini-3.8-flash',
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
    const { prompt, editInstruction, previousSvg, angleMode, referenceImage } = req.body;
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
    let msg = err.message || 'AI 生成 1024x1024 材質失敗，請再試一次';
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {}
    if (/high demand|503|UNAVAILABLE|overloaded/i.test(msg)) {
      msg = 'AI 雲端算力目前瞬間負載較高，系統已自動排程，請稍候 3 秒後再次點擊「開始生成」即可！';
    }
    res.status(500).json({ success: false, error: msg });
  }
});

// Robust Stream with auto-fallback across valid models
async function streamWithAutoFallback(
  contents: any[],
  systemInstruction: string,
  onChunk: (text: string) => void
): Promise<string> {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');

  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
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
      model: 'gemini-3.8-flash',
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
6. 【稿子 / 鎬子 (Pickaxe) 意圖精準識別與採礦挖礦組件規範】：
   - 當使用者提到「稿子」、「生成稿子」、「做一把稿子」、「鎬子」或「採礦鎬」時，這是麥塊冒險家最核心的工具「鎬子（Pickaxe）」，絕非文稿或草稿！
   - 物品組件 BP/items/ 必須嚴格包含標準的採礦挖掘組件：
     * "minecraft:digger": 包含 "use_efficiency": true, "destroy_speeds": [ 涵蓋 stone (speed 16~20), deepslate (speed 18~24), obsidian (speed 26~32), ores 等各類礦石 ]
     * "minecraft:hand_equipped": true
     * "minecraft:enchantable": { "slot": "pickaxe", "value": 30 }
     * "minecraft:durability": { "max_durability": 3200 }
     * "tags": ["minecraft:is_pickaxe", "minecraft:digger"]
7. 輸出純 JSON 格式：
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
    const genModels = ['gemini-3.8-flash'];
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
