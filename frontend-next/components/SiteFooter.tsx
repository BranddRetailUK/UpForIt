import Link from "next/link";
import { NAV_ITEMS, SOCIAL_LINKS } from "../lib/site";
import CookieSettingsButton from "./CookieSettingsButton";
import SocialBrandIcon from "./SocialBrandIcon";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <nav className="footer-nav" aria-label="Footer navigation">
          {NAV_ITEMS.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="footer-socials" aria-label="UPFORIT social links">
          {SOCIAL_LINKS.map((social) => (
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`UPFORIT on ${social.name}`}
              key={social.name}
            >
              <SocialBrandIcon name={social.name} idPrefix="site-footer" />
            </a>
          ))}
        </div>
      </div>
      <p className="site-footer__legal">
        <span>© 2026 UPFORIT. All good vibes reserved.</span>
        <Link href="/privacy">Privacy</Link>
        <CookieSettingsButton />
      </p>
    </footer>
  );
}
