export type CliResult = {
  code: number;
  out: string;
  err: string;
  /**
   * Login has username but needs password: web UI should POST `/api/cli/login`
   * with JSON `{ username, password }` — never put the password in `line`.
   */
  needPassword?: boolean;
  /** When `needPassword`, the username from `login --username …`. */
  loginUsername?: string;
};
