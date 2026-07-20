import { defineConfig, loadEnv } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Backend ORDS por defecto. loadEnv solo lee archivos .env, así que en CI
// (donde la URL llega por process.env) hay que tomarla de ahí; si tampoco está,
// se usa este fallback para que el build de GitHub Pages salga funcional.
const DEFAULT_API_URL = "https://oracleapex.com/ords/wksp_evamar/api";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || DEFAULT_API_URL;

  // ORDS no manda headers CORS (el preflight responde 403), así que en dev el
  // navegador no puede pegarle directo. Con el proxy la app llama a /api (mismo
  // origen que Vite) y el server reenvía al backend, donde CORS no aplica.
  // En build no hay servidor que proxee: se usa la URL absoluta.
  const esDev = command === "serve";
  env.VITE_API_URL = esDev ? "/api" : apiUrl;

  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define,
    base: env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || "/",
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      viteReact(),
    ],
  };
});
