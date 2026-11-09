export interface InspectionContext {
  result: { prompt: string; promptIr: unknown; contextPack: unknown; metadata: { provenance?: { derivedFrom: Array<{ source: { artifactId: string; revision: number; contentHash: string; projectId: string; host: string }; role: string; order: number }> }; sources?: Array<{ id: string; included: boolean; reason?: string }>; warnings: string[]; effectivePolicy?: { contextMode: string } }; trace?: unknown };
  rawText: string;
}
/** Built-ins are trusted static modules. Mount may return cleanup; switching always disposes it. */
export interface InspectionPanel { id: string; title: string; mount(host: HTMLElement, context: InspectionContext): void | (() => void) }
export function mountPanel(host: HTMLElement, panel: InspectionPanel, context: InspectionContext, onError: (error: Error) => void): () => void;
export const sourcePanel: InspectionPanel;
export const inspectPanel: InspectionPanel;
