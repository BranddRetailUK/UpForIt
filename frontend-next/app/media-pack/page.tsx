import type { Metadata } from "next";
import Image from "next/image";
import manifest from "./assets.json";
import styles from "./page.module.css";

const title = "UPFORIT Media Pack | Logos & Brand Assets";
const description = "Official UPFORIT logos and brand assets for promoters, artists and event designers. Download individual files or grab the complete media pack.";
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: false, follow: false },
  alternates: { canonical: "/media-pack" },
  openGraph: { title, description, url: "/media-pack", type: "website", siteName: "UPFORIT", locale: "en_GB", images: [{ url: manifest.socialUrl, width: 1200, height: 630, alt: "UPFORIT Media Pack — Official logos & brand assets" }] },
  twitter: { card: "summary_large_image", title, description, images: [manifest.socialUrl] }
};

const mainLogos = [
  { id: "current-yellow-white", title: "Yellow / White", detail: "For dark backgrounds", light: false },
  { id: "current-yellow-black", title: "Yellow / Black", detail: "For light backgrounds", light: true },
  { id: "current-all-white", title: "All white", detail: "For dark backgrounds", light: false },
  { id: "current-all-black", title: "All black", detail: "For light backgrounds", light: true }
];
const alternativeLogos = [
  { id: "round-badge", title: "Round badge", detail: "Full-colour badge", light: false },
  { id: "circle-yellow-white", title: "Circle · yellow / white", detail: "For dark backgrounds", light: false },
  { id: "circle-yellow-black", title: "Circle · yellow / black", detail: "For light backgrounds", light: true },
  { id: "stacked-yellow-white", title: "Stacked · yellow / white", detail: "For dark backgrounds", light: false },
  { id: "stacked-yellow-black", title: "Stacked · yellow / black", detail: "For light backgrounds", light: true },
  { id: "classic-yellow-white", title: "Classic · yellow / white", detail: "For dark backgrounds", light: false },
  { id: "classic-white", title: "Classic · white", detail: "For dark backgrounds", light: false },
  { id: "classic-black", title: "Classic · black", detail: "For light backgrounds", light: true }
];
const smileys = [
  { id: "smiley-yellow", title: "Acid yellow", detail: "Original smiley", light: false },
  { id: "smiley-white", title: "White", detail: "For dark backgrounds", light: false },
  { id: "smiley-black", title: "Black", detail: "For light backgrounds", light: true },
  { id: "smiley-solid-yellow-black", title: "Solid smiley", detail: "Yellow / black", light: false }
];
const formatOrder = ["png", "webp", "pdf", "jpg"];
function size(bytes: number) { return bytes >= 1000000 ? `${(bytes / 1000000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`; }
function DownloadIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>; }
function LogoCard({ logo, main = false }: { logo: typeof mainLogos[number]; main?: boolean }) {
  const stem = `UPFORIT-${logo.id}`;
  const files = manifest.files.filter(file => !file.name.endsWith(".tif") && (file.name.startsWith(`${stem}.`) || file.name.startsWith(`${stem}-on-`))).sort((a, b) => formatOrder.indexOf(a.name.split(".").pop()!) - formatOrder.indexOf(b.name.split(".").pop()!));
  const preview = manifest.files.find(file => file.name === `${stem}.png`)!;
  return <article className={styles.card}>
    <div className={`${styles.preview} ${logo.light ? styles.light : ""} ${main ? styles.mainPreview : ""}`}>
      <Image src={preview.previewUrl!} alt={`UPFORIT ${logo.title} logo`} width={640} height={main ? 214 : 280} className={styles.logo} sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 25vw" />
    </div>
    <div className={styles.cardBody}><h3>{logo.title}</h3><p>{logo.detail}</p>
      <div className={styles.formats}>{files.map(file => <a key={file.name} href={`/media-pack/download/${file.downloadName}`} download={file.downloadName} aria-label={`Download ${logo.title} ${file.name.split(".").pop()!.toUpperCase()} (${size(file.bytes)})`} title={`${size(file.bytes)} · ${file.name.endsWith(".jpg") ? "Solid background" : "Transparent artwork"}`}><span>{file.name.endsWith(".tif") ? "TIFF" : file.name.split(".").pop()!.toUpperCase()}</span><DownloadIcon /></a>)}</div>
    </div>
  </article>;
}
export default function MediaPackPage() {
  return <div className={styles.page}>
    <header className={styles.hero}>
      <Image src={manifest.bannerUrl} alt="" fill priority sizes="100vw" className={styles.heroImage} />
      <div className={styles.heroShade} />
      <div className={`${styles.wrap} ${styles.heroContent}`}>
        <h1>MAKE SOME<br /><em>NOISE.</em></h1>
        <div className={styles.heroActions}><a className={styles.primaryButton} href="/media-pack/download/UPFORIT-Media-Pack.zip" download="UPFORIT-Media-Pack.zip"><DownloadIcon /> DOWNLOAD FULL PACK <span>ZIP · {size(manifest.zipBytes)}</span></a><a className={styles.browseLink} href="#main-logos">Browse the assets <span aria-hidden="true">↓</span></a></div>
      </div>
    </header>
    <div className={styles.wrap}>
      <section id="main-logos" className={styles.section} aria-labelledby="main-logos-title">
        <div className={styles.sectionHeading}><div><h2 id="main-logos-title">MAIN LOGO<span>.</span></h2></div></div>
        <div className={styles.grid}>{mainLogos.map(logo => <LogoCard key={logo.id} logo={logo} main />)}</div>
      </section>
      <section id="alternative-logos" className={styles.section} aria-labelledby="alternative-logos-title">
        <div className={styles.sectionHeading}><div><h2 id="alternative-logos-title">CIRCLE LOGO<span>.</span></h2></div></div>
        <div className={styles.grid}>{alternativeLogos.map(logo => <LogoCard key={logo.id} logo={logo} />)}</div>
      </section>
      <section id="smileys" className={styles.section} aria-labelledby="smileys-title">
        <div className={styles.sectionHeading}><div><h2 id="smileys-title">SMILE ICON</h2></div></div>
        <div className={styles.grid}>{smileys.map(logo => <LogoCard key={logo.id} logo={logo} />)}</div>
      </section>
      <div className={styles.contactAction}><a className={styles.primaryButton} href="/contact">NEED SOMETHING ELSE? GET IN TOUCH</a></div>
    </div>
  </div>;
}
