import JSZip from 'jszip';

const SLIDE_RE = /^ppt\/slides\/slide(\d+)\.xml$/;
const NOTES_SLIDE_RE = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/;

export function isPptxPreview(preview) {
  if (!preview) return false;
  const mime = (preview.mime_type || '').toLowerCase();
  const name = preview.content_path || preview.title || '';
  return /presentationml/.test(mime) || /\.pptx$/i.test(name);
}

async function notesText(zip, notesPath) {
  const file = zip.files[notesPath];
  if (!file) return '';
  const xml = await file.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const lines = [];
  for (const el of Array.from(doc.getElementsByTagName('a:t'))) {
    if (isSlideNumberPlaceholder(el)) continue;
    const text = (el.textContent || '').trim();
    if (text) lines.push(text);
  }
  return lines.join('\n').trim();
}

function isSlideNumberPlaceholder(textEl) {
  let node = textEl.parentElement;
  while (node) {
    const type = node.getAttribute?.('type');
    if (type === 'sldNum') return true;
    node = node.parentElement;
  }
  return false;
}

export async function extractPptxNotes(blob) {
  const zip = await JSZip.loadAsync(blob);
  const notesByName = new Map();
  for (const path of Object.keys(zip.files)) {
    const m = path.match(NOTES_SLIDE_RE);
    if (m) notesByName.set(m[1], path);
  }
  const bySlide = new Map();
  const slides = Object.keys(zip.files).filter((p) => SLIDE_RE.test(p));
  for (const slidePath of slides) {
    const slideNum = slidePath.match(SLIDE_RE)[1];
    let notesNum = null;
    const relsPath = slidePath
      .replace('ppt/slides/', 'ppt/slides/_rels/')
      .replace('.xml', '.xml.rels');
    const relsFile = zip.files[relsPath];
    if (relsFile) {
      const relsXml = await relsFile.async('string');
      const doc = new DOMParser().parseFromString(relsXml, 'application/xml');
      for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
        const type = rel.getAttribute('Type') || '';
        const target = rel.getAttribute('Target') || '';
        if (type.endsWith('/notesSlide')) {
          const m = target.match(/notesSlide(\d+)\.xml$/);
          if (m) notesNum = m[1];
        }
      }
    }
    if (notesNum == null) notesNum = slideNum;
    const notesPath = notesByName.get(notesNum);
    if (!notesPath) continue;
    const text = await notesText(zip, notesPath);
    if (text) bySlide.set(Number(slideNum), text);
  }
  return bySlide;
}