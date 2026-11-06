import { AccessibilityQuickMenu } from "./accessibility-quick-menu";
import { ReadingGuide } from "./reading-guide";
import { RouteAnnouncer } from "./route-announcer";
import { useAccessibilityPrefs } from "./use-accessibility-prefs";
import { VLibrasWidget } from "./vlibras-widget";

// Recursos de acessibilidade que valem em todas as telas. Fica no layout raiz.
export function AccessibilityRuntime({ signedInArea }: { signedInArea: boolean }) {
  const { prefs } = useAccessibilityPrefs();

  return (
    <>
      <RouteAnnouncer />
      <AccessibilityQuickMenu showFullPageLink={signedInArea} />
      {prefs.readingGuide ? <ReadingGuide /> : null}
      {prefs.libras ? <VLibrasWidget /> : null}
    </>
  );
}
