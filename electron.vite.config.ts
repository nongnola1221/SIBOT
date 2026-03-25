import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...segments: string[]) => path.resolve(__dirname, ...segments);

const sharedAliases = {
  "@sibot/shared": resolvePath("packages/shared/src/index.ts"),
  "@sibot/config": resolvePath("packages/config/src/index.ts"),
  "@sibot/game-detectors": resolvePath("packages/game-detectors/src/index.ts"),
  "@sibot/game-profiles": resolvePath("packages/game-detectors/src/profiles.ts"),
  "@sibot/event-engine": resolvePath("packages/event-engine/src/index.ts"),
  "@sibot/speech": resolvePath("packages/speech/src/index.ts"),
  "@sibot/core": resolvePath("packages/core/src/index.ts")
};

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      lib: {
        entry: resolvePath("apps/desktop/src/main/index.ts")
      }
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAliases
    }
  },
  preload: {
    build: {
      outDir: "out/preload",
      lib: {
        entry: resolvePath("apps/desktop/src/preload/index.ts")
      }
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAliases
    }
  },
  renderer: {
    root: resolvePath("apps/desktop"),
    base: "./",
    build: {
      outDir: resolvePath("out/renderer"),
      rollupOptions: {
        input: {
          main: resolvePath("apps/desktop/index.html"),
          overlay: resolvePath("apps/desktop/overlay.html")
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        ...sharedAliases,
        "@renderer": resolvePath("apps/desktop/src/renderer"),
        "@overlay": resolvePath("apps/desktop/src/overlay")
      }
    },
    server: {
      port: 5173
    }
  }
});
