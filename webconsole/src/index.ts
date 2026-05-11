import { WebConsole } from "./web-console.js";

const TAG = "web-console";

if (!customElements.get(TAG)) {
  customElements.define(TAG, WebConsole);
}

export { WebConsole };
