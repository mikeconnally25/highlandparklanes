"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      ("standalone" in window.navigator &&
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

    setIsIOS(ios);
    setStandalone(isStandalone);

    if (isStandalone) return;

    const stored = sessionStorage.getItem("hpl-install-dismissed");
    if (stored) setDismissed(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed) return null;
  if (!deferred && !isIOS) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("hpl-install-dismissed", "1");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg items-start gap-3 border border-amber/40 bg-lane-deep/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex-1 text-sm text-cream">
          <p className="font-semibold">Install Highland Park Lanes</p>
          {isIOS && !deferred ? (
            <p className="mt-1 text-muted">
              Tap Share, then <span className="text-amber-soft">Add to Home Screen</span>{" "}
              for one-tap coupons.
            </p>
          ) : (
            <p className="mt-1 text-muted">
              Add to your phone home screen for quick access to your weekly QR.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {deferred && (
            <button
              type="button"
              onClick={install}
              className="bg-amber px-3 py-1.5 text-sm font-semibold text-lane-deep"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-muted hover:text-cream"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
