import StudioApp from "@/components/StudioApp";
import { getCsrfToken } from "@/lib/security";

export const dynamic = "force-dynamic";

export default function VisualsStudioPage() {
  return <StudioApp csrfToken={getCsrfToken()} />;
}
