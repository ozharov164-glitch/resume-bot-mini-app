import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "resume-bot-mini-app";
const isPages = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  plugins: [react()],
  base: isPages ? `/${repoName}/` : "/",
  server: {
    host: "0.0.0.0",
    port: 5173
  }
});
