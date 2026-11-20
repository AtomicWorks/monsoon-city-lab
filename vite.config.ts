import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // The three.js chunk is about 500 kB minified on its own. It cannot be
    // split further and loads lazily with the 3D scene, so the warning
    // threshold sits just above it; app chunks are far smaller.
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        // Libraries change rarely; separate chunks stay cached across app
        // releases.
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react";
        },
      },
    },
  },
});
