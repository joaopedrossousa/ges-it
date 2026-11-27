import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { ProvedorTema } from "@/components/tema/provedor-tema";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Ícones: src/app/favicon.ico e src/app/icon.png (convenção de arquivos);
// por isso não há `icons` aqui.
export const metadata: Metadata = {
  title: { default: "GesIT Produtécnica", template: "%s | GesIT Produtécnica" },
  description: "Plataforma interna de gestão de T.I.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o script do next-themes põe a classe do tema
    // (e o color-scheme) no <html> antes da hidratação.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ProvedorTema>
          {children}
          <Toaster richColors position="top-right" />
        </ProvedorTema>
      </body>
    </html>
  );
}
