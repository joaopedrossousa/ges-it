import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // exceljs fica fora do bundle do servidor (o @react-pdf/renderer já é externo por padrão).
  serverExternalPackages: ["exceljs"],
  // "Usuários" virou "Colaboradores": /usuarios (e subrotas) leva para /colaboradores.
  async redirects() {
    return [
      { source: "/usuarios", destination: "/colaboradores", permanent: true },
      { source: "/usuarios/:caminho*", destination: "/colaboradores/:caminho*", permanent: true },
    ];
  },
  // Lidos do disco na geração do PDF: precisam ir junto para a função da Netlify.
  outputFileTracingIncludes: {
    "/api/relatorios/*": [
      "./public/brand/logo-horizontal-pdf.png",
      "./node_modules/@fontsource/roboto/files/roboto-latin-{400,500,700}-normal.woff",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
