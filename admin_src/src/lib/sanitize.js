import '../../../js/rich-text.js';

export function sanitizeHtml(value) {
  return window.LeapRichText(value, { inlineImages: true });
}
