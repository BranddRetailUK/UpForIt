import type { Metadata } from "next";
import { SOCIAL_LINKS } from "../../lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact UPFORIT for bookings, collaborations and general enquiries.",
  alternates: { canonical: "/contact" }
};

export default function ContactPage() {
  return (
    <div className="inner-page section-wrap">
      <header className="page-intro">
        <p className="comic-kicker comic-kicker--pink">Let&apos;s talk</p>
        <h1>Contact</h1>
        <p>
          Bookings, collaborations or a general question? Drop us a message on
          your favourite platform.
        </p>
      </header>

      <section className="contact-panel" aria-labelledby="contact-heading">
        <div className="contact-panel__burst" aria-hidden="true">POW!</div>
        <h2 id="contact-heading">Message UPFORIT</h2>
        <p>Choose a social and head straight to our official profile.</p>
        <div className="contact-links">
          {SOCIAL_LINKS.map((social) => (
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              key={social.name}
            >
              <span aria-hidden="true">{social.shortLabel}</span>
              {social.name}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

