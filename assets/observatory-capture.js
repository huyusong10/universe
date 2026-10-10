import { TARGET_NOTES, describeTarget } from './observatory-guide.js?v=cosmic-explore-20261010gu';

const TEXT = {
  en: { science: 'Scientific reference', observation: 'Activity reference', map: 'Map', shape: 'Shape', sky: 'Sky imagery', references: 'Target references', subject: 'Subject assets', scene: 'Other scene assets', family: 'Scene assets', scope: 'Conservative attribution includes neighbouring bodies that may be partly or fully obscured.', representation: 'About this view' },
  zh: { science: '科学资料', observation: '活动观测依据', map: '底图', shape: '形状依据', sky: '天幕图像', references: '目标资料', subject: '主体素材', scene: '其他场景素材', family: '场景素材', scope: '为保留素材归属，包含可能被部分或完全遮挡的邻体。', representation: '关于这幅画面' }
};
// These two guides have no map field. Attribution follows the existing asset
// provenance; the images are historical composites, not current observations.
const MAP_REFERENCES = {
  earth: { label: 'NASA Earth Observatory / NASA GSFC · Blue Marble; Reto Stöckli, MODIS atmosphere team, Robert Simmon', urls: ['https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/', 'https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/'] },
  moon: { label: 'NASA Scientific Visualization Studio / LRO · Ernie Wright (USRA), Noah Petro (NASA/GSFC), LROC / LOLA', urls: ['https://svs.gsfc.nasa.gov/4720/'] }
};
const MAP_LICENSE = { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
const SHAPE_LICENSE = { label: 'CC BY-SA 3.0 IGO', url: 'https://creativecommons.org/licenses/by-sa/3.0/igo/' };

// Science concerns the observed identity, including during travel. Asset
// attribution is conservative: a projected candidate can have a hidden centre
// and a visible edge. Never silently promote its map into the subject's map.
export function observationSources(view, language = 'en') {
  const locale = language === 'zh' ? 'zh' : 'en';
  const observed = describeTarget(view.observed, locale);
  const singleSubject = view.scaleStage !== 'Galactic' && !(view.systemView?.visible && !view.systemView.pending);
  const references = [];
  const row = (note, kind, label, urls, license) => ({ kind, target: note.target, name: note.name, label, urls, ...(license ? { license } : {}) });
  if (observed.sourceUrl) references.push(row(observed, 'science', observed.sourceLabel, [observed.sourceUrl]));
  if (observed.observationSourceUrl) references.push(row(observed, 'observation', observed.observationSourceLabel, [observed.observationSourceUrl]));
  const maps = new Set(view.mapBodies || []);
  const shapes = new Set(view.shapeTargets || []);
  const subjectAssets = [], sceneAssets = [];
  const seen = new Set();
  for (const entry of TARGET_NOTES) {
    if ((!maps.has(entry.key) && !shapes.has(entry.target)) || seen.has(entry.target)) continue;
    seen.add(entry.target);
    const note = describeTarget(entry.target, locale);
    const assets = [];
    if (maps.has(note.key)) {
      const source = MAP_REFERENCES[note.key] || (note.mapSourceUrl ? { label: note.mapSourceLabel, urls: [note.mapSourceUrl] } : null);
      if (source) assets.push(row(note, 'map', source.label, source.urls, note.mapSourceUrl === 'https://www.solarsystemscope.com/textures/' ? MAP_LICENSE : null));
    }
    if (shapes.has(note.target) && note.shapeSourceUrl) assets.push(row(note, 'shape', note.shapeSourceLabel, [note.shapeSourceUrl], note.target === '67P/Churyumov-Gerasimenko' ? SHAPE_LICENSE : null));
    (singleSubject && note.target === view.observed ? subjectAssets : sceneAssets).push(...assets);
  }
  const sky = { kind: 'sky', label: '100,000 Stars / Chrome Experiments', urls: ['https://stars.chromeexperiments.com/'] };
  return { references, subjectAssets, sceneAssets, sky, singleSubject };
}
function sourceLines(source, text) {
  return [`${text[source.kind]}${source.name ? ` · ${source.name}` : ''}`, source.label, ...source.urls,
    ...(source.license ? [`${source.license.label} · ${source.license.url}`] : [])];
}
function sourceGroups(sources, text) {
  return [
    { heading: text.references, rows: sources.references },
    { heading: text.subject, rows: sources.subjectAssets },
    { heading: sources.singleSubject ? text.scene : text.family, note: sources.sceneAssets.length ? text.scope : '', rows: sources.sceneAssets },
    { rows: [sources.sky] }
  ].filter(group => group.rows.length);
}
export function observationSourceDescription(sources, language = 'en') {
  const text = TEXT[language === 'zh' ? 'zh' : 'en'];
  return sourceGroups(sources, text).map(group => [group.heading, group.note, ...group.rows.map(row => sourceLines(row, text).join('\n'))].filter(Boolean).join('\n')).join('\n\n');
}

// Compose a local keepsake from an actual rendered frame at its existing
// resolution. The source sections belong to the output, never the live scene.
export async function createObservationImage(bitmap, content, language = 'en') {
  const width = bitmap.width, height = bitmap.height;
  const scale = Math.max(1, Math.min(1.5, width / 1280));
  const margin = Math.round(32 * scale), available = width - margin * 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const text = TEXT[language === 'zh' ? 'zh' : 'en'];
  const sans = '"Avenir Next", "PingFang SC", sans-serif';
  const bodyFont = `${Math.round(15 * scale)}px ${sans}`;
  const smallFont = `${Math.round(13 * scale)}px ${sans}`;
  const sourceFont = `${Math.round(15 * scale)}px ${sans}`;
  const titleFont = `${Math.round(38 * scale)}px "Iowan Old Style", "Songti SC", Georgia, serif`;
  let lineWidth = available;
  function lines(value, font) {
    context.font = font;
    const tokens = language === 'zh' ? Array.from(value || '') : (value || '').match(/\S+\s*|\s+/gu) || [];
    const output = [];
    let line = '';
    for (const token of tokens) {
      if (context.measureText(line + token).width <= lineWidth) { line += token; continue; }
      if (line.trim()) { output.push(line.trimEnd()); line = ''; }
      if (context.measureText(token).width <= lineWidth) { line = token.trimStart(); continue; }
      // A URL or long name must wrap rather than escape the image or shrink
      // the entire title. Code points preserve non-BMP characters.
      for (const character of token) {
        if (line && context.measureText(line + character).width > lineWidth) { output.push(line.trimEnd()); line = ''; }
        line += character;
      }
    }
    if (line.trim()) output.push(line.trimEnd());
    return output;
  }
  const blocks = [];
  let currentBlocks = blocks;
  function paragraph(value, font, colour, leading, after = 0) {
    const wrapped = lines(value, font);
    if (wrapped.length) currentBlocks.push({ lines: wrapped, font, colour, leading: Math.round(leading * scale), after: Math.round(after * scale) });
  }
  const rule = () => currentBlocks.push({ rule: true, leading: Math.round(26 * scale) });
  paragraph('U N I V E R S E', smallFont, '#cbb996', 24, 2);
  paragraph(content.title, titleFont, '#eee9df', 47, 7);
  paragraph(content.context, bodyFont, '#d0c9ba', 24, 7);
  paragraph(content.location || '', smallFont, '#aebcce', 21, 2);
  rule();
  paragraph(text.representation, smallFont, '#cbb996', 24, 3);
  paragraph(content.note, bodyFont, '#bcc4cd', 24, 8);
  const columns = Array.from({ length: width >= 960 ? 2 : 1 }, () => []);
  const gap = Math.round(38 * scale);
  const columnWidth = (available - gap * (columns.length - 1)) / columns.length;
  const blockHeight = list => list.reduce((total, block) => total + (block.rule ? block.leading : block.lines.length * block.leading + block.after), 0);
  function useColumn(index) { currentBlocks = columns[index]; lineWidth = columnWidth; }
  function heading(group) {
    rule();
    if (group.heading) paragraph(group.heading, smallFont, '#cbb996', 24, 4);
    if (group.note) paragraph(group.note, smallFont, '#98a7ba', 21, 9);
  }
  function sourceRow(source) {
    const [label, credit, ...links] = sourceLines(source, text);
    paragraph(label, bodyFont, '#e0dfd8', 24, 1);
    paragraph(credit, sourceFont, '#b1bdcc', 23, 1);
    for (const link of links) paragraph(link, smallFont, '#98a7ba', 21, 1);
    currentBlocks[currentBlocks.length - 1].after += Math.round(10 * scale);
  }
  const shortestColumn = () => columns.length === 1 || blockHeight(columns[0]) <= blockHeight(columns[1]) ? 0 : 1;
  if (content.sources) {
    const groups = sourceGroups(content.sources, text);
    for (const group of groups) {
      if (group.rows === content.sources.sceneAssets) {
        // Keep attribution to each body together. A large family can fill both
        // columns; repeat its scope heading where needed, rather than shrinking.
        const started = new Set();
        for (const source of group.rows) {
          const index = shortestColumn(); useColumn(index);
          if (!started.has(index)) { heading(group); started.add(index); }
          sourceRow(source);
        }
      } else {
        useColumn(group.rows[0].kind === 'sky' ? shortestColumn() : 0);
        heading(group);
        for (const source of group.rows) sourceRow(source);
      }
    }
  } else if (content.credit) {
    useColumn(0); rule();
    paragraph(content.credit, sourceFont, '#b1bdcc', 23);
  }
  const footer = margin * 2 + blockHeight(blocks) + Math.max(...columns.map(blockHeight));
  canvas.width = width;
  canvas.height = height + footer;
  context.fillStyle = '#070b13';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  context.textBaseline = 'top';
  function draw(list, x, startY, lineLength) {
    let y = startY;
    for (const block of list) {
      if (block.rule) {
        context.fillStyle = '#aebcce26';
        context.fillRect(x, y + Math.round(6 * scale), lineLength, 1);
        y += block.leading;
      } else {
        context.font = block.font;
        context.fillStyle = block.colour;
        for (const line of block.lines) { context.fillText(line, x, y); y += block.leading; }
        y += block.after;
      }
    }
  }
  draw(blocks, margin, height + margin, available);
  columns.forEach((column, index) => draw(column, margin + index * (columnWidth + gap), height + margin + blockHeight(blocks), columnWidth));
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png'));
  canvas.width = canvas.height = 1;
  return blob;
}
