"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

const GameCanvas = dynamic(() => import("./GameCanvas"), {
  ssr: false,
  loading: () => <p className="text-[20px] text-white/70">Loading...</p>,
});

const PHONE_QUERY = "(pointer: coarse) and (hover: none)";
type Device = "unknown" | "phone" | "keyboard";

function subscribe(onChange: () => void) {
  const query = matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getDevice = (): Device => (matchMedia(PHONE_QUERY).matches ? "phone" : "keyboard");
const getServerDevice = (): Device => "unknown";

export function GameEntry() {
  const device = useSyncExternalStore(subscribe, getDevice, getServerDevice);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: "#1A1A1A", touchAction: "none" }}
    >
      {device === "keyboard" && <GameCanvas />}
      {device === "phone" && (
        <div className="px-6 text-center text-white">
          <p className="text-[28px] font-bold">Tiny Kendo needs a keyboard.</p>
          <p className="mt-2 text-white/70">Come back on a computer!</p>
        </div>
      )}
    </div>
  );
}
