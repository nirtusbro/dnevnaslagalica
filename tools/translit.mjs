// Serbian Cyrillic → Latin transliteration (Wikidata `sr` labels are Cyrillic).
const MAP = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Ђ: 'Đ', Е: 'E', Ж: 'Ž', З: 'Z', И: 'I', Ј: 'J', К: 'K', Л: 'L', Љ: 'Lj', М: 'M',
  Н: 'N', Њ: 'Nj', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', Ћ: 'Ć', У: 'U', Ф: 'F', Х: 'H', Ц: 'C', Ч: 'Č', Џ: 'Dž', Ш: 'Š',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};

export function toLatin(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const m = MAP[ch];
    if (m == null) { out += ch; continue; }
    // Keep digraphs upper-case when the next letter is upper-case too (ЉУБ → LJUB).
    if (m.length === 2 && ch === ch.toUpperCase() && s[i + 1] && s[i + 1] === s[i + 1].toUpperCase() && /[А-Яа-яЂђЉљЊњЋћЏџЈј]/.test(s[i + 1])) out += m.toUpperCase();
    else out += m;
  }
  return out;
}

export const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(s);
