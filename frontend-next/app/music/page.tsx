import type { Metadata } from "next";
import MusicHub from "../../components/MusicHub";
import { MUSIC_CONTENT } from "../../lib/music";

export const metadata: Metadata = {
  title: "Music & Mixes",
  description:
    "Listen to UPFORIT artist mixes, watch live sessions and meet the selectors behind the music.",
  alternates: { canonical: "/music" },
  openGraph: {
    title: "UPFORIT | Music & Mixes",
    description:
      "Listen to UPFORIT artist mixes, watch live sessions and meet the selectors behind the music.",
    url: "/music"
  }
};

export default function MusicPage() {
  return (
    <div className="music-page">
      <header className="music-page__intro section-wrap">
        <p className="comic-kicker comic-kicker--pink">Turn it up</p>
        <div className="music-page__title-lockup">
          <span aria-hidden="true">♪</span>
          <h1>Music <i>&amp;</i> Mixes</h1>
          <span aria-hidden="true">★</span>
        </div>
      </header>

      <MusicHub blocks={MUSIC_CONTENT} />
    </div>
  );
}
