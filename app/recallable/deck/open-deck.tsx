"use client";

import { useEffect, useState } from "react";

const deckID = /^\/recallable\/deck\/([0-9a-fA-F-]{36})\/?$/;

/** The two ways forward: open the deck in the app (when it's installed), or get the app. */
export function OpenDeck({ appStoreURL }: { appStoreURL: string }) {
  const [appURL, setAppURL] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(deckID);
    setAppURL(match ? `recallable://deck/${match[1].toLowerCase()}` : null);
  }, []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {appURL && (
        <a href={appURL} className="rounded-full bg-foreground px-5 py-3 text-center font-semibold text-background" data-testid="open-in-recallable">
          Open in Recallable
        </a>
      )}
      <a href={appStoreURL} className="rounded-full border px-5 py-3 text-center font-semibold" data-testid="get-recallable">
        Get Recallable on the App Store
      </a>
    </div>
  );
}
