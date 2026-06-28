"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The lock on a private constellation. First arrival (no password yet) sets one,
// claiming it; after that it must match. "Remember me on this device" keeps you
// logged in (a persistent cookie vs. one that clears when the browser closes).
export default function PasswordGate({
  constellationId,
  hasPassword,
}: {
  constellationId: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function submit() {
    if (!password || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/auth/constellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, password, remember }),
      });
      if (!res.ok) throw new Error();
      router.refresh(); // re-render the now-unlocked page
    } catch {
      setState("error");
    }
  }

  return (
    <main className="wrap">
      <div className="mark">
        <h1>Constello</h1>
        <p>{hasPassword ? "this constellation is private" : "claim this constellation"}</p>
      </div>

      <p className="framing">
        {hasPassword
          ? "Enter your password to open it."
          : "Set a password — it's how you'll return to this constellation. There's no username and no recovery yet, so keep it somewhere safe."}
      </p>

      <input
        className="handle-input"
        type="password"
        autoFocus
        placeholder={hasPassword ? "password" : "choose a password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      <label className="remember-row">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        remember me on this device
      </label>

      <button className="ghost-btn" disabled={!password || state === "busy"} onClick={submit}>
        {state === "busy" ? "…" : hasPassword ? "Open" : "Claim"}
      </button>

      {state === "error" && (
        <p className="error">
          {hasPassword ? "Wrong password — try again." : "Could not save — try again."}
        </p>
      )}
    </main>
  );
}
