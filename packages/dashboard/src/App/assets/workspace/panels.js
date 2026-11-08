import { el } from './dom.js';
/** @type {import('./panels').InspectionPanel} */
export const sourcePanel = {
  id: 'sources', title: 'Sources',
  mount(host, { result }) {
    host.append(el('p', 'panel-intro', 'Only explicitly included sources contributed. Revisions below belong to this compilation; later library edits do not change it.'));
    const refs = result.metadata.provenance?.derivedFrom || [];
    refs.forEach(binding => {
      const card = el('article', 'source-card');
      const included = result.metadata.sources?.[binding.order];
      card.append(el('h3', '', `${binding.order + 1}. ${binding.source.artifactId} · ${binding.role}`));
      card.append(el('small', included?.included ? 'included' : 'omitted', included?.included ? 'Included' : `Omitted — ${included?.reason || 'not compiled'}`));
      card.append(el('small', '', `${binding.source.host} / ${binding.source.projectId} / revision ${binding.source.revision}\nSHA-256 ${binding.source.contentHash}`));
      host.append(card);
    });
    if (!refs.length) host.append(el('p', 'panel-intro', 'No selected source references.'));
    host.append(el('p', 'panel-intro', result.metadata.effectivePolicy?.contextMode === 'selected-only'
      ? 'Implicit files, project context, classifier history and feedback examples: excluded. Providers and commands: denied.'
      : 'This record was created outside selected-only mode. Inspect its ContextPack, trace and effective policy; legacy records may not contain provenance.'));
  },
};
/** @type {import('./panels').InspectionPanel} */
export const inspectPanel = {
  id: 'inspect', title: 'Inspect',
  mount(host, { result, rawText }) {
    host.append(el('p', 'panel-intro', 'The real compiler record. No model response or task execution is performed.'));
    for (const [title, value] of [['Warnings', result.metadata.warnings], ['Effective policy', result.metadata.effectivePolicy], ['Original input', rawText], ['ContextPack', result.contextPack], ['PromptIR', result.promptIr], ['Trace', result.trace || result.metadata.trace], ['Provenance & metadata', result.metadata]]) {
      const section = el('details'); section.append(el('summary', '', title), el('pre', '', typeof value === 'string' ? value : JSON.stringify(value, null, 2))); host.append(section);
    }
  },
};
export function mountPanel(host, panel, context, onError) {
  host.replaceChildren();
  try { return panel.mount(host, context) || (() => {}); }
  catch (error) { host.replaceChildren(el('p', 'panel-intro', 'This panel is unavailable. The compilation and draft are preserved.')); onError(error); return () => {}; }
}
