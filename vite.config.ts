import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Let pdfjs-dist be pre-bundled normally; exclude breaks worker resolution
    exclude: [],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ["pdfjs-dist"],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  // Ensure .mjs files from node_modules are handled correctly
  assetsInclude: [],
}));
