import path from "node:path";
import fs from "fs-extra";

export class LegacyLayoutError extends Error {}

export async function assertNoLegacyLayout(projectRoot: string): Promise<void> {
  const legacyDirectory = path.join(projectRoot, "ai-tools");
  if (!(await fs.pathExists(legacyDirectory))) {
    return;
  }

  throw new LegacyLayoutError(
    `Legacy tool layout detected at "${legacyDirectory}". Arrey now requires tools under "arrey/tools/<tool>/" with index.ts, prompt.ts, manifest.json, and README.md.`
  );
}
