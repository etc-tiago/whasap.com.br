import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import evlog from "evlog/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  envDir: rootDir,
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    evlog({ service: "whasap-web", autoImports: true, strip: ["debug"] }),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index.html",
        },
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
