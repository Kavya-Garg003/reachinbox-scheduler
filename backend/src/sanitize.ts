import sanitizeHtml from 'sanitize-html';

const OPTS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ul', 'ol', 'li', 'blockquote', 'a', 'h1', 'h2', 'h3', 'font'],
  allowedAttributes: { a: ['href', 'target', 'rel'], font: ['size'], '*': ['style', 'align'] },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      'margin-left': [/^\d+(px|em|rem)$/],
      'padding-left': [/^\d+(px|em|rem)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
};

/** Email bodies are rich text (HTML) from the editor: strip anything that isn't simple formatting. */
export function cleanHtml(input: string): string {
  const withBreaks = /<[a-z][\s\S]*>/i.test(input) ? input : input.replace(/\r?\n/g, '<br>'); // plain-text API callers
  return sanitizeHtml(withBreaks, OPTS);
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function htmlToText(html: string): string {
  const spaced = html.replace(/<\/(p|div|li|blockquote|h[1-3])>|<br\s*\/?>/gi, '\n');
  return decode(sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })).replace(/\n{3,}/g, '\n\n').trim();
}

export const previewOf = (html: string) => htmlToText(html).replace(/\s+/g, ' ').slice(0, 200);
