"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Google Docs connect: the person clicks → Google Identity Services hands the
// browser a short-lived access token → the Google Picker lets them choose one
// doc → we POST {docId, accessToken} to /api/collections/google-docs, which
// pulls the text once and discards the token. Nothing is stored client-side.
//
// drive.readonly keeps the Picker config simple (no app-id grant dance); the
// least-privilege upgrade is drive.file + a Picker setAppId, later.

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

// The globals injected by the two Google scripts. Kept `any` and contained here.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google’s scripts."));
    document.head.appendChild(s);
  });
}

export default function GoogleDocsButton({
  constellationId,
}: {
  constellationId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  if (!clientId || !apiKey) {
    return <p className="framing">Google Docs isn’t configured yet.</p>;
  }

  async function importDoc(docId: string, accessToken: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/collections/google-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constellationId, docId, accessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not import the doc.");
      router.push(`/c/${data.constellationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import the doc.");
      setBusy(false);
    }
  }

  function openPicker(accessToken: string) {
    const { google } = window;
    const view = new google.picker.DocsView(google.picker.ViewId.DOCUMENTS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMimeTypes("application/vnd.google-apps.document");
    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .addView(view)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          importDoc(data.docs[0].id, accessToken);
        } else if (data.action === google.picker.Action.CANCEL) {
          setBusy(false);
        }
      })
      .build();
    picker.setVisible(true);
  }

  async function connect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await loadScript("https://accounts.google.com/gsi/client");
      await loadScript("https://apis.google.com/js/api.js");
      await new Promise<void>((resolve) => window.gapi.load("picker", resolve));

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) {
            setError("Google connection was cancelled.");
            setBusy(false);
            return;
          }
          openPicker(resp.access_token);
        },
      });
      tokenClient.requestAccessToken();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to Google.");
      setBusy(false);
    }
  }

  return (
    <>
      <button className="primary-btn" disabled={busy} onClick={connect}>
        {busy ? "Connecting…" : "Connect Google Docs"}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  );
}
