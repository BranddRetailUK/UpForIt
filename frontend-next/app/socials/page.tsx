import type { Metadata } from "next";
import SocialBrandIcon from "../../components/SocialBrandIcon";
import { SOCIAL_LINKS } from "../../lib/site";

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
              <SocialBrandIcon name={social.name} idPrefix="socials-page" />
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
