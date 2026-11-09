import { api, download } from './api.js';
import { createEditor } from './editor.js';
import { remember, recover, forget, readBudget, saveBudget, rememberActive, activeDraft } from './persistence.js';
import { $, el, button } from './dom.js';
import { sourcePanel, inspectPanel, mountPanel } from './panels.js';

const state = { workspace: null, draft: null, saved: '', result: null, resultInput: '', resultSignature: '', panel: 'prompt', collection: 'library', filter: 'all', busy: false, saving: false, requestId: null, requestSkip: false, error: '', budget: readBudget() };
const roles = ['background', 'requirement', 'criteria', 'example', 'goal', 'schedule', 'preference'];
const panels = [sourcePanel, inspectPanel];
let panelCleanup = () => {};
let noticeTimer;
const snapshot = draft => JSON.stringify({ title: draft.title, content: draft.content, bindings: draft.bindings, derivedFrom: draft.derivedFrom });
const signature = () => JSON.stringify([snapshot(state.draft), state.budget]);
const dirty = () => state.draft && snapshot(state.draft) !== state.saved;
function notify(message, error = false) {
  if (error && $('dialog').open) { $('dialog-error').textContent = message; $('dialog-error').hidden = false; return; }
  $('notice').textContent = message; $('notice').className = `notice${error ? ' error' : ''}`; $('notice').hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, error ? 14000 : 4500);
}
const guarded = fn => async (...args) => { try { await fn(...args); } catch (error) { notify(error.message, true); } };
const editor = createEditor($('request'), content => { state.draft.content = content; changed(); });
function changed() {
  state.requestId = null; state.error = '';
  try { remember(state.workspace.projectId, state.draft); } catch { notify('Browser recovery is unavailable. Save explicitly before closing this page.', true); }
  status();
}
function status() {
  $('save-status').textContent = state.saving ? 'Saving…' : dirty() ? 'Unsaved changes' : state.draft.revision ? 'Saved locally' : 'New draft';
  $('save-status').classList.toggle('dirty', dirty());
  $('save-draft').disabled = state.saving;
  $('draft-breadcrumb').textContent = state.draft.title || 'Untitled';
  $('draft-origin').textContent = state.draft.derivedFrom ? 'From compilation' : 'Local document';
  $('word-count').textContent = `${state.draft.content.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words`;
  $('compile').disabled = state.busy || !state.draft.content.trim();
  $('compile').textContent = state.busy ? 'Compiling…' : 'Compile ↗';
  document.querySelector('.output-pane').setAttribute('aria-busy', String(state.busy));
  if (state.error) {
    $('result-state').textContent = 'Compilation failed · draft preserved';
    $('result-banner').hidden = false; $('result-banner').className = 'result-banner error'; $('result-banner').textContent = state.error;
  } else if (state.result) {
    const stale = state.resultSignature && state.resultSignature !== signature();
    const warnings = state.result.metadata.warnings || [];
    $('result-state').textContent = state.busy ? 'Compiling locally…' : stale ? 'Draft or settings changed · earlier result' : state.result.metadata.skipped ? 'Skipped · original input preserved' : `Compiled locally · ${state.result.metadata.selectedToolId} · ~${state.result.metadata.tokenEstimate.toLocaleString()} tokens`;
    $('result-banner').hidden = !stale && !warnings.length;
    $('result-banner').textContent = stale ? 'This result is unchanged. Compile again to include your latest edits, selection and tool settings.' : warnings.join(' ');
  } else { $('result-state').textContent = state.busy ? 'Compiling locally…' : 'Ready when you are'; $('result-banner').hidden = true; }
}
async function refreshWorkspace() { state.workspace = await api('/workspace'); renderLibrary(); renderBindings(); }
async function save() {
  if (state.saving) return;
  state.saving = true; status();
  const draft = structuredClone(state.draft);
  try {
    const saved = await api('/drafts', { draft, expectedRevision: draft.revision });
    if (state.draft.id === draft.id) { state.draft.revision = saved.revision; state.saved = snapshot(draft); }
    if (!dirty()) forget(state.workspace.projectId);
    await refreshWorkspace(); notify('Draft saved on this Mac.');
  } finally { state.saving = false; status(); }
}
async function preserveDraft() { if (dirty()) await save(); if (dirty()) throw new Error('Finish saving before switching drafts.'); }
async function openDraft(draft, saved = true, duplicatedCurrent = false) {
  if (!duplicatedCurrent) await preserveDraft();
  state.draft = structuredClone(draft); state.saved = saved ? snapshot(draft) : ''; state.requestId = null; state.error = '';
  try { rememberActive(state.workspace.projectId, draft.id); } catch { /* Explicit saves still work without browser preferences. */ }
  $('draft-title').value = draft.title; editor.open(draft.content); renderBindings(); status();
  $('workspace').classList.remove('rail-open'); location.hash = 'playground'; focusView('draft'); renderLibrary(); editor.focus();
  if (!saved) changed();
  if (duplicatedCurrent) notify('Created an independent copy. Save to keep your recovered edit.');
}
function blank(content = '', title = 'Untitled', bindings = [], derivedFrom) {
  return { id: `draft-${crypto.randomUUID()}`, revision: 0, title, content, bindings: structuredClone(bindings), derivedFrom };
}
function renderLibrary() {
  const list = $('library-list'); list.replaceChildren();
  document.querySelectorAll('[data-type]').forEach(control => (control.classList.toggle('active', control.dataset.type === state.filter), control.setAttribute('aria-pressed', String(control.dataset.type === state.filter))));
  $('browse-library').setAttribute('aria-pressed', String(state.collection === 'library')); $('browse-drafts').setAttribute('aria-pressed', String(state.collection === 'drafts'));
  $('browse-library').classList.toggle('active', state.collection === 'library'); $('browse-drafts').classList.toggle('active', state.collection === 'drafts');
  $('filters').hidden = state.collection !== 'library'; $('collection-label').textContent = state.collection === 'library' ? 'YOUR COLLECTION' : 'SAVED DRAFTS';
  const query = $('search').value.toLowerCase().trim();
  const source = state.collection === 'library' ? state.workspace.items.filter(item => !item.archived) : state.workspace.drafts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const items = source.filter(item => (state.collection !== 'library' || state.filter === 'all' || item.type === state.filter) && `${item.title} ${item.purpose || ''} ${(item.tags || []).join(' ')} ${item.content}`.toLowerCase().includes(query));
  $('library-count').textContent = items.length;
  if (!items.length) list.append(el('p', 'rail-empty', query ? 'No matching items. Try another search.' : state.collection === 'library' ? 'Your library is empty. Import a collection or keep a draft.' : 'Saved drafts will appear here.'));
  items.forEach(item => {
    const selected = state.collection === 'drafts' ? item.id === state.draft.id : state.draft.bindings.some(binding => binding.id === item.id && binding.enabled);
    const entry = button('', guarded(() => state.collection === 'library' ? previewItem(item) : openDraft(item)), `library-item${selected ? ' selected' : ''}`);
    entry.append(el('span', 'item-icon', item.type === 'context' ? '≡' : item.type === 'criteria' ? '✓' : '↗'));
    const copy = el('span', 'item-copy'); copy.append(el('span', 'item-title', item.title), el('span', 'item-subtitle', item.tags?.slice(0, 2).join(' · ') || `Draft · revision ${item.revision}`)); entry.append(copy); list.append(entry);
  });
}
function renderBindings() {
  const area = $('bindings'); const focusedControl = document.activeElement?.dataset.bindingControl; area.replaceChildren();
  $('context-count').textContent = state.draft.bindings.filter(binding => binding.enabled).length;
  if (!state.draft.bindings.length) area.append(el('p', 'context-empty', 'Choose context from the library. Nothing else is retrieved.'));
  state.draft.bindings.forEach((binding, index) => {
    const item = state.workspace.items.find(candidate => candidate.id === binding.id && !candidate.archived);
    const stale = !item || item.revision !== binding.revision || item.contentHash !== binding.contentHash;
    const row = el('div', `binding${!binding.enabled ? ' excluded' : ''}${stale ? ' missing' : ''}`);
    const check = el('input'); check.id = `binding-${binding.id}`; check.dataset.bindingControl = `include:${binding.id}`; check.type = 'checkbox'; check.checked = binding.enabled; check.setAttribute('aria-label', `Include ${item?.title || binding.id}`);
    check.onchange = () => { binding.enabled = check.checked; changed(); renderBindings(); renderLibrary(); };
    const title = el('label', 'binding-title'); title.htmlFor = check.id; title.append(el('strong', '', item?.title || binding.id), el('small', '', stale ? item ? 'Changed · refresh before compiling' : 'Missing source' : `r${binding.revision} · ${binding.contentHash.slice(0, 8)} · local`));
    const select = el('select'); select.dataset.bindingControl = `role:${binding.id}`; select.setAttribute('aria-label', `Role for ${item?.title || binding.id}`);
    roles.forEach(role => { const option = el('option', '', role); option.value = role; option.selected = role === binding.role; select.append(option); });
    select.onchange = () => { binding.role = select.value; changed(); };
    const actions = el('div', 'binding-actions');
    if (stale && item) { const refresh = button('↻', () => { binding.revision = item.revision; binding.contentHash = item.contentHash; changed(); renderBindings(); }); refresh.setAttribute('aria-label', `Refresh ${item.title} binding`); actions.append(refresh); }
    else { const up = button('↑', () => { if (index > 0) { state.draft.bindings.splice(index, 1); state.draft.bindings.splice(index - 1, 0, binding); changed(); renderBindings(); } }); up.dataset.bindingControl = `up:${binding.id}`; up.disabled = index === 0; up.setAttribute('aria-label', `Move ${item?.title || binding.id} up`); actions.append(up); }
    const remove = button('×', () => { state.draft.bindings.splice(index, 1); changed(); renderBindings(); renderLibrary(); }); remove.dataset.bindingControl = `remove:${binding.id}`; remove.setAttribute('aria-label', `Remove ${item?.title || binding.id} from context`); actions.append(remove);
    row.append(check, title, select, actions); area.append(row);
  });
  if (focusedControl) { const target = [...area.querySelectorAll('[data-binding-control]')].find(control => control.dataset.bindingControl === focusedControl && !control.disabled); (target || area.querySelector('input'))?.focus(); }
}
function dialog(title, build, actions) {
  $('dialog-error').hidden = true; $('dialog-title').textContent = title; $('dialog-body').replaceChildren(); $('dialog-actions').replaceChildren();
  build($('dialog-body'));
  actions.forEach(([label, action, primary]) => $('dialog-actions').append(button(label, guarded(async () => { await action(); }), primary ? 'primary' : '')));
  if (!$('dialog').open) $('dialog').showModal();
}
const closeDialog = () => $('dialog').close();
function field(body, label, value = '', type = 'input') {
  const id = `field-${crypto.randomUUID()}`; const caption = el('label', '', label); caption.htmlFor = id;
  const control = el(type); control.id = id; control.value = value; body.append(caption, control); return control;
}
function addBinding(item) {
  if (state.draft.bindings.some(binding => binding.id === item.id)) { notify('That item is already in your context selection.'); return; }
  state.draft.bindings.push({ id: item.id, revision: item.revision, contentHash: item.contentHash, role: item.type === 'criteria' ? 'criteria' : 'background', enabled: true }); changed(); renderBindings(); renderLibrary(); $('workspace').classList.remove('rail-open'); closeDialog();
}
function previewItem(item) {
  const actions = [];
  if (item.type === 'prompt') actions.push(['Use as draft', async () => { await openDraft(blank(item.content, item.title, state.draft.bindings), false); closeDialog(); }, true]);
  actions.push(['Add to context', () => addBinding(item), item.type !== 'prompt']);
  actions.push(['Edit', () => editItem(item)]);
  actions.push(['Duplicate', () => editItem({ ...item, id: `item-${crypto.randomUUID()}`, title: `${item.title} copy`, revision: 0, source: undefined })]);
  actions.push(['Remove', async () => { await api('/library', { item: { ...item, archived: true }, expectedRevision: item.revision }); closeDialog(); await refreshWorkspace(); notify('Removed from the library. Old compilation records remain unchanged.'); }]);
  dialog(item.title, body => {
    body.append(el('p', '', item.purpose));
    const tags = el('div', 'tag-list'); item.tags.forEach(tag => tags.append(el('span', 'tag', tag))); body.append(tags);
    body.append(el('p', 'inline-meta', `${item.type} · revision ${item.revision} · ${item.sensitivity}\n${item.provenance}\nSHA-256 ${item.contentHash}`));
    if (item.inputs.length) body.append(el('p', 'panel-intro', `Inputs: ${item.inputs.join(', ')}`));
    body.append(el('pre', '', item.content));
    body.append(el('p', 'panel-intro', `Review criteria: ${item.outputCriteria}`));
  }, actions);
}
function editItem(item) {
  const controls = {};
  dialog(item.revision ? 'Edit library item' : 'Keep in library', body => {
    controls.title = field(body, 'Title', item.title);
    controls.type = field(body, 'Artifact type', '', 'select'); ['prompt', 'context', 'criteria'].forEach(type => { const option = el('option', '', type); option.value = type; option.selected = item.type === type; controls.type.append(option); });
    controls.content = field(body, 'Content', item.content, 'textarea');
    controls.purpose = field(body, 'Purpose', item.purpose || '');
    controls.inputs = field(body, 'Expected inputs / placeholders (comma separated)', (item.inputs || []).join(', '));
    controls.criteria = field(body, 'Expected output / review criteria', item.outputCriteria || '');
    controls.tags = field(body, 'Tags (comma separated)', (item.tags || []).join(', '));
    controls.provenance = field(body, 'Provenance', item.provenance || 'Owner-local draft; authored in PCR.');
    controls.sensitivity = field(body, 'Sensitivity', '', 'select'); ['non-sensitive', 'private'].forEach(value => { const option = el('option', '', value); option.value = value; option.selected = item.sensitivity === value; controls.sensitivity.append(option); });
  }, [['Save item', async () => {
    const contentChanged = item.content !== controls.content.value;
    const next = { ...item, title: controls.title.value, type: controls.type.value, content: controls.content.value, revision: Math.max(item.revision, 1), purpose: controls.purpose.value, inputs: controls.inputs.value.split(',').map(x => x.trim()).filter(Boolean), outputCriteria: controls.criteria.value, tags: controls.tags.value.split(',').map(x => x.trim()).filter(Boolean), provenance: controls.provenance.value, sensitivity: controls.sensitivity.value };
    delete next.contentHash; if (contentChanged) delete next.source;
    await api('/library', { item: next, expectedRevision: item.revision }); closeDialog(); await refreshWorkspace(); notify('Library item saved. Existing bindings keep their exact revision until you refresh them.');
  }, true], ['Cancel', closeDialog]]);
}
async function compile(skip = false) {
  if (state.busy || !state.draft.content.trim()) return;
  if (state.requestSkip !== skip) { state.requestId = null; state.requestSkip = skip; }
  state.error = ''; $('result-banner').className = 'result-banner'; state.busy = true; state.requestId ||= crypto.randomUUID(); status();
  const input = { rawText: state.draft.content, projectId: state.workspace.projectId, bindings: structuredClone(state.draft.bindings), maxContextTokens: state.budget, skip, requestId: state.requestId };
  const originalSignature = signature();
  try {
    const result = await api('/playground/compile', input);
    state.result = result; state.resultInput = input.rawText; state.resultSignature = originalSignature; state.panel = 'prompt'; renderResult(); focusView('result');
    notify(result.metadata.skipped ? 'PCR skipped. Your original request is preserved.' : 'Compiled locally. No provider or command was called.');
  } catch (error) {
    state.error = error.message; $('result-banner').hidden = false; $('result-banner').className = 'result-banner error'; $('result-banner').textContent = error.message;
    $('result-state').textContent = 'Compilation failed · draft preserved'; throw error;
  } finally { state.busy = false; status(); }
}
function renderResult() {
  panelCleanup();
  const result = state.result; const content = $('result-content'); content.replaceChildren();
  document.querySelectorAll('[data-panel]').forEach(tab => { tab.classList.toggle('active', tab.dataset.panel === state.panel); tab.setAttribute('aria-pressed', String(tab.dataset.panel === state.panel)); });
  if (!result) return;
  $('result-banner').className = 'result-banner';
  $('copy-result').disabled = !result.prompt; $('export-result').disabled = false; $('result-footer').hidden = false;
  $('result-to-draft').disabled = !result.prompt; $('save-result').disabled = !result.prompt;
  $('result-reference').textContent = `${result.metadata.compileId} · ${new Date(result.metadata.createdAt).toLocaleString()}`;
  if (state.panel === 'prompt') {
    if (result.metadata.skipped) { content.append(el('h3', '', 'No prompt was compiled.'), el('p', 'panel-intro', result.metadata.skipReason), el('p', 'compare-heading', 'ORIGINAL INPUT'), el('pre', 'prompt-output', state.resultInput)); }
    else content.append(el('pre', 'prompt-output', result.prompt));
  } else if (state.panel === 'compare') {
    for (const [title, text] of [['ORIGINAL INPUT', state.resultInput], ['COMPILED OUTPUT', result.prompt || '(Skipped — no output)']]) { const part = el('section', 'compare-block'); part.append(el('h3', 'compare-heading', title), el('pre', '', text)); content.append(part); }
  } else { const panel = panels.find(candidate => candidate.id === state.panel); if (panel) panelCleanup = mountPanel(content, panel, { result, rawText: state.resultInput }, error => notify(error.message, true)); }
  status();
}
function focusView(view) { $('show-draft').setAttribute('aria-pressed', String(view === 'draft')); $('show-result').setAttribute('aria-pressed', String(view === 'result')); $('writing-grid').classList.toggle('show-output', view === 'result'); $('show-draft').classList.toggle('active', view === 'draft'); $('show-result').classList.toggle('active', view === 'result'); }
function draftMenu() {
  dialog('Draft actions', body => body.append(el('p', '', 'Editing and undo apply to this draft only. Earlier compilation records remain unchanged.')), [
    ['Record explicit skip', async () => { closeDialog(); state.requestId = null; await compile(true); }],
    ['Duplicate draft', async () => { const copy = blank(state.draft.content, `${state.draft.title} copy`, state.draft.bindings, state.draft.derivedFrom); await openDraft(copy, false, true); closeDialog(); }],
    ['Keep in library', () => editItem({ id: `item-${crypto.randomUUID()}`, revision: 0, title: state.draft.title, content: state.draft.content, type: 'prompt', sensitivity: 'non-sensitive' })],
    ['Export draft .md', () => { download(`${state.draft.title}.md`, state.draft.content, 'text/markdown'); closeDialog(); }],
    ['Export draft JSON', () => { download(`${state.draft.title}.draft.json`, JSON.stringify({ format: 'pcr-draft', schemaVersion: 1, projectId: state.workspace.projectId, draft: state.draft }, null, 2), 'application/json'); closeDialog(); }],
  ]);
}
function exportResult() {
  const result = state.result;
  dialog('Export compilation', body => body.append(el('p', '', 'Markdown and text contain the exact prompt. JSON includes original input, exact selected references, compiler output, policy and trace. Exporting never releases or executes an artifact.')), [
    ['Markdown', () => { download(`${result.metadata.compileId}.md`, result.prompt, 'text/markdown'); closeDialog(); }],
    ['Plain text', () => { download(`${result.metadata.compileId}.txt`, result.prompt); closeDialog(); }],
    ['JSON + provenance', () => { download(`${result.metadata.compileId}.json`, JSON.stringify({ format: 'pcr-compilation', schemaVersion: 1, state: 'draft', projectId: result.metadata.provenance?.projectId, rawText: state.resultInput, derivedFrom: result.metadata.provenance?.derivedFrom || [], result }, null, 2), 'application/json'); closeDialog(); }, true],
  ]);
}
async function feedback() {
  const previous = await api(`/history/${state.result.metadata.compileId}/feedback`);
  let note; let rating = previous[0]?.rating || 'neutral';
  dialog('Feedback on this compilation', body => {
    body.append(el('p', '', 'Saved with this compilation for review. Selected-only compilation does not use feedback or learn from it.'));
    const group = el('div'); group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Feedback rating');
    for (const value of ['like', 'neutral', 'dislike']) { const label = el('label'); const input = el('input'); input.type = 'radio'; input.name = 'rating'; input.value = value; input.checked = rating === value; input.onchange = () => { rating = value; }; label.append(input, el('span', '', value)); group.append(label); } body.append(group);
    note = field(body, 'Optional note', previous[0]?.comment || '', 'textarea');
    if (previous.length) body.append(el('p', 'inline-meta', `${previous.length} saved feedback event(s). Latest: ${previous[0].rating}.`));
  }, [['Save feedback', async () => { await api(`/history/${state.result.metadata.compileId}/feedback`, { rating, comment: note.value }); closeDialog(); notify('Feedback saved. It will not enter selected-only compilations.'); }, true]]);
}
async function importLibrary() {
  let input;
  dialog('Import local library', body => {
    body.append(el('p', '', 'Paste pcr-library version 1 JSON, or choose a JSON file. Only resolved text items are imported; configuration and executable content are never run. Existing IDs are preserved and conflicts stop the whole import.'));
    input = field(body, 'Library JSON', '', 'textarea');
    body.append(button('Choose JSON file', () => { $('import-file').click(); }));
    $('import-file').onchange = guarded(async event => { const file = event.target.files[0]; if (file) { if (file.size > 3_000_000) throw new Error('Use a library file smaller than 3 MB.'); input.value = await file.text(); } });
  }, [['Import', async () => { const result = await api('/library/import', JSON.parse(input.value)); closeDialog(); await refreshWorkspace(); notify(`Imported ${result.imported}; ${result.unchanged} unchanged. Existing work preserved.`); }, true]]);
}
async function secondary() {
  const page = location.hash.slice(1) || 'playground';
  document.querySelectorAll('.main-nav a').forEach(link => { if (link.hash === `#${page}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('workspace').hidden = page !== 'playground'; $('secondary-view').hidden = page === 'playground';
  if (page === 'playground') return;
  const host = $('secondary-view'); host.replaceChildren();
  if (page === 'history') {
    host.append(el('h1', '', 'Compilation history'), el('p', 'muted', 'Immutable inputs and results from this local workspace. Feedback is kept separately.'));
    const history = await api('/history?limit=200');
    if (!history.length) host.append(el('p', 'panel-intro', 'No compilations yet. Compile a draft to start your history.'));
    history.forEach(record => {
      const row = el('article', 'history-row'); const detail = el('div'); detail.append(el('h2', '', record.rawText.trim().split('\n')[0]), el('p', '', `${record.metadata.skipped ? 'Skipped' : record.metadata.selectedToolId} · ${new Date(record.createdAt).toLocaleString()} · ${record.compileId}`));
      row.append(detail, button('Open', () => { state.result = { prompt: record.prompt, promptIr: record.promptIr, contextPack: record.contextPack, metadata: record.metadata, trace: record.metadata.trace }; state.resultInput = record.rawText; state.error = ''; state.resultSignature = ''; state.panel = 'prompt'; renderResult(); location.hash = 'playground'; focusView('result'); })); host.append(row);
    });
  } else if (page === 'tools') {
    host.append(el('h1', '', 'Compiler tools'), el('p', 'muted', 'Enabled tools participate in deterministic routing. Selected-only mode keeps reminders, commands and automatic documentation loading off.'));
    const tools = await api('/tools');
    tools.forEach(tool => { const row = el('article', 'tool-row'); const check = el('input'); check.type = 'checkbox'; check.checked = tool.enabled; check.setAttribute('aria-label', `Enable ${tool.name}`); check.onchange = guarded(async () => { check.disabled = true; try { await api(`/tools/${tool.id}`, { enabled: check.checked }); state.requestId = null; if (state.result) state.resultSignature = "tool-settings-changed"; notify(`${tool.name} ${check.checked ? 'enabled' : 'disabled'}.`); } catch (error) { check.checked = !check.checked; throw error; } finally { check.disabled = false; } });
      const text = el('div'); text.append(el('h2', '', tool.name), el('p', '', tool.description), el('p', '', tool.id === 'grammar' ? 'Provider-free limitation: removes the trigger; does not correct grammar. Selected context is still attached.' : `Try: ${tool.triggers.slice(0, 4).join(' · ')}`)); row.append(check, text); host.append(row); });
  } else if (page === 'settings') {
    host.append(el('h1', '', 'Workspace settings'), el('p', 'muted', 'Local compilation, explicit context, no background execution.'));
    const budget = el('section', 'setting-row'); const label = el('label', '', 'Context budget · estimated tokens'); const input = el('input'); input.type = 'number'; input.min = '256'; input.max = '32000'; input.value = state.budget; input.id = 'context-budget'; label.htmlFor = input.id;
    budget.append(label, el('p', '', 'Selected sources that do not fit are omitted and identified in Sources. The request itself is never truncated.'), input, button('Save budget', guarded(() => { saveBudget(Number(input.value)); state.budget = Number(input.value); changed(); notify('Context budget saved for this browser.'); }))); host.append(budget);
    for (const [title, description] of [['Selected-only context', 'Only your request and explicitly included source revisions contribute. No indexing, project files, classifier history or feedback retrieval.'], ['Optional assistance & agent execution', 'Codex / ChatGPT-plan and OpenAI API adapters are unavailable in this increment. Compile neither sends a finished prompt to an agent nor executes it.'], ['Appearance', 'Graphite dark. Uses installed system fonts; no external fonts, assets or runtime services.'], ['Privacy', 'No credentials belong in drafts or library items. Credential-shaped content is rejected at save/import and redacted recursively in compilation responses/history. This is not general personal-data detection or encryption.']]) { const row = el('section', 'setting-row'); row.append(el('h2', '', title), el('p', '', description)); host.append(row); }
    const paths = el('section', 'setting-row'); paths.append(el('h2', '', 'Local storage'), el('pre', '', `Workspace: ${state.workspace.projectId}\nLibrary & drafts: ${state.workspace.libraryPath}\nCompilation history & feedback: ${state.workspace.dbPath}\nRecovery: browser storage for this workspace only`)); host.append(paths);
    host.append(button('Restore removed library item', () => { const archived = state.workspace.items.filter(item => item.archived); dialog('Removed library items', body => { if (!archived.length) body.append(el('p', '', 'No removed items.')); archived.forEach(item => body.append(button(`Restore ${item.title}`, guarded(async () => { await api('/library', { item: { ...item, archived: false }, expectedRevision: item.revision }); await refreshWorkspace(); closeDialog(); notify('Restored. Refresh old context bindings explicitly.'); })))); }, [['Close', closeDialog]]); }));
  } else { location.hash = 'playground'; }
}

$('draft-title').addEventListener('input', event => { state.draft.title = event.target.value; changed(); });
document.querySelector('.skip-link').onclick = event => { event.preventDefault(); location.hash = 'playground'; focusView('draft'); editor.focus(); };
$('save-draft').onclick = guarded(save); $('new-draft').onclick = guarded(() => openDraft(blank(), false)); $('draft-menu').onclick = draftMenu;
$('search').oninput = renderLibrary;
$('browse-library').onclick = () => { state.collection = 'library'; renderLibrary(); };
$('browse-drafts').onclick = () => { state.collection = 'drafts'; renderLibrary(); };
document.querySelectorAll('[data-type]').forEach(control => { control.onclick = () => { state.filter = control.dataset.type; document.querySelectorAll('[data-type]').forEach(item => item.classList.toggle('active', item === control)); renderLibrary(); }; });
$('toggle-library').onclick = () => { if (innerWidth <= 650) $('workspace').classList.toggle('rail-open'); else $('workspace').classList.toggle('rail-hidden'); };
$('close-library').onclick = () => $('workspace').classList.remove('rail-open');
$('add-context').onclick = () => { state.collection = 'library'; state.filter = 'all'; $('workspace').classList.remove('rail-hidden'); $('workspace').classList.add('rail-open'); renderLibrary(); $('search').focus(); };
$('compile').onclick = guarded(() => compile());
$('show-draft').onclick = () => focusView('draft'); $('show-result').onclick = () => focusView('result');
document.querySelectorAll('[data-panel]').forEach(control => { control.onclick = () => { state.panel = control.dataset.panel; if (state.result) renderResult(); }; });
$('copy-result').onclick = guarded(async () => { await navigator.clipboard.writeText(state.result.prompt); notify('Exact compiled prompt copied.'); });
$('export-result').onclick = exportResult;
$('result-to-draft').onclick = guarded(() => openDraft(blank(state.result.prompt, 'From compiled prompt', [], state.result.metadata.compileId), false));
$('save-result').onclick = () => editItem({ id: `item-${crypto.randomUUID()}`, revision: 0, title: `Compiled · ${state.draft.title}`, content: state.result.prompt, type: 'prompt', sensitivity: 'non-sensitive', provenance: `Derived from ${state.result.metadata.compileId}; ${JSON.stringify(state.result.metadata.provenance?.derivedFrom || [])}` });
$('feedback').onclick = guarded(feedback);
$('export-library').onclick = guarded(async () => { download('pcr-library.json', JSON.stringify(await api('/library/export'), null, 2), 'application/json'); notify('Exported active library items only. Drafts and compilation history are separate.'); });
$('import-library').onclick = importLibrary;
window.addEventListener('hashchange', guarded(secondary));
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && !$('dialog').open) { event.preventDefault(); guarded(save)(); }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !$('dialog').open) { event.preventDefault(); guarded(compile)(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); location.hash = 'playground'; $('workspace').classList.remove('rail-hidden'); $('workspace').classList.add('rail-open'); $('search').focus(); }
  if (event.key === 'Escape') $('workspace').classList.remove('rail-open');
});
async function init() {
  state.workspace = await api('/workspace');
  let activeId; try { activeId = activeDraft(state.workspace.projectId); } catch { /* Saved files remain authoritative. */ }
  const saved = state.workspace.drafts.find(draft => draft.id === activeId) || state.workspace.drafts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  state.draft = saved || blank(); state.saved = snapshot(state.draft);
  try { const recovery = recover(state.workspace.projectId); if (recovery && (!saved || recovery.id !== saved.id || snapshot(recovery) !== snapshot(saved))) { state.draft = recovery; state.saved = saved?.id === recovery.id ? snapshot(saved) : ''; notify('Recovered unsaved edits from this browser. Save or duplicate to keep them.'); } } catch { notify('Browser recovery could not be read. Saved files are intact.', true); }
  $('draft-title').value = state.draft.title; editor.open(state.draft.content); renderLibrary(); renderBindings(); status(); await secondary();
}
init().catch(error => { $('fatal').hidden = false; $('fatal').textContent = error.message; $('workspace').hidden = true; });
