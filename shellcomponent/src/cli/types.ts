export type CliResult = {
  code: number;
  out: string;
  err: string;
  /**
   * Login has username but needs password: UI should call login transport with JSON
   * `{ username, password }` — never put the password in `line`.
   */
  needPassword?: boolean;
  /** When `needPassword`, the username from `login --username …`. */
  loginUsername?: string;
};
