import type { Metadata } from "next";
import MixCompetition from "../../../components/MixCompetition";
import "./competition.css";

export const metadata: Metadata = {
  title: "DJ Mix Competition",
  description: "Enter the UPFORIT NYE DJ mix competition for a chance to play at McCarthys.",
  alternates: { canonical: "/music/competition" }
};

export default function CompetitionPage() {
  return <MixCompetition />;
}
