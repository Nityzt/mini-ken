"use client";

import { useEffect, useRef, useState } from "react";
import { AccountOverlay } from "./AccountOverlay";
import { BindingsOverlay, type BindingsUi } from "./BindingsOverlay";
import { STAGE_H, STAGE_W, fitView, type CanvasFit } from "./core/scale";
import { createGame } from "./game";
import type { AccountUi } from "./net/hub";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bindingsUi, setBindingsUi] = useState<BindingsUi | null>(null);
  const [accountUi, setAccountUi] = useState<AccountUi | null>(null);
  const [fit, setFit] = useState<CanvasFit>({ viewW: STAGE_W, viewH: STAGE_H, width: STAGE_W, height: STAGE_H, canvasW: STAGE_W, canvasH: STAGE_H, world: 1, gui: 1, guiW: STAGE_W, guiH: STAGE_H });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas, { onAccountUi: (ui) => setAccountUi(() => ui), onBindingsUi: (ui) => setBindingsUi(() => ui) });
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
        aria-label="Tiny Kendo game. Keyboard controls can be customized in the pause menu."
        className="absolute left-0 top-0"
        style={{ width: fit.width, height: fit.height, display: "block", imageRendering: "pixelated" }}
      />
      {accountUi && <AccountOverlay ui={accountUi} />}
      {bindingsUi && <BindingsOverlay ui={bindingsUi} />}
    </>
  );
}
