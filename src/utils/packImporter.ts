import JSZip from 'jszip';
import { AddonComponent } from '../types/addon';

export interface ImportResult {
  projectName?: string;
  description?: string;
  components: AddonComponent[];
}

export async function importAddonFile(file: File): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();

  // 1. Single JSON file import
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    let type: AddonComponent['type'] = 'other';
    let identifier = file.name.replace('.json', '');
    let name = identifier;

    try {
      const parsed = JSON.parse(text);
      if (parsed['minecraft:item']) {
        type = 'item';
        identifier = parsed['minecraft:item'].description?.identifier || identifier;
        name = parsed['minecraft:item'].components?.['minecraft:display_name']?.value || identifier;
      } else if (parsed['minecraft:entity']) {
        type = 'entity';
        identifier = parsed['minecraft:entity'].description?.identifier || identifier;
        name = identifier;
      } else if (parsed['minecraft:block']) {
        type = 'block';
        identifier = parsed['minecraft:block'].description?.identifier || identifier;
        name = identifier;
      } else if (parsed['minecraft:recipe_shaped'] || parsed['minecraft:recipe_shapeless']) {
        type = 'recipe';
        identifier = parsed['minecraft:recipe_shaped']?.description?.identifier || 
                     parsed['minecraft:recipe_shapeless']?.description?.identifier || identifier;
        name = identifier;
      }
    } catch {}

    return {
      projectName: file.name.replace('.json', ''),
      components: [
        {
          id: `comp-${Date.now()}`,
          type,
          name: typeof name === 'string' ? name.replace(/§[0-9a-fk-or]/g, '') : identifier,
          identifier,
          filePath: `${type === 'other' ? '' : type + 's/'}${file.name}`,
          contentJson: text,
        },
      ],
    };
  }

  // 2. .mcaddon / .mcpack / .zip archive import
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const components: AddonComponent[] = [];
  let foundName = file.name.replace(/\.(mcaddon|mcpack|zip)$/i, '');
  let foundDesc = '';

  const fileEntries = Object.keys(loadedZip.files);

  for (const relativePath of fileEntries) {
    const zipEntry = loadedZip.files[relativePath];
    if (zipEntry.dir) continue;

    // Check manifest.json
    if (relativePath.endsWith('manifest.json')) {
      try {
        const manifestText = await zipEntry.async('text');
        const manifest = JSON.parse(manifestText);
        if (manifest.header?.name) {
          foundName = manifest.header.name.replace(/§[0-9a-fk-or]/g, '');
        }
        if (manifest.header?.description) {
          foundDesc = manifest.header.description.replace(/§[0-9a-fk-or]/g, '');
        }
      } catch {}
    }

    // Inspect json files in behavior pack
    if (relativePath.endsWith('.json') && !relativePath.endsWith('manifest.json')) {
      try {
        const text = await zipEntry.async('text');
        const parsed = JSON.parse(text);

        let type: AddonComponent['type'] = 'other';
        let identifier = relativePath.split('/').pop()?.replace('.json', '') || 'unknown';
        let name = identifier;

        if (parsed['minecraft:item']) {
          type = 'item';
          identifier = parsed['minecraft:item'].description?.identifier || identifier;
          name = parsed['minecraft:item'].components?.['minecraft:display_name']?.value || identifier;
        } else if (parsed['minecraft:entity']) {
          type = 'entity';
          identifier = parsed['minecraft:entity'].description?.identifier || identifier;
          name = identifier;
        } else if (parsed['minecraft:block']) {
          type = 'block';
          identifier = parsed['minecraft:block'].description?.identifier || identifier;
          name = identifier;
        } else if (parsed['minecraft:recipe_shaped'] || parsed['minecraft:recipe_shapeless']) {
          type = 'recipe';
          identifier = parsed['minecraft:recipe_shaped']?.description?.identifier || 
                       parsed['minecraft:recipe_shapeless']?.description?.identifier || identifier;
          name = identifier;
        }

        components.push({
          id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type,
          name: typeof name === 'string' ? name.replace(/§[0-9a-fk-or]/g, '') : identifier,
          identifier,
          filePath: relativePath,
          contentJson: text,
        });
      } catch {}
    }
  }

  return {
    projectName: foundName,
    description: foundDesc,
    components,
  };
}
