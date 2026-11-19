// Configuração de build sem dependência do Lovable.
// Hospedagem: Vercel (preset do Nitro). Para gerar outro alvo localmente,
// defina NITRO_PRESET (ex.: NITRO_PRESET=node-server bun run build).
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
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
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Entrada do servidor em src/server.ts (wrapper de erros do SSR).
      server: { entry: "server" },
      // Impede que código de servidor vaze para o navegador.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Nitro só no build (no dev e nos testes ele mantém processos abertos).
    ...(command === "build" ? [nitro({ preset: process.env.NITRO_PRESET || "vercel" })] : []),
    viteReact(),
  ],
}));
