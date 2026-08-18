// 富文本 HTML 净化器（DOM 白名单方式，无第三方依赖）
// 移除危险元素/事件属性/危险协议，仅保留常见富文本标签
const BLOCKED_ELEMENTS = 'script,iframe,object,embed,form,input,button,textarea,select,link,meta,style,base';

export function sanitizeHtml(value) {
  if (value == null) return '';
  const template = document.createElement('template');
  template.innerHTML = String(value);
  template.content.querySelectorAll(BLOCKED_ELEMENTS).forEach((el) => el.remove());
  template.content.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = (attr.value || '').trim();
      if (name.startsWith('on') || name === 'style') {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src') && val) {
        try {
          const parsed = new URL(val, window.location.origin);
          if (!['http:', 'https:', 'mailto:', 'tel:', 'data:'].includes(parsed.protocol)) {
            el.removeAttribute(attr.name);
          } else if (parsed.protocol === 'data:' && !/^data:image\/(png|jpe?g|gif|webp);/i.test(val)) {
            el.removeAttribute(attr.name);
          }
        } catch (e) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });
  return template.innerHTML;
}
