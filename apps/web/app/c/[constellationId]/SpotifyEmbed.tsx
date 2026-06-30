// Renders a collected Spotify playlist/album/artist inline using Spotify's
// official embed iframe — the music-source parallel to PinterestBoard. The embed
// renders live (and dark by default, theme=0) off the link stored on the pending
// entry; there's no API pull and nothing stored. The hand-read still happens from
// the embed / screenshots — this just keeps the artifact present beside its
// reading.
export default function SpotifyEmbed({ src }: { src: string }) {
  return (
    <div className="spotify-embed">
      <iframe
        src={src}
        title="Spotify embed"
        width="100%"
        height={352}
        loading="lazy"
        allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture"
      />
    </div>
  );
}
