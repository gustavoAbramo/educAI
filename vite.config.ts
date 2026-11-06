// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { normalizePath } from "vite";

const privateDirectories = [
  process.env.EDUCAI_AUTH_ACCOUNTS_DIR,
  process.env.EDUCAI_RECORDINGS_DIR,
].flatMap((directory) => (directory ? [`${normalizePath(resolve(directory))}/**`] : []));
const privateFiles = [
  process.env.EDUCAI_VOICE_STORE_PATH,
  process.env.EDUCAI_APP_SETTINGS_PATH,
  process.env.EDUCAI_SETTINGS_SECRETS_PATH,
  process.env.EDUCAI_SETTINGS_MASTER_KEY_PATH,
  process.env.EDUCAI_PROVIDER_SETTINGS_PATH,
  process.env.EDUCAI_RUNTIME_HISTORY_PATH,
].flatMap((file) => {
  if (!file) return [];
  const path = normalizePath(resolve(file));
  return [path, `${path}.tmp`];
});

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  vite: {
    server: {
      host: "localhost",
      port: 8080,
      strictPort: true,
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem,key,p12,pfx,cer,der}",
          ".npmrc",
          ".yarnrc.yml",
          "**/.git/**",
          "**/.data/**",
          ...privateDirectories,
          ...privateFiles,
        ],
      },
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
