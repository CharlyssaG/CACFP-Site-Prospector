"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Lock, Eye, EyeOff } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL!;

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password,
    });

    if (authError) {
      setError("Incorrect password. Please try again.");
      setIsLoading(false);
      return;
    }

    router.push("/admin/upload");
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--color-navy)" }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8"
        style={{
          background: "white",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: "var(--color-light-blue)" }}
          >
            <Lock size={20} style={{ color: "var(--color-blue)" }} />
          </div>
          <div className="text-sm font-semibold mb-1" style={{ color: "var(--color-ink-faint)" }}>
            <span style={{ color: "var(--color-navy)" }}>Kid</span>
            <span style={{ color: "var(--color-blue)" }}>Kare</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-navy)" }}>
            Admin Access
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted-text)" }}>
            Enter your password to continue
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="input-field pr-10"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-ink-faint)" }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs font-medium" style={{ color: "#DC2626" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2"
            disabled={isLoading || !password}
          >
            {isLoading ? (
              <span
                className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              />
            ) : null}
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-ink-faint)" }}>
          <a href="/" style={{ color: "var(--color-blue)" }}>← Back to Site Prospector</a>
        </p>
      </div>
    </main>
  );
}
