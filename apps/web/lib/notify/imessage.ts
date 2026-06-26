// Outbound iMessage via Photon's spectrum-ts (managed iMessage line).
// Best-effort and env-gated: without PHOTON_PROJECT_ID / PHOTON_PROJECT_SECRET
// the send is skipped, like the other adapters. The opt-in (capturing a handle)
// happens on the inbound side — app/api/inbound/imessage/route.ts.
//
// The SDK is loaded dynamically and typed loosely on purpose: it's an external
// dependency whose surface we don't want to couple the build to. The outbound
// path is the documented one:
//   const im = imessage(app); im.user(phone) → im.space.create(user) → space.send
//   https://photon.codes/docs/spectrum-ts/spaces-and-users

let appPromise: Promise<unknown> | null = null;

async function getApp(): Promise<unknown | null> {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) return null;

  if (!appPromise) {
    appPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Spectrum } = (await import("spectrum-ts")) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { imessage } = (await import("spectrum-ts/providers/imessage")) as any;
      return Spectrum({ projectId, projectSecret, providers: [imessage.config()] });
    })();
  }
  return appPromise;
}

export async function sendImessage(toPhone: string, text: string): Promise<boolean> {
  try {
    const app = await getApp();
    if (!app) {
      console.warn("[notify/imessage] PHOTON_PROJECT_ID / SECRET not set — skipped.");
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { imessage } = (await import("spectrum-ts/providers/imessage")) as any;
    const im = imessage(app);
    const user = await im.user(toPhone);
    const space = await im.space.create(user);
    await space.send(text);
    return true;
  } catch (err) {
    console.error("[notify/imessage] send failed:", err);
    return false;
  }
}
