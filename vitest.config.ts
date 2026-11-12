import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  // Los tests que dibujan un componente (.tsx) necesitan el JSX automático, como en la app
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
    ],
  },
});
