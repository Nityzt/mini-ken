import { instructionText, keyLabel } from "../core/key-labels.ts";
import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawFighter } from "../art/duel-sprites.ts";
import { drawText, drawTextCentered, measureText } from "../art/font.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_W, stageX, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { TITLE_CONTINUE, TITLE_ERASE, TITLE_MULTIPLAYER, TITLE_NEW, TITLE_START } from "./content.ts";
import { ONLINE_SIGN_IN, TITLE_CONNECTING, TITLE_CONTINUE_GUEST, TITLE_GUEST_NOTE, TITLE_NEW_GUEST, TITLE_SIGN_OUT, TITLE_SIGNED_IN, TITLE_START_GUEST } from "./online-lines.ts";

const TITLE = "TINY KENDO";
const TITLE_SIZE = 4;
const BAND_TOP = 16;
const BAND_HEIGHT = 42;
const BOX_TOP = 64;
const BOX_LEFT = 38;
const HELP_LINES = ["Arrows or WASD move   E talks", "Esc or P menu   F fullscreen"];
/** How long to wait to find out who someone is, before treating them as a guest. */
const CHECK_TICKS = 180;

type TitleOption = { id: "sign-in" | "sign-out" | "start" | "continue" | "new" | "multiplayer"; label: string };

export function createTitleScene(): Scene {
  let tick = 0;
  let hasSave = false;
  let choice = 0;
  let confirming = false;
  let checkingTicks = 0;
  let shownState = "";
  const stateNow = (game: Game) => {
    const state = game.online.accountState();
    return state === "checking" && checkingTicks >= CHECK_TICKS ? "guest" : state;
  };
  /** Multiplayer's always offered, so anyone can go straight there without starting a story. Signing in comes first, since that's what keeps a story. */
  const optionsNow = (state: ReturnType<typeof stateNow>): TitleOption[] => {
    if (state === "checking") return [];
    const guest = state === "guest";
    const story: TitleOption[] = hasSave
      ? [{ id: "continue", label: guest ? TITLE_CONTINUE_GUEST : TITLE_CONTINUE }, { id: "new", label: guest ? TITLE_NEW_GUEST : TITLE_NEW }]
      : [{ id: "start", label: guest ? TITLE_START_GUEST : TITLE_START }];
    const multiplayer: TitleOption = { id: "multiplayer", label: TITLE_MULTIPLAYER };
    if (guest) return [{ id: "sign-in", label: ONLINE_SIGN_IN }, ...story, multiplayer];
    return state === "signed-in" ? [...story, multiplayer, { id: "sign-out", label: TITLE_SIGN_OUT }] : [...story, multiplayer];
  };

  return {
    enter(game) {
      hasSave = game.hasSave();
      choice = 0;
      confirming = false;
      checkingTicks = 0;
      shownState = stateNow(game);
    },
    update(game) {
      tick++;
      const { input } = game;
      // A story can arrive from an account, or go, while this is on screen. Start must never erase one nobody's been warned about.
      const saved = game.hasSave();
      if (saved !== hasSave) {
        hasSave = saved;
        choice = 0;
        confirming = false;
      }
      if (game.online.accountState() === "checking") checkingTicks++;
      const state = stateNow(game);
      // Signing in or out changes what's on the list, so the old choice would mean something else.
      if (state !== shownState) {
        shownState = state;
        choice = 0;
        confirming = false;
      }
      // Starting over erases the save, so it asks first.
      if (confirming) {
        if (input.wasPressed("cancel")) confirming = false;
        else if (input.wasPressed("confirm")) game.go("character");
        return;
      }
      const options = optionsNow(state);
      if (!options.length) return;
      if (input.wasPressed("up")) choice = (choice + options.length - 1) % options.length;
      if (input.wasPressed("down")) choice = (choice + 1) % options.length;
      if (!input.wasPressed("confirm")) return;
      // A story that's only in this browser might not last, and people should know before they put time into one.
      const asGuest = (go: () => void) => (state === "guest" ? game.online.warnGuest(go) : go());
      const picked = options[choice].id;
      if (picked === "multiplayer") {
        game.online.returnTo = "title";
        game.go("online");
      } else if (picked === "sign-in") game.online.openAccountForm();
      else if (picked === "sign-out") game.online.signOut();
      else if (picked === "start") asGuest(() => game.go("character"));
      else if (picked === "continue") asGuest(() => game.continueGame());
      else
        asGuest(() => {
          confirming = true;
        });
    },
    render(ctx, game) {
      const state = stateNow(game);
      drawDuelBackdrop(ctx, "pinecone");
      onStage(ctx, () => {
        drawFighter(ctx, 58, 128, Math.floor(tick / 40) % 2 === 0 ? "guard" : "tellHandsUp", "player", 0);
        drawFighter(ctx, STAGE_W - 58, 128, "guard", "rival", 0);
      });

      onGui(ctx, () => {
        onStage(ctx, () => {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(-stageX(), BAND_TOP, viewW, BAND_HEIGHT);
          const x = (STAGE_W - measureText(TITLE) * TITLE_SIZE) / 2;
          drawText(ctx, TITLE, x + 1, BAND_TOP + 8, PALETTE.r, TITLE_SIZE);
          drawText(ctx, TITLE, x, BAND_TOP + 7, UI.text, TITLE_SIZE);

          // Small enough to stand between the two fighters, not in front of them.
          const options = confirming ? [] : optionsNow(state).map((option) => option.label);
          const height = options.length * 10 + HELP_LINES.length * 9 + 14;
          ctx.fillStyle = UI.edge;
          ctx.fillRect(BOX_LEFT - 1, BOX_TOP - 1, STAGE_W - BOX_LEFT * 2 + 2, height + 2);
          ctx.fillStyle = UI.panel;
          ctx.fillRect(BOX_LEFT, BOX_TOP, STAGE_W - BOX_LEFT * 2, height);
          options.forEach((option, i) => {
            const y = BOX_TOP + 5 + i * 10;
            const selected = i === choice;
            drawTextCentered(ctx, option, STAGE_W / 2, y, selected ? UI.accent : UI.text);
            if (selected) drawText(ctx, ">", (STAGE_W - measureText(option)) / 2 - 10, y, UI.accent);
          });
          const helpLines = [
            `${keyLabel(game.input, "left", "a")} ${keyLabel(game.input, "right", "d")} move   ${keyLabel(game.input, "confirm", "e")} talks`,
            `${keyLabel(game.input, "pause", "escape")} menu   ${keyLabel(game.input, "fullscreen", "f")} fullscreen`,
          ];
          helpLines.forEach((line, i) => drawTextCentered(ctx, line, STAGE_W / 2, BOX_TOP + 9 + options.length * 10 + i * 9, UI.dim));
        });

        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 11, viewW, 11);
        const name = game.online.account?.current()?.username;
        const footer = confirming ? TITLE_ERASE : state === "checking" ? TITLE_CONNECTING : state === "guest" ? TITLE_GUEST_NOTE : name ? TITLE_SIGNED_IN(name) : `${keyLabel(game.input, "confirm", "e")} to choose`;
        drawTextCentered(ctx, instructionText(game.input, footer.replace("E or Space", keyLabel(game.input, "confirm", "e"))), viewW / 2, viewH - 10, confirming ? UI.accent : UI.text);
      });
    },
  };
}
