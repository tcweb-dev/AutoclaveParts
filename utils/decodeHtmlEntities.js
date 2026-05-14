'use strict';

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function decodeHtmlEntities(value) {
  if (typeof value !== 'string' || !value.includes('&')) return value;

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, token) => {
    if (token[0] === '#') {
      const isHex = token[1]?.toLowerCase() === 'x';
      const digits = isHex ? token.slice(2) : token.slice(1);
      const radix = isHex ? 16 : 10;
      const codePoint = Number.parseInt(digits, radix);
      if (Number.isNaN(codePoint)) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }

    const key = token.toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
      ? NAMED_ENTITIES[key]
      : match;
  });
}
