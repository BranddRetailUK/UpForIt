import Image from "next/image";
import styles from "./BlackleyReleaseFeature.module.css";

const releaseUrl = "https://www.beatport.com/release/move-ya-body/7141042";

// Release details and artwork: Beatport release 7141042 (NRD098).
// Social destinations: https://linktr.ee/blackley. Verified 24 October 2026.
export default function BlackleyReleaseFeature() {
  return (
    <section
      className={`${styles.feature} section-wrap`}
      id="blackley-move-ya-body"
      aria-labelledby="blackley-release-title"
    >
      <div className={styles.hero}>
        <a className={styles.artwork} href={releaseUrl} target="_blank" rel="noopener noreferrer" aria-label="View Move Ya Body by Blackley on Beatport (opens in a new tab)">
          <Image
            src="/brand/music/blackley-move-ya-body.jpg"
            alt="Blackley — Move Ya Body, official Nemesis Recordings Digital cover artwork"
            width={500}
            height={500}
            sizes="(max-width: 760px) calc(100vw - 72px), (max-width: 1100px) 40vw, 480px"
          />
        </a>

        <div className={styles.copy}>
          <p className={styles.artist}>Blackley</p>
          <h2 id="blackley-release-title">Move Ya<br />Body<span>.</span></h2>
          <p className={styles.intro}>
            Blackley lands on Nemesis Recordings Digital with “Move Ya Body” —
            a drum &amp; bass single driven by hard-hitting drums and a wobbling bassline.
            A taste of the six-deck specialist’s dancefloor sound.
          </p>

          <dl className={styles.facts}>
            <div><dt>Label</dt><dd>Nemesis Recordings Digital</dd></div>
            <div><dt>Released</dt><dd><time dateTime="2026-07-30">30 July 2026</time></dd></div>
            <div><dt>Genre</dt><dd>Drum &amp; Bass</dd></div>
          </dl>

          <a className={styles.releaseLink} href={releaseUrl} target="_blank" rel="noopener noreferrer">
            Listen / buy on Beatport
          </a>
        </div>
      </div>

      <div className={styles.about}>
        <Image
          className={styles.profile}
          src="/brand/music/blackley-profile.webp"
          alt="Blackley"
          width={600}
          height={750}
          sizes="(max-width: 760px) 200px, 240px"
        />
        <div>
          <p>
            A Milton Keynes DJ and producer, Blackley is the founder of Cre8DnB
            and is known for his six-deck sets. His releases span labels including
            RAM Records, Viper and Low Down Deep. “Move Ya Body” brings him to
            Nemesis Recordings Digital for catalogue number NRD098.
          </p>
          <p className={styles.socials}>
            Keep up with Blackley on{" "}
            <a href="https://instagram.com/djblackley" target="_blank" rel="noopener noreferrer">Instagram</a>,{" "}
            <a href="https://www.facebook.com/djblackley" target="_blank" rel="noopener noreferrer">Facebook</a>,{" "}
            <a href="https://tiktok.com/@djblackley" target="_blank" rel="noopener noreferrer">TikTok</a>{" "}
            and <a href="https://soundcloud.com/dj-blackley" target="_blank" rel="noopener noreferrer">SoundCloud</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
