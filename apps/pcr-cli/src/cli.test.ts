import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "./index.js";

function io() {
  let stdout = "";
  let stderr = "";
  return {
    get stdoutText() {
      return stdout;
    },
    get stderrText() {
      return stderr;
    },
    stdout: { write: (chunk: string) => { stdout += chunk; return true; } },
    stderr: { write: (chunk: string) => { stderr += chunk; return true; } },
    stdin: Object.assign(process.stdin, { isTTY: true }),
  };
}

describe("pcr cli", () => {
  it("initializes and compiles with local context", async () => {
    const temp = await mkdtemp(join(tmpdir(), "pcr-cli-"));
    process.env.PCR_USER_DIR = join(temp, "user-pcr");
    process.env.PCR_DB_PATH = join(temp, "pcr.sqlite");

    const initIo = io();
    await runCli(["node", "pcr", "init"], initIo);
    expect(initIo.stdoutText).toContain("Initialized PCR");

    const compileIo = io();
    await runCli([
      "node",
      "pcr",
      "compile",
      "according to my current goals and nearest schedule, compile a research prompt for assessment of my progress",
    ], compileIo);
    expect(compileIo.stdoutText).toContain("Finish PCR V0");
    expect(compileIo.stdoutText).toContain("Friday");

    delete process.env.PCR_USER_DIR;
    delete process.env.PCR_DB_PATH;
  });
});

