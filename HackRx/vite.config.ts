import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

/**
 * Runs the Vercel functions in /api under `npm run dev` too. Without this, Vite
 * serves /api/resume.ts as a source file instead of executing it. On Vercel the
 * functions run natively and this plugin isn't involved.
 */
function vercelApiInDev(): Plugin {
  return {
    name: "vercel-api-in-dev",
    apply: "serve",
    configureServer(server) {
      // The functions read env from process.env, as they do on Vercel.
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ""));
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.match(/^\/api\/([\w-]+)(?:\?|$)/)?.[1];
        if (!route || req.method !== "GET") return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${route}.ts`);
          if (typeof mod.GET !== "function") return next();
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const response: Response = await mod.GET(new Request(`http://localhost${req.url}`, { headers }));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::", // listen on all interfaces (IPv4 + IPv6)
    port: 8080,
  },
  plugins: [tailwindcss(), react(), vercelApiInDev()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
