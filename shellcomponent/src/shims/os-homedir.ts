/** Minimal `os` stub for bundles that never instantiate FileConfigLoader with default paths. */
export function homedir(): string {
  return "/";
}

export default { homedir };
