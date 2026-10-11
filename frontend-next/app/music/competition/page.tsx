import type { Metadata } from "next";
import MixCompetition from "../../../components/MixCompetition";
import "./competition.css";

const title = "UPFORIT NYE 2026 | DJ Mix Competition";
const description = "Win a DJ set at UPFORIT NYE at McCarthys, Bletchley. Submit your mix, listen to the entries and vote for your favourite.";
const shareImage = {
  url: "https://res.cloudinary.com/brandduk/image/upload/f_jpg,q_85,c_limit,w_1200/v1791733889/UPFORIT/site/mix-competition-share.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "UPFORIT NYE 2026 DJ Mix Competition — win a set at UPFORIT NYE. DJ at the decks with a crowd behind."
};

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/music/competition" },
  openGraph: {
    title,
    description,
    type: "website",
    url: "/music/competition",
    siteName: "UPFORIT",
    locale: "en_GB",
    images: [shareImage]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [shareImage]
  }
};

export default function CompetitionPage() {
  return <MixCompetition />;
}
