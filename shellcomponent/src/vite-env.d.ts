/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KEEPER_DEV_DEVICE_USER?: string;
  readonly VITE_KEEPER_DEV_DEVICE_TOKEN?: string;
  readonly VITE_KEEPER_DEV_DEVICE_PRIVATE_KEY?: string;
  readonly VITE_KEEPER_USERNAME?: string;
  readonly VITE_KEEPER_PASSWORD?: string;
  readonly VITE_KEEPER_SESSION_TOKEN?: string;
  readonly VITE_KEEPER_HOST?: string;
  readonly VITE_REGISTER_DEVICE_TOKEN?: string;
  readonly VITE_REGISTER_DEVICE_PRIVATE_KEY?: string;
  readonly VITE_RESTORE_SESSION_JSON?: string;
}
