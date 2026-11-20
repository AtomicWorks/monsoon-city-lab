import { defineConfig, devices } from "@playwright/test";

const port = 4174;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Headless runners have no GPU; let Chromium fall back to its
        // software WebGL so the three.js scene can render.
        launchOptions: { args: ["--enable-unsafe-swiftshader"] },
      },
    },
  ],
  // Always test a fresh production build, as visitors receive it.
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
