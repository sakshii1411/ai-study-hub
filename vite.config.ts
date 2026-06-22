import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Only load lovable-tagger in dev — never in prod
    mode === "development" && (async () => {
      try { return (await import("lovable-tagger")).componentTagger(); } catch { return null; }
    })(),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    // Increase chunk warning limit (pdfjs is inherently large)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Each heavy dep gets its own chunk — only loaded when needed
          if (id.includes("pdfjs-dist"))       return "pdfjs";
          if (id.includes("tesseract"))        return "tesseract";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "pdf-export";
          if (id.includes("framer-motion"))   return "framer";
          if (id.includes("react-markdown") || id.includes("remark")) return "markdown";
          if (id.includes("mammoth"))         return "mammoth";
          if (id.includes("react-dom"))       return "react-dom";
          if (id.includes("node_modules/react/")) return "react";
          if (id.includes("@radix-ui"))       return "radix";
          if (id.includes("lucide-react"))    return "lucide";
        },
      },
    },
    // Target modern browsers — smaller output
    target: "es2020",
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "framer-motion"],
    exclude: ["pdfjs-dist", "tesseract.js"],
  },
  worker: { format: "es" },
}));
