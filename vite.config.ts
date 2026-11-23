import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Served from https://<user>.github.io/chessmate/ — override with VITE_BASE for a custom domain ("/").
export default defineConfig({
  base: process.env.VITE_BASE ?? "/chessmate/",
  plugins: [react(), tailwindcss()],
  build: { target: "es2020", sourcemap: false },
});
