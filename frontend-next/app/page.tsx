import Image from "next/image";
import Countdown from "../components/Countdown";
import ParallaxBackground from "../components/ParallaxBackground";
import SignupForm from "../components/SignupForm";

const EVENT_DATE = "2026-03-28T18:00:00Z";
const FLYER_IMAGE =
  "https://cdn.shopify.com/s/files/1/0841/7545/4535/files/FLYER_NEW.jpg?v=1769687281";

export const revalidate = 3600;

const LINEUP_ROWS = [
  ["Spektral", "Chippa", "Garron T & Darko"],
  ["Sinik", "Savage", "Scott Charles"],
  ["Skandal", "Deechase", "Frantic & Robz"]
];

const HOSTS = ["E Dappa", "Danzee", "Razor", "Ashman"];

export default function Home() {
  return (
    <main className="flyer">
      <ParallaxBackground
        src={FLYER_IMAGE}
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjMDkwYjEwIi8+PC9zdmc+"
      />
      <div className="glow glow--one" aria-hidden="true" />
      <div className="glow glow--two" aria-hidden="true" />
      <div className="glow glow--three" aria-hidden="true" />

      <header className="top reveal delay-1">
        <p className="genres">Jungle / DnB / UK Bass / Breaks / Garage</p>
      </header>

      <section className="title-block reveal delay-2">
        <Image
          className="title-logo"
          src="https://cdn.shopify.com/s/files/1/0841/7545/4535/files/LOGO_fc874e43-237b-46c4-aad0-e6d514d6efc5.png?v=1769683316"
          alt="UP FOR IT logo"
          width={520}
          height={220}
          priority
        />
        <div className="divider" aria-hidden="true" />
        <p className="subtitle">Exclusive event. Limited tickets.</p>
      </section>

      <section className="lineup reveal delay-3">
        <div className="section-heading section-heading--stacked">
          <span className="section-label">Lineup</span>
          <span className="section-underline" aria-hidden="true" />
        </div>
        <div className="lineup-rows">
          {LINEUP_ROWS.map((row, rowIndex) => (
            <div className="lineup-row" key={`row-${rowIndex}`}>
              {row.map((artist, index) => (
                <div className="lineup-item" key={artist}>
                  <span className="lineup-name">{artist}</span>
                  {index < row.length - 1 ? (
                    <span className="lineup-divider" aria-hidden="true">
                      |
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="hosts reveal delay-4">
        <div className="section-heading section-heading--stacked">
          <span className="section-label">Hosts</span>
          <span className="section-underline" aria-hidden="true" />
        </div>
        <div className="hosts-row">
          {HOSTS.map((host, index) => (
            <div className="host-item" key={host}>
              <span className="host-name">{host}</span>
              {index < HOSTS.length - 1 ? (
                <span className="host-divider" aria-hidden="true">
                  |
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="details reveal delay-5">
        <div className="detail-column">
          <div className="detail-block">
            <span className="detail-title">Date</span>
            <span className="detail-value">Sat, 28 March</span>
          </div>
          <div className="detail-block">
            <span className="detail-title">Time</span>
            <span className="detail-value">18:00 - 01:00</span>
          </div>
        </div>
        <div className="detail-block detail-block--venue">
          <span className="detail-title">Venue</span>
          <span className="detail-value">McCarthys Sports Bar</span>
          <span className="detail-sub">Bletchley, MK2 2SN</span>
        </div>
      </section>

      <section className="countdown-panel reveal delay-6">
        <Countdown target={EVENT_DATE} />
      </section>

      <section className="cta-row reveal delay-7">
        <button className="btn btn--solid" type="button">
          Buy Ticket
        </button>
        <button className="btn btn--ghost" type="button">
          VIP Access
        </button>
      </section>

      <section className="signup reveal delay-8">
        <div className="section-heading">
          <span className="section-line" />
          <span className="section-label">Email signup</span>
          <span className="section-line" />
        </div>
        <SignupForm />
      </section>

    </main>
  );
}
