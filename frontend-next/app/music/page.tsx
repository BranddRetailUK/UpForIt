import type { Metadata } from "next";
import MusicHub from "../../components/MusicHub";
import { MUSIC_CONTENT } from "../../lib/music";

const RELEASE_SHARE_DESCRIPTION = "Check out Married To The Music / Grift";
const RELEASE_SHARE_IMAGE =
  "https://res.cloudinary.com/brandduk/image/upload/v1786528232/a1053183844_10_eahqtq.jpg";
const RELEASE_SHARE_ID = "spektral-married-to-the-music-grift";
const MUSIC_PAGE_DESCRIPTION =
  "Listen to UPFORIT artist mixes, watch live sessions and meet the artists behind the music.";

type MusicPageProps = {
  searchParams: Promise<{ release?: string | string[] }>;
};

export async function generateMetadata({ searchParams }: MusicPageProps): Promise<Metadata> {
  const release = (await searchParams).release;
  const isReleaseShare = release === RELEASE_SHARE_ID;

  if (!isReleaseShare) {
    return {
      title: "Music & Mixes",
      description: MUSIC_PAGE_DESCRIPTION,
      alternates: { canonical: "/music" },
      openGraph: {
        title: "UPFORIT | Music & Mixes",
        description: MUSIC_PAGE_DESCRIPTION,
        url: "/music"
      }
    };
  }

  return {
    title: "Music & Mixes",
    description: RELEASE_SHARE_DESCRIPTION,
    alternates: { canonical: "/music" },
    openGraph: {
      title: "UPFORIT | Music & Mixes",
      description: RELEASE_SHARE_DESCRIPTION,
      url: `/music?release=${RELEASE_SHARE_ID}`,
      images: [
        {
          url: RELEASE_SHARE_IMAGE,
          width: 1200,
          height: 1200,
          type: "image/jpeg",
          alt: "Spektral — Married To The Music / Grift release artwork"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: "UPFORIT | Music & Mixes",
      description: RELEASE_SHARE_DESCRIPTION,
      images: [RELEASE_SHARE_IMAGE]
    }
  };
}

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
