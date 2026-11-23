(function () {
  const htmlNamespace = 'http://www.w3.org/1999/xhtml';
  const elements = new Set(('a b blockquote br caption code col colgroup dd del div dl dt em ' +
    'figcaption figure h1 h2 h3 h4 h5 h6 hr i img li ol p pre s small span strike strong sub sup ' +
    'table tbody td th thead tfoot tr u ul').split(' '));
  const quillClass = /^ql-(?:align-(?:center|right|justify)|indent-[1-8]|direction-rtl|font-(?:serif|monospace)|size-(?:small|large|huge)|syntax)$/;

  function safeUrl(value, image, inlineImages) {
    if (!value) return false;
    if (image && inlineImages && /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) return true;
    try {
      const protocol = new URL(value, document.baseURI).protocol;
      return protocol === 'https:' || protocol === 'http:' || (!image && (protocol === 'mailto:' || protocol === 'tel:'));
    } catch {
      return false;
    }
  }

  function copyContent(input, output, inlineImages) {
    for (const child of input.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        output.append(document.createTextNode(child.data));
        continue;
      }
      if (child.namespaceURI !== htmlNamespace || !elements.has(child.localName)) continue;
      const element = document.createElement(child.localName);
      const classes = [...child.classList].filter(value => quillClass.test(value));
      if (classes.length) element.className = classes.join(' ');
      if (child.localName === 'a') {
        const href = child.getAttribute('href');
        if (safeUrl(href, false, false)) element.setAttribute('href', href);
        if (href && element.hasAttribute('href') && child.getAttribute('target') === '_blank') {
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
        }
      }
      if (child.localName === 'img') {
        const src = child.getAttribute('src');
        if (!safeUrl(src, true, inlineImages)) continue;
        element.setAttribute('src', src);
        element.alt = child.getAttribute('alt') || '';
      }
      copyContent(child, element, inlineImages);
      output.append(element);
    }
  }

  window.LeapRichText = function sanitizeRichText(value, { inlineImages = false } = {}) {
    const input = document.createElement('template');
    input.innerHTML = String(value ?? '');
    const output = document.createElement('template');
    copyContent(input.content, output.content, inlineImages);
    return output.innerHTML;
  };
})();
