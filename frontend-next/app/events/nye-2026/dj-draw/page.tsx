import type { Metadata } from "next";
import DjDraw from "./DjDraw";
import "./dj-draw.css";

export const metadata: Metadata = {
  title: "NYE DJ Draw · UPFORIT × CRE8DNB",
  description: "Put your name in the hat for a 15-minute DJ set at UPFORIT NYE, in collaboration with CRE8DNB, Blackley’s label.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/events/nye-2026/dj-draw" }
};

export default function DjDrawPage() { return <DjDraw />; }
