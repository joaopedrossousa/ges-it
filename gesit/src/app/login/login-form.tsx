"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import { MensagemErro } from "@/components/mensagem-erro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { executarAcao } from "@/lib/executar-acao";

import { login } from "./actions";
import { loginSchema, type LoginInput } from "./schema";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      // Em caso de sucesso, login() redireciona (repassado pelo executarAcao).
      const result = await executarAcao(() => login(values, searchParams.get("next")));
      if (result?.error) {
        setError("root", { message: result.error });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-erro" : undefined}
          disabled={isPending}
          {...register("email")}
        />
        <MensagemErro id="email-erro" mensagem={errors.email?.message} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-erro" : undefined}
          disabled={isPending}
          {...register("password")}
        />
        <MensagemErro id="password-erro" mensagem={errors.password?.message} />
      </div>

      {errors.root && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errors.root.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
