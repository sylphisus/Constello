import type { Metadata } from "next";
import "./privacy.css";

export const metadata: Metadata = {
  title: "Privacy — Constello",
  description: "What Constello collects, how it's used, and how to have it removed.",
};

// Plain, accurate account of what the app actually stores (see db/migration.alpha.sql)
// and the services it sends data to. Hosted so it has a stable public URL for the
// X / Last.fm / Pinterest developer-app forms.
export default function Privacy() {
  return (
    <main className="wrap legal">
      <div className="mark">
        <h1>Constello</h1>
        <p>Privacy Policy</p>
      </div>

      <p className="legal-meta">Last updated: June 26, 2026</p>

      <p className="framing">
        Constello reads the collections you bring it — writing of your own, what
        you listen to, what you post — for the world underneath them, and returns
        a reading. This policy explains what it stores, what it sends to other
        services, and how to have your data removed. It's a small, alpha-stage
        project; the practices below are deliberately narrow.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>The collections you submit.</strong> Text you paste or upload,
          and — only when you ask for it — content fetched on your behalf from
          services you name: your Last.fm listening history, your public X
          (Twitter) posts, and your Pinterest boards and pins. We fetch only
          public or explicitly authorized data, through each service's official
          API.
        </li>
        <li>
          <strong>What we generate from it.</strong> The readings written about
          your collections, and numeric vector representations (embeddings) of
          those readings used to relate one constellation to another.
        </li>
        <li>
          <strong>Contact details you choose to give.</strong> An email address,
          an X handle, or — if you message our line — an iMessage handle, kept
          only so we can tell you when a reading is ready.
        </li>
      </ul>
      <p>
        There are no accounts and no passwords. A constellation is identified by a
        random ID in its URL. We don't use advertising or analytics cookies, and
        we don't track you across other sites.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To produce your readings and the cross-collection essence.</li>
        <li>To notify you, on a channel you opted into, when a reading is ready.</li>
      </ul>
      <p>
        We do not sell your data, use it for advertising, or use it to build
        profiles for anyone other than you.
      </p>

      <h2>Services we share it with</h2>
      <p>
        To run, Constello passes data to a small set of providers, each acting on
        our behalf:
      </p>
      <ul>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li><strong>Supabase</strong> — database storage.</li>
        <li><strong>Anthropic (Claude)</strong> — generating the readings.</li>
        <li><strong>Voyage AI</strong> — generating embeddings of the readings.</li>
        <li>
          <strong>The platforms you connect</strong> (Last.fm, X, Pinterest) — to
          fetch the content you ask us to read. Your use of those platforms
          remains governed by their own privacy policies.
        </li>
      </ul>

      <h2>Pinterest data</h2>
      <p>
        If you connect Pinterest, Constello accesses your boards and pins only
        with your authorization and only to generate your reading. We do not sell
        or share Pinterest data, do not use it for advertising, and retain it only
        as long as needed for your constellation. You can revoke access at any
        time in your Pinterest account settings, and request deletion as below.
        We handle Pinterest data in accordance with the Pinterest Developer
        Guidelines and Terms.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your constellation exists. You can ask us to
        delete your constellation and everything attached to it — collections,
        readings, embeddings, and contact details — at any time, by emailing the
        address below. Deletion is permanent and cascades to all associated
        records.
      </p>

      <h2>Children</h2>
      <p>
        Constello is not directed to children and is not intended for anyone under
        16. We don't knowingly collect data from them.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, we'll update the date at the top of this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or deletion requests:{" "}
        <a href="mailto:yuneekae1@gmail.com">yuneekae1@gmail.com</a>.
      </p>
    </main>
  );
}
