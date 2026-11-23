import type { NextConfig } from "next";

/** Host do Supabase (imagens dos comentários otimizadas em /_next/image). */
const hostSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Miniaturas das imagens dos comentários: o otimizador (na Netlify, o Image
  // CDN) reduz a imagem do bucket privado "atividades" a partir da URL
  // assinada. Só esse caminho é aceito; a busca (?token=) muda a cada URL.
  images: {
    qualities: [75],
    maximumRedirects: 0,
    remotePatterns: hostSupabase
      ? [
          {
            protocol: "https",
            hostname: hostSupabase,
            pathname: "/storage/v1/object/sign/atividades/**",
          },
        ]
      : [],
  },
  partialPrefetching: true,
  // exceljs fica fora do bundle do servidor (o @react-pdf/renderer já é externo por padrão).
  serverExternalPackages: ["exceljs"],
  // "Usuários" virou "Colaboradores": /usuarios (e subrotas) leva para /colaboradores.
  async redirects() {
    return [
      { source: "/usuarios", destination: "/colaboradores", permanent: true },
      { source: "/usuarios/:caminho*", destination: "/colaboradores/:caminho*", permanent: true },
      // Atividades arquivadas passaram a se chamar concluídas (migration 028).
      { source: "/atividades/arquivadas", destination: "/atividades/concluidas", permanent: true },
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
