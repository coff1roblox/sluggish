import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

// Serves the Netlify Function at /api/write during `npm run dev`, so local
// development needs nothing but a .env file. In production Netlify routes
// /api/write to netlify/functions/write.ts itself.
function devApi(): Plugin {
  let server: ViteDevServer;
  return {
    name: "lahja-dev-api",
    apply: "serve",
    configureServer(s) {
      server = s;
      server.middlewares.use("/api/write", (req, res) => {
        void handle(req, res);
      });
    },
  };

  async function handle(req: IncomingMessage, res: ServerResponse) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const request = new Request("http://localhost/api/write", {
        method: req.method,
        headers: { "content-type": "application/json" },
        body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
      });
      const mod = await server.ssrLoadModule("/netlify/functions/write.ts");
      const response: Response = await mod.default(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch (err) {
      server.config.logger.error(String(err));
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({ error: { code: "upstream", message: "Dev server error" } }),
      );
    }
  }
}

export default defineConfig(({ mode }) => {
  // Expose server-side variables from .env to the function in dev only.
  // Nothing here is bundled into the browser build.
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["ANTHROPIC_API_KEY", "LAHJA_MODEL", "LAHJA_EFFORT", "ANTHROPIC_BASE_URL"]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), devApi()],
    server: { host: true },
  };
});
