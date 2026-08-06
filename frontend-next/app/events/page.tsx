import type { Metadata } from "next";
import SummerRoundupCard from "../../components/SummerRoundupCard";

export const metadata: Metadata = {
  title: "Events",
  description:
    "The Summer Roundup lands at McCarthys Sports Bar on 26 September 2026, noon until 11PM.",
  alternates: { canonical: "/events" }
};

export default function EventsPage() {
  return (
    <div className="inner-page section-wrap events-page">
      <SummerRoundupCard priority />
    </div>
  );
}
