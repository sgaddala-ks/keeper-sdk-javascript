/** Browser stub: KeeperSdk SessionManager pulls `fs` for FileConfigLoader; embedded shell uses in-memory config only. */
const notAvailable = (): never => {
  throw new Error("Node fs is not available in keeper-shell (use in-memory session storage).");
};

export default {
  promises: {
    readFile: notAvailable,
    writeFile: notAvailable,
    mkdir: notAvailable,
    access: notAvailable,
  },
};
