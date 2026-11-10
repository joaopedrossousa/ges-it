import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/60 p-4">
      <Card className="w-full max-w-sm border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Produtécnica Agro"
            width={3626}
            height={1418}
            sizes="16rem"
            preload
            className="mx-auto h-auto w-64"
          />
          <CardTitle className="text-xl">GesIT</CardTitle>
          <CardDescription>Entre com seu e-mail e senha.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* O formulário lê ?next= no navegador; até lá, um esqueleto. */}
          <Suspense
            fallback={
              <div className="grid gap-4" role="status" aria-label="Carregando...">
                {[0, 1].map((i) => (
                  <div key={i} className="grid gap-2">
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-8 animate-pulse rounded-lg bg-muted" />
                  </div>
                ))}
                <div className="h-9 animate-pulse rounded-lg bg-muted" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
