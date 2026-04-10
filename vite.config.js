import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",          // required for Electron file:// loading in production
  test: {
    environment: "node",
    globals: true,
    env: {
      VITE_EIA_API_KEY:  "test-eia-key",
      VITE_NREL_API_KEY: "test-nrel-key",
    },
  },
});
