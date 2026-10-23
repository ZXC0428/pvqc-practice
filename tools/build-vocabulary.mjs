import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const source = 'C:\\Users\\User\\Downloads\\PVQC商業與管理_詞彙庫_Word表格.docx';
const xml = execFileSync('tar', ['-xOf', source, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const rows = [...xml.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map(([, row]) =>
  [...row.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)].map(([, cell]) =>
    [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(([, text]) => text).join('').trim(),
  ),
);
const vocabulary = rows
  .filter((cells) => /^\d+$/.test(cells[0] ?? '') && cells.length >= 4)
  .map(([id, english, chinese, partOfSpeech]) => ({ id: Number(id), english, chinese, partOfSpeech }));

if (vocabulary.length < 100) throw new Error(`Only found ${vocabulary.length} vocabulary rows.`);
writeFileSync('js/vocabulary.js', `// Generated from the supplied PVQC vocabulary document.\nwindow.PVQC_VOCABULARY = ${JSON.stringify(vocabulary)};\n`, 'utf8');
console.log(`Created js/vocabulary.js with ${vocabulary.length} entries.`);
