import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const clientPort = Number(process.env.CLIENT_PORT ?? 5173);
const serverOrigin =
  process.env.SERVER_ORIGIN ?? `http://${process.env.HOST ?? "127.0.0.1"}:${process.env.PORT ?? "3000"}`;

export default defineConfig({
  plugins: [solidPlugin()],
  root: "client",
  server: {
    port: clientPort,
    proxy: {
      "/api": serverOrigin,
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
});
