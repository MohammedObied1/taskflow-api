import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on :8000; proxying keeps the browser on one origin (no CORS, no hard-coded host).
const target = "http://localhost:8000";

// When the API is down Vite would answer a bare 500; send 502 instead so the UI can say
// "can't reach the server" rather than showing a misleading server error.
const apiProxy = {
  target,
  configure: (proxy) => {
    proxy.on("error", (_err, _req, res) => {
      if (res.headersSent || res.writableEnded) return;
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: `API unreachable at ${target}` }));
    });
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": apiProxy, "/health": apiProxy },
  },
  preview: {
    port: 4173,
    proxy: { "/api": apiProxy, "/health": apiProxy },
  },
  test: {
    environment: "jsdom",
  },
});
