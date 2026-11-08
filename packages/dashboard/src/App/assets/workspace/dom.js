export const $ = id => document.getElementById(id);
export function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}
export function button(label, handler, className = '') {
  const element = el('button', className, label); element.type = 'button'; element.addEventListener('click', handler); return element;
}
