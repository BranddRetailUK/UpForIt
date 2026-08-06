import type { Metadata } from "next";
import { SOCIAL_LINKS } from "../../lib/site";

type SocialName = (typeof SOCIAL_LINKS)[number]["name"];

function SocialBrandIcon({ name }: { name: SocialName }) {
  if (name === "TikTok") {
    const note = "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.72-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.11-.01 2.18-.66 2.76-1.6.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d={note} fill="#25f4ee" transform="translate(-.45 .35)" />
        <path d={note} fill="#fe2c55" transform="translate(.45 -.35)" />
        <path d={note} fill="#050505" />
      </svg>
    );
  }

  if (name === "Facebook") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path fill="#1877f2" d="M13.7 21v-8h2.75l.41-3.15H13.7V7.84c0-.91.26-1.54 1.59-1.54H17V3.49c-.3-.04-1.3-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.27v2.22H7.58V13h2.78v8h3.34Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <defs>
        <linearGradient id="instagram-brand-gradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffdc80" />
          <stop offset=".3" stopColor="#f77737" />
          <stop offset=".58" stopColor="#e1306c" />
          <stop offset=".8" stopColor="#833ab4" />
          <stop offset="1" stopColor="#405de6" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="url(#instagram-brand-gradient)" strokeWidth="2.6" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="url(#instagram-brand-gradient)" strokeWidth="2.6" />
      <circle cx="17.55" cy="6.55" r="1.35" fill="url(#instagram-brand-gradient)" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "Socials",
  description: "Follow UPFORIT on TikTok, Facebook and Instagram.",
  alternates: { canonical: "/socials" }
};

export default function SocialsPage() {
  return (
    <div className="inner-page section-wrap">
      <header className="page-intro">
        <p className="comic-kicker comic-kicker--yellow">Keep up with us</p>
        <h1>Socials</h1>
        <p>Event news, sounds, behind-the-scenes energy and every new drop.</p>
      </header>

      <section className="social-grid" aria-label="UPFORIT social profiles">
        {SOCIAL_LINKS.map((social, index) => (
          <a
            className={`social-card social-card--${index + 1}`}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            key={social.name}
          >
            <span className="social-card__icon" aria-hidden="true">
              <SocialBrandIcon name={social.name} />
            </span>
            <span className="social-card__copy">
              <strong>{social.name}</strong>
              <span>{social.handle}</span>
            </span>
            <span className="social-card__arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </section>
    </div>
  );
}
