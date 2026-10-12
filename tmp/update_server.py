import re

with open("server.ts", "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "// PURE AI 1024x1024 Ultra-HD Vector & Texture Synthesis Engine"
end_marker = "// Ensure alias exists for all callers"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Error: Markers not found ({start_idx}, {end_idx})")
    exit(1)

new_func = '''// PURE AI 1024x1024 Ultra-HD Vector & Texture Synthesis Engine
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

  const systemPrompt = `You are a world-class AAA Game Concept Artist & Technical SVG Master specializing in breathtaking game assets (Minecraft blocks, weapons, tools, armor, items).
Your mission: Hand-craft a jaw-dropping, ultra-high-definition 1024x1024 vector game asset strictly matching the user's concept: "${prompt}".

CRITICAL DESIGN INTELLIGENCE & ZERO SUBJECT BIAS:
- BLOCK / CUBE (方塊 / 立方體):
  * If the user asks for a block or cube (e.g. "一個帥氣的方塊", "未來科技方塊", "熔岩黑曜石方塊"), you MUST render a jaw-dropping 3D ISOMETRIC MINECRAFT BLOCK/CUBE!
  * Display all 3 visible isometric faces: Top Face, Left Face, and Right Face, with distinct isometric shading and lighting angles.
  * Layer each face with hyper-detailed textures: futuristic neon circuitry, glowing magma fissures, crystalline inlays, beveled metallic/obsidian borders, deep ambient occlusion, and particle sparkles.
  * NEVER draw a sword or tool when the user asks for a block/cube!
- PICKAXE / MINING TOOL (鎬子 / 稿子 / 採礦神器):
  * Render an unmistakable, legendary mining pickaxe: arched dual-horn or crescent pick head with chisel cutting tips, heavy center forged socket, and long battle haft.
- WEAPON / SWORD (劍 / 刀 / 斧 / 弓):
  * Render the exact requested weapon type with razor-sharp edges, ornate crossguards, wrapped hilt, and trailing elemental aura.
- ARMOR / SHIELD / RELIC / ITEM (防具 / 盾牌 / 聖物 / 藥水 / 物品):
  * Faithfully render the specific requested subject with volumetric depth, ambient occlusion, specular highlights, and thematic magical aura.

MANDATORY 1024x1024 SVG CRAFTSMANSHIP:
1. Root tag MUST be <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">.
2. Canvas Transparency: DO NOT render any full-canvas opaque solid background rectangle (<rect width="1024" height="1024"...> is forbidden). Keep canvas transparent so the item/block can be cleanly used in Minecraft.
3. Color Palette & Lighting Depth:
   - Define at least 10 rich <linearGradient> and <radialGradient> definitions in <defs>.
   - Each gradient MUST have 4 to 6 color stops for realistic material specular physics (deep shadow, core mid-tone, emissive bloom, razor specular highlight).
   - Include <filter id="glow"> with <feGaussianBlur stdDeviation="8" result="blur"/> and <feMerge>.
4. Zero boring/primitive flat shapes: Use complex Bézier paths, faceted polygons, glowing runes, and layered specular highlights.

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
${previousSvg ? `請以此先前的 SVG 造型為基礎進行進化與昇華重構:\n${previousSvg.substring(0, 1500)}...` : ''}
請以此昇華創造出全新的 1024x1024 超高畫質神級圖標。`
    : `請為以下主題生成 1024x1024 超高畫質神級圖標: "${prompt}"`;

  const models = ['gemini-3.8-flash', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      console.log(`[AI 1024 Engine] Calling model ${model} for: "${prompt}"...`);
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
          rawText = rawText.replace(/^```[a-z]*\\n?/i, '').replace(/\\n?```$/i, '').trim();
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const svgMatch = rawText.match(/<svg[\\s\\S]*<\\/svg>/);
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
            const match = svg.match(/<svg[\\s\\S]*<\\/svg>/);
            if (match) svg = match[0];
          }

          // Strip any full-screen opaque rectangles that cover the background
          svg = svg.replace(/<rect\\s+width="1024"\\s+height="1024"[^>]*\\/>/gi, '');
          svg = svg.replace(/<rect\\s+fill="[^"]*"\\s+width="1024"\\s+height="1024"[^>]*\\/>/gi, '');
          svg = svg.replace(/<rect[^>]*width="100%"[^>]*height="100%"[^>]*\\/>/gi, '');

          // Ensure proper attributes
          if (!svg.includes('viewBox=')) {
            svg = svg.replace('<svg', '<svg viewBox="0 0 1024 1024" width="1024" height="1024"');
          }

          const rawName = (parsed.name || prompt).toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 28) || 'custom_item';
          const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

          console.log(`[AI 1024 Engine] Successfully generated: ${rawName} (${svg.length} bytes SVG)`);

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

  // 100% PURE AI: Strictly comply with user rule (絕對不可以使用已經寫好的程式來冒充AI生成的圖片)
  throw lastErr || new Error('AI 生成暫時繁忙或回應異常，請稍後重試');
}

'''

content = content[:start_idx] + new_func + content[end_idx:]
with open("server.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: server.ts updated with Pure AI engine!")
