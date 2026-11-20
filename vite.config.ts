import { defineConfig, type Plugin } from "vite";

// The Latin faces of the two UI fonts. Preloading them lets the browser
// fetch them alongside the stylesheet instead of after it, so text does not
// swap from a fallback font after first paint. The latin-ext faces are only
// used for rarer characters and load on demand.
const PRELOADED_FONTS = [
  "dm-sans-latin-wght-normal",
  "manrope-latin-wght-normal",
];

function preloadFonts(): Plugin {
  let base = "/";
  return {
    name: "monsoon-preload-fonts",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, { bundle }) {
        const files = Object.keys(bundle ?? {});
        return PRELOADED_FONTS.map((name) => {
          const file = files.find(
            (f) => f.includes(`/${name}-`) && f.endsWith(".woff2"),
          );
          if (!file) throw Error(`Font ${name} is missing from the build.`);
          return {
            tag: "link",
            // Font preloads must be CORS requests to match the @font-face
            // fetch; otherwise the browser downloads the file twice.
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              href: base + file,
              crossorigin: "",
            },
            injectTo: "head",
          };
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [preloadFonts()],
  build: {
    // The three.js chunk is about 570 kB minified on its own (0.187). It
    // cannot be split further and loads lazily with the 3D scene, so the
    // warning threshold sits just above it; app chunks are far smaller.
    chunkSizeWarningLimit: 600,
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
