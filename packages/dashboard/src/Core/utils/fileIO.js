import fsExtra from 'fs-extra';

// File I/O utilities (wrappers around fs-extra)
export const writeFile = fsExtra.outputFile;
export const ensureDir = fsExtra.ensureDir;