import Link from "next/link";

export default function MixCompetitionBanner({ inFeed = false }: { inFeed?: boolean }) {
  const headingId = inFeed ? "music-mix-competition-title" : "home-mix-title";
  return (
    <section className={`home-mix-banner ${inFeed ? "home-mix-banner--in-feed" : "section-wrap"}`} aria-labelledby={headingId}>
      <div className="home-mix-banner__content">
        <h2 id={headingId}>NYE MIX <em>COMPETITION</em></h2>
        <p>Win a set at UPFORIT NYE.</p>
        <Link className="industrial-button" href="/music/competition">Enter or vote</Link>
      </div>
    </section>
  );
}
