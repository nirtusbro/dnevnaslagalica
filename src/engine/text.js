// Text normalisation shared by Slagalica and Asocijacije answers.

/**
 * Upper-case, strip diacritics (Č/Ć→C, Š→S, Ž→Z, Đ→DJ), drop anything that is not
 * A–Z or space, collapse whitespace. Both the player's input and the accepted
 * answers go through this, so "noć", "NOC" and "Noć " all match.
 */
export function normalize(s) {
  return (s || '')
    .toUpperCase()
    .replace(/[ČĆ]/g, 'C')
    .replace(/Š/g, 'S')
    .replace(/Ž/g, 'Z')
    .replace(/Đ/g, 'DJ')
    .replace(/DŽ/g, 'DZ')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keyboard key → letter of the Serbian Latin alphabet, as shown on tiles. */
export function keyToLetter(key) {
  if (!key || key.length !== 1) return null;
  const u = key.toUpperCase();
  return /^[A-ZČĆŠŽĐ]$/.test(u) ? u : null;
}
