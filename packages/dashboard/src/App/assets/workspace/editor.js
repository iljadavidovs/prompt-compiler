/** Small replaceable native editor. Programmatic replacement is only for opening a different document. */
export function createEditor(textarea, onChange) {
  const listener = () => onChange(textarea.value);
  textarea.addEventListener('input', listener);
  return {
    read: () => textarea.value,
    open: content => { textarea.value = content; textarea.scrollTop = 0; },
    focus: () => textarea.focus(),
    dispose: () => textarea.removeEventListener('input', listener),
  };
}
