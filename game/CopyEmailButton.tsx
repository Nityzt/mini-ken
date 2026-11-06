"use client";

import { useState } from "react";

const EMAIL = "kendo.at.york@gmail.com";

export function CopyEmailButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // navigator.clipboard only exists in secure contexts (HTTPS or localhost).
    // Over plain http — e.g. visiting the dev server at a LAN IP on a phone —
    // it's undefined, so fall back to the legacy execCommand path.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(EMAIL);
      } else {
        const ta = document.createElement("textarea");
        ta.value = EMAIL;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: hand off to the mail client so the click still does
      // something useful even if copying isn't permitted.
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  return (
    <button type="button" onClick={handleCopy} className={className}>
      {copied ? "Email copied ✓" : children}
    </button>
  );
}
