"use client";

import { useEffect, useRef, useState } from "react";
import { AccountOverlay } from "./AccountOverlay";
import { CopyEmailButton } from "./CopyEmailButton";
import { STAGE_H, STAGE_W, fitView, type CanvasFit } from "./core/scale";
import { createGame, type GameOverlay } from "./game";
import type { AccountUi } from "./net/hub";

const DISCORD_URL = "https://discord.gg/3a6xf8yFUe";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlay, setOverlay] = useState<GameOverlay>(null);
  const [accountUi, setAccountUi] = useState<AccountUi | null>(null);
  const [fit, setFit] = useState<CanvasFit>({ viewW: STAGE_W, viewH: STAGE_H, width: STAGE_W, height: STAGE_H, canvasW: STAGE_W, canvasH: STAGE_H, world: 1, gui: 1, guiW: STAGE_W, guiH: STAGE_H });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas, { onOverlay: setOverlay, onAccountUi: (ui) => setAccountUi(() => ui) });
    const resize = () => {
      const next = fitView(window.innerWidth, window.innerHeight, window.devicePixelRatio);
      setFit(next);
      game.resize(next);
    };
    resize();
    window.addEventListener("resize", resize);
    game.start();
    return () => {
      window.removeEventListener("resize", resize);
      game.dispose();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Tiny Kendo game. Arrow keys or WASD move. J, K and L strike. S blocks. E talks. X backs out. Escape or P opens the menu. F goes fullscreen."
        className="absolute left-0 top-0"
        style={{ width: fit.width, height: fit.height, display: "block", imageRendering: "pixelated" }}
      />
      {accountUi && <AccountOverlay ui={accountUi} />}
      {overlay === "win" && (
        <p className="fixed bottom-3 left-1/2 z-10 max-w-[90vw] -translate-x-1/2 rounded bg-[#1A1A1A] px-3 py-1 text-center text-[14px] text-white/80">
          Want to chat kendo? Say hi on{" "}
          <a className="underline hover:text-white" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            Discord
          </a>{" "}
          or by <CopyEmailButton className="cursor-pointer underline hover:text-white">email</CopyEmailButton>.
        </p>
      )}
    </>
  );
}
