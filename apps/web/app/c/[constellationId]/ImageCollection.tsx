"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The owner-side view + editor for one image collection. Shows the images as a
// grid; the owner can remove any image or add more (≤10 at a time). Every change
// queues a re-read — the prior reading stays visible below, and this surfaces a
// "being re-read…" note until the new one lands.

export interface ColImage {
  id: string;
  url: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_PER_UPLOAD = 10;

export default function ImageCollection({
  entryId,
  images,
  needsReread,
  hasReading,
}: {
  entryId: string;
  images: ColImage[];
  needsReread: boolean;
  hasReading: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (!files.length || busy) return;
    if (files.length > MAX_PER_UPLOAD) {
      setError(`Up to ${MAX_PER_UPLOAD} images at a time.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      for (const f of files) body.append("images", f);
      const res = await fetch(`/api/collections/images/${entryId}`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn’t add.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t add.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(imageId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/collections/images/${entryId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn’t remove.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t remove.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="image-collection">
      <div className="image-grid">
        {images.map((img) => (
          <div className="image-cell" key={img.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" loading="lazy" />
            <button
              className="image-remove"
              aria-label="Remove image"
              disabled={busy}
              onClick={() => remove(img.id)}
            >
              ×
            </button>
          </div>
        ))}

        <label className="image-add" aria-disabled={busy}>
          <span>+ add</span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            disabled={busy}
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {needsReread ? (
        <p className="thinking">changes saved — being re-read…</p>
      ) : !hasReading ? (
        <p className="thinking">being read…</p>
      ) : null}
    </div>
  );
}
