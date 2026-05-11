/**
 * Browser stub for `import fs from "fs/promises"` (KeeperSdk SessionManager / FileConfigLoader).
 * The embedded shell uses {@link InMemoryConfigLoader} only; these paths are not used at runtime.
 */
const notAvailable = (): never => {
  throw new Error("fs/promises is not available in keeper-shell.");
};

const stub = {
  readFile: notAvailable,
  writeFile: notAvailable,
  mkdir: notAvailable,
  access: notAvailable,
};

export default stub;

export const readFile = notAvailable;
export const writeFile = notAvailable;
export const mkdir = notAvailable;
export const access = notAvailable;
