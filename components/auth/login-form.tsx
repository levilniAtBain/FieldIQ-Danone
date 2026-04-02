"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { loginAction } from "@/app/login/actions";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, null);

  return (
    <form action={action} noValidate className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
            "focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
            "border-gray-200"
          )}
          placeholder="you@loreal.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-sm outline-none transition",
            "focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
            "border-gray-200"
          )}
          placeholder="••••••••"
        />
      </div>

      {state?.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "w-full rounded-xl bg-brand-600 text-white font-medium py-3 text-sm",
          "hover:bg-brand-700 transition-colors",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "flex items-center justify-center gap-2"
        )}
      >
        {isPending ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
