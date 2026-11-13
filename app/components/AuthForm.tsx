"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignup) {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Couldn't create your account.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Incorrect email or password.");
        return;
      }
      router.push("/study");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6">
      <div className="absolute top-3 right-4"></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ShelfWornDrawn.jpeg"
        alt="An illustrated stack of well-loved books"
        className="ring-line mb-6 w-44 rounded-xl ring-1"
      />
      <div className="border-line bg-surface/70 w-full max-w-sm rounded-2xl border p-8 shadow-sm">
        <h1 className="text-ink text-center font-serif text-3xl font-semibold tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-ink-soft mt-2 text-center text-sm">
          The study is private — sign in to open the books.
        </p>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="border-line text-ink hover:bg-ink/5 mt-8 flex w-full items-center justify-center gap-2 rounded-lg border bg-transparent px-4 py-2.5 text-sm font-medium"
        >
          Continue with Google
        </button>

        <div className="text-ink-soft my-6 flex items-center gap-3 text-xs">
          <span className="bg-line h-px flex-1" />
          or
          <span className="bg-line h-px flex-1" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {isSignup && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoComplete="name"
              required
              className="border-line text-ink focus:border-accent w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="border-line text-ink focus:border-accent w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            className="border-line text-ink focus:border-accent w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
          />
          {!isSignup && (
            <p className="text-ink-soft/70 px-1 text-xs italic">
              hint: it&apos;s your hotspot
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="bg-accent text-accent-ink w-full rounded-full px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="text-ink-soft mt-6 text-center text-sm">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/signup" className="text-accent hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
