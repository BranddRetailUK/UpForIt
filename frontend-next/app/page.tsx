import Image from "next/image";
import Countdown from "../components/Countdown";
import EventVideoPlayer from "../components/EventVideoPlayer";
import LineupList, { type LineupRow } from "../components/LineupList";
import ParallaxBackground from "../components/ParallaxBackground";
import ScrollToTopOnLoad from "../components/ScrollToTopOnLoad";
import SignupForm from "../components/SignupForm";

const EVENT_DATE = "2026-06-27T12:00:00+01:00";
const POSTER_IMAGE = "/new-flyer/poster.png";
const LOGO_IMAGE = "/new-flyer/logo.png";
const VIDEO_URL =
  "https://res.cloudinary.com/dhlqooyuk/video/upload/v1782067528/UpForIt_MiniMix_dzr5yt.mp4";

export const revalidate = 3600;

const GENRES = [
  "UKG",
  "Drum & Bass",
  "Electro",
  "UK Bass",
  "Prog",
  "Hardcore",
  "Garage"
];

const LINEUP_ROWS: LineupRow[] = [
  [{ text: "Spektral", lead: true }],
  [{ text: "Diatribe Showcase" }],
  [{ text: "Scott Charles" }],
  [{ text: "Sinik" }, { text: "B2B", tone: "accent" }, { text: "Savage" }],
  [{ text: "Slumber Jack" }],
  [{ text: "Dechase" }, { text: "B2B", tone: "accent" }, { text: "Lady Elusive" }],
  [
    { text: "Luke Teknology" },
    { text: "B2B", tone: "accent" },
    { text: "Spin Larden" }
  ],
  [{ text: "Ectomorph" }, { text: "|", tone: "bar" }, { text: "Vessel" }]
];

const MC_ROWS = [
  ["E Dappa", "Danzee", "Razor"],
  ["Ashman", "Treble", "Hypeman"]
];

const MOTTOES = ["Good Vibes Only", "Respect The Ravers", "No Bad Energy"];

export default function Home() {
  return (
    <main className="flyer">
      <ScrollToTopOnLoad />
      <ParallaxBackground
        srcDesktop={POSTER_IMAGE}
        srcMobile={POSTER_IMAGE}
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDUwNTA3Ii8+PC9zdmc+"
      />
      <div className="scratch-layer" aria-hidden="true" />
      <div className="light-rig light-rig--left" aria-hidden="true" />
      <div className="light-rig light-rig--right" aria-hidden="true" />

      <header className="hero reveal delay-1">
        <ul className="genre-strip" aria-label="Music genres">
          {GENRES.map((genre) => (
            <li key={genre}>{genre}</li>
          ))}
        </ul>

        <div className="hero-lockup">
          <Image
            className="hero-logo"
            src={LOGO_IMAGE}
            alt="UPFORIT logo"
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 720px) 340px, 1200px"
          />
        </div>

        <h1 className="sr-only">UPFORIT Multi Genre Day Festival</h1>
      </header>

      <section className="event-panel reveal delay-2" aria-labelledby="event-title">
        <div className="event-ribbon">
          <span id="event-title">Multi Genre Day Festival</span>
        </div>
        <div className="event-grid">
          <div className="event-block event-block--time">
            <span className="event-label">Midday - 10PM</span>
            <span className="event-value">Saturday 27 June 2026</span>
          </div>
          <div className="event-block event-block--venue">
            <span className="event-label">McCarthys</span>
            <span className="event-value">Sports Bar</span>
            <span className="event-sub">Bletchley • MK2 2SN</span>
          </div>
        </div>
      </section>

      <section className="lineup reveal delay-3" aria-labelledby="djs-heading">
        <div className="section-heading section-heading--blue">
          <span className="section-line" aria-hidden="true" />
          <h2 id="djs-heading" className="section-label">
            DJs
          </h2>
          <span className="section-line" aria-hidden="true" />
        </div>
        <LineupList rows={LINEUP_ROWS} />
      </section>

      <section className="mcs reveal delay-4" aria-labelledby="mcs-heading">
        <div className="section-heading section-heading--yellow">
          <span className="section-line" aria-hidden="true" />
          <h2 id="mcs-heading" className="section-label">
            MCs
          </h2>
          <span className="section-line" aria-hidden="true" />
        </div>
        <div className="mc-rows">
          {MC_ROWS.map((row, rowIndex) => (
            <div className="mc-row" key={`mc-row-${rowIndex}`}>
              {row.map((mc, index) => (
                <span className="mc-name" key={mc}>
                  {mc}
                  {index < row.length - 1 ? (
                    <span className="dot-divider" aria-hidden="true">
                      •
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="video-panel reveal delay-5" aria-label="Event video">
        <EventVideoPlayer src={VIDEO_URL} title="UPFORIT mini mix video" />
      </section>

      <section className="countdown-panel reveal delay-6" aria-label="Countdown to event">
        <div className="section-heading section-heading--magenta">
          <span className="section-line" aria-hidden="true" />
          <span className="section-label">Countdown</span>
          <span className="section-line" aria-hidden="true" />
        </div>
        <Countdown target={EVENT_DATE} />
      </section>

      <section className="signup reveal delay-7" aria-labelledby="signup-heading">
        <div className="section-heading section-heading--magenta">
          <span className="section-line" aria-hidden="true" />
          <h2 id="signup-heading" className="section-label">
            Email Signup
          </h2>
          <span className="section-line" aria-hidden="true" />
        </div>
        <SignupForm />
      </section>

      <footer className="motto-strip reveal delay-8" aria-label="Event code of conduct">
        {MOTTOES.map((motto) => (
          <span key={motto}>{motto}</span>
        ))}
      </footer>
    </main>
  );
}
