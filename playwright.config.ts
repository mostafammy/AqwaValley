import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./__checks__", // Points to Checkly's default folder
  use: {
    baseURL: process.env.ENVIRONMENT_URL ?? "http://localhost:3000",
  },
});
