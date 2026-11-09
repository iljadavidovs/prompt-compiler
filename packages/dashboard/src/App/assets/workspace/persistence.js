const key = projectId => `pcr.playground.recovery.v1:${projectId}`;
export function remember(projectId, draft) {
  // Never use the recovery store for credential-shaped text.
  if (/\bsk-[a-zA-Z0-9_-]{16,}|\b(?:password|passwd|secret|token|api_key)\s*[:=]\s*\S+/i.test(JSON.stringify(draft))) { forget(projectId); return; }
  localStorage.setItem(key(projectId), JSON.stringify(draft));
}
export function recover(projectId) {
  const raw = localStorage.getItem(key(projectId));
  if (!raw) return null;
  const data = JSON.parse(raw);
  return data && typeof data.id === 'string' && typeof data.content === 'string' && typeof data.title === 'string' && Array.isArray(data.bindings) && Number.isInteger(data.revision) ? data : null;
}
export function forget(projectId) { localStorage.removeItem(key(projectId)); }
export function readBudget() { const value = Number(localStorage.getItem('pcr.playground.budget.v1')); return value >= 256 && value <= 32000 ? value : 6000; }
export function saveBudget(value) {
  if (!Number.isSafeInteger(value) || value < 256 || value > 32000) throw new Error('Use a whole number between 256 and 32,000.');
  localStorage.setItem('pcr.playground.budget.v1', String(value));
}

export function rememberActive(projectId, id) { localStorage.setItem(`pcr.playground.active.v1:${projectId}`, id); }
export function activeDraft(projectId) { return localStorage.getItem(`pcr.playground.active.v1:${projectId}`); }
