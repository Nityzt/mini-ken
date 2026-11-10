import { drawDuelBackdrop } from "../art/backdrops.ts";
import { drawText, drawTextCentered, measureText, wrapText, LINE_HEIGHT } from "../art/font.ts";
import { UI } from "../art/palette.ts";
import { onGui, onStage, STAGE_W, stageX, viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { rankForRecord } from "../net/appearance.ts";
import { resumeScene } from "../save.ts";
import { nextInviteStep } from "../net/invite.ts";
import type { Search } from "../net/service.ts";
import { createMenu } from "./choice.ts";
import { primerNeeds } from "./teaching.ts";
import { ONLINE_CONNECTING, ONLINE_CREATE_LOBBY, ONLINE_HISTORY, ONLINE_JOIN_LOBBY, ONLINE_PRACTICE_CUP, ONLINE_SIGN_IN, ONLINE_SIGN_IN_NOTE, ONLINE_SIGN_OUT, ONLINE_SIGNED_IN, ONLINE_UNREACHABLE } from "./online-lines.ts";
import { ONLINE_BACK, ONLINE_CANCEL, ONLINE_DUEL, ONLINE_GATE, ONLINE_INVITE_GATE, ONLINE_PRACTICE, ONLINE_PRIMER_NO, ONLINE_PRIMER_YES, ONLINE_RECORD, onlinePrimerNote, ONLINE_SEARCHING, ONLINE_SKIP_TUTORIAL, ONLINE_TITLE, ONLINE_TOURNAMENT, ONLINE_TUTORIAL, ONLINE_TUTORIAL_AGAIN } from "./content.ts";

const TITLE_Y = 26;

/** Choosing a kind of match, or being sent off to earn the right to. */
export function createOnlineScene(): Scene {
  const menu = createMenu();
  let search: Search | null = null;
  let failure: string | null = null;
  /** The invite's sign-in form has already been offered. */
  let asked = false;
  /** Whether you were signed in when the menu was last drawn up. */
  let menuSignedIn: boolean | null = null;
  /** What's being offered before going on (the pre-match tutorial, or the invite's tutorial-or-skip), and where declining leads. */
  let primerNote: string | null = null;
  let declinePrimer: (() => void) | null = null;

  const back = (game: Game) => {
    const home = game.online.returnTo === "story" ? resumeScene(game.run) : "title";
    game.online.returnTo = "title";
    game.go(home);
  };
  const tutorial = (game: Game) => {
    game.session = { kind: "quick" };
    game.go("training");
  };
  /** Before a real match, anyone who's missed something gets told, once, and can say no. */
  const offerPrimer = (game: Game, goOn: () => void) => {
    const needs = primerNeeds(game.run, !!game.online.profile().primer);
    if (!needs.length) return goOn();
    primerNote = onlinePrimerNote(needs);
    declinePrimer = () => {
      primerNote = null;
      game.online.primerAsked();
      goOn();
    };
    menu.open([{ id: "yes", label: ONLINE_PRIMER_YES }, { id: "no", label: ONLINE_PRIMER_NO }], (id) => {
      if (id === "no") return declinePrimer!();
      primerNote = null;
      game.online.primerAsked();
      game.session = { kind: "quick", only: needs.map((n) => (n === "opening" ? "quick-opening" : "quick-seme")) };
      game.go("training");
    });
  };
  /** Someone with an invite who hasn't got in yet chooses: the tutorial, or skip it. Backing out drops the invite. */
  const offerTutorial = (game: Game) => {
    primerNote = ONLINE_INVITE_GATE;
    declinePrimer = () => {
      primerNote = null;
      game.online.invite = null;
      openMenu(game);
    };
    menu.open([{ id: "tutorial", label: ONLINE_TUTORIAL }, { id: "skip", label: ONLINE_SKIP_TUTORIAL }], (id) => {
      primerNote = null;
      // Skipping opens multiplayer, and the invite carries on to its lobby next tick.
      if (id === "skip") game.online.finishTutorial();
      else tutorial(game);
    });
  };
  const toLobby = (game: Game, intent: Game["online"]["lobbyIntent"]) => {
    game.online.lobbyIntent = intent;
    game.go("online-lobby");
  };
  /** What's on offer depends on whether there's a server, whether you're signed in, and whether you've earned it. */
  const menuFor = (game: Game) => {
    const { access, service, account } = game.online;
    const open = access().open;
    const tutorialItem = { id: "tutorial", label: open ? ONLINE_TUTORIAL_AGAIN : ONLINE_TUTORIAL };
    // Until multiplayer's open, the tutorial can be skipped instead.
    const gate = [tutorialItem, { id: "skip", label: ONLINE_SKIP_TUTORIAL }];
    const backItem = { id: "back", label: ONLINE_BACK };
    const customize = { id: "customize", label: "Customize appearance" };
    if (!service.live) return open ? [{ id: "duel", label: ONLINE_DUEL }, { id: "tournament", label: ONLINE_TOURNAMENT }, tutorialItem, customize, backItem] : [...gate, customize, backItem];
    const signedIn = !!account?.current();
    const signItem = signedIn ? { id: "sign-out", label: ONLINE_SIGN_OUT } : { id: "sign-in", label: ONLINE_SIGN_IN };
    if (!open) return [...gate, customize, signItem, backItem];
    const cup = { id: "tournament", label: ONLINE_PRACTICE_CUP };
    if (!signedIn) return [signItem, cup, tutorialItem, customize, backItem];
    return [{ id: "create", label: ONLINE_CREATE_LOBBY }, { id: "join", label: ONLINE_JOIN_LOBBY }, { id: "history", label: ONLINE_HISTORY }, cup, tutorialItem, customize, signItem, backItem];
  };
  const openMenu = (game: Game) => {
    const pick = (id: string) => {
      failure = null;
      if (id === "duel") offerPrimer(game, () => (search = game.online.service.findDuel()));
      else if (id === "tournament") game.go("online-bracket");
      else if (id === "tutorial") tutorial(game);
      else if (id === "skip") {
        game.online.finishTutorial();
        openMenu(game);
      }
      else if (id === "customize") game.go("online-appearance");
      else if (id === "create") offerPrimer(game, () => toLobby(game, { kind: "create" }));
      else if (id === "join") offerPrimer(game, () => toLobby(game, { kind: "type-code" }));
      else if (id === "history") game.go("online-history");
      else if (id === "sign-in") game.online.openAccountForm();
      else if (id === "sign-out") game.online.signOut();
      else back(game);
    };
    menu.open(menuFor(game), pick);
  };
  /** Someone's arrived with an invite: one step at a time, and the code waits for them. */
  const followInvite = (game: Game): boolean => {
    const { invite, account, access } = game.online;
    if (!invite || !account) return false;
    const status = account.status();
    if (status === "unknown" || status === "unreachable") return true;
    // Your rank comes from your story, which may still be on its way from the account.
    if (status === "signed-in" && !game.online.storySettled()) return true;
    const step = nextInviteStep({ signedIn: status === "signed-in", open: access().open });
    if (step === "sign-in") {
      if (!asked) {
        asked = true;
        game.online.openAccountForm();
      } else {
        // They closed the form, so they don't want to go any further.
        game.online.invite = null;
        return false;
      }
    } else if (step === "tutorial") {
      if (game.online.inviteTutorialTried) {
        game.online.invite = null;
        return false;
      }
      game.online.inviteTutorialTried = true;
      offerTutorial(game);
    } else {
      // The invite stays until they're really on their way, so taking the tutorial first doesn't lose it.
      offerPrimer(game, () => {
        game.online.invite = null;
        toLobby(game, { kind: "join", code: invite });
      });
    }
    return true;
  };
  const notice = (game: Game): string => {
    if (failure) return failure;
    if (primerNote) return primerNote;
    const { service, account, access } = game.online;
    if (!access().open) return ONLINE_GATE;
    if (!service.live) return ONLINE_PRACTICE;
    const status = account?.status();
    if (status === "unknown") return ONLINE_CONNECTING;
    if (status === "unreachable") return ONLINE_UNREACHABLE;
    return status === "signed-in" ? ONLINE_SIGNED_IN : ONLINE_SIGN_IN_NOTE;
  };

  return {
    outsideStory: () => true,
    enter(game) {
      search = null;
      failure = null;
      game.online.match = null;
      game.online.tournament = null;
      game.online.lastWon = null;
      asked = false;
      menuSignedIn = !!game.online.account?.current();
      openMenu(game);
    },
    update(game) {
      if (game.online.account?.status() === "unknown") return;
      if (game.online.account?.current() && !game.online.storySettled()) return;
      if (!game.online.profile().appearance) { game.go("online-appearance"); return; }
      game.debug.online = { searching: !!search, open: game.online.access().open, failure, signedIn: !!game.online.account?.current() };
      // The form's a real one, over the game. Nothing else happens until it's closed.
      if (game.online.accountUi()) return;
      // The offer has the screen until it's answered, and backing out of it counts as no.
      if (primerNote) {
        if (menu.active) menu.update(game.input);
        else declinePrimer!();
        return;
      }
      if (followInvite(game)) return;
      const signedIn = !!game.online.account?.current();
      if (signedIn !== menuSignedIn) {
        menuSignedIn = signedIn;
        openMenu(game);
      }
      if (search) {
        if (game.input.wasPressed("cancel")) {
          search.cancel();
          search = null;
          openMenu(game);
          return;
        }
        const state = search.poll();
        if (state.kind === "found") {
          game.online.match = state.match;
          search = null;
          game.go("online-duel");
        } else if (state.kind === "failed") {
          failure = state.reason;
          search = null;
          openMenu(game);
        }
        return;
      }
      if (menu.active) menu.update(game.input);
      // Cancelling a menu with nowhere else to go just puts it back.
      else openMenu(game);
    },
    render(ctx, game) {
      drawDuelBackdrop(ctx, "arena");
      const { open } = game.online.access();
      const me = game.online.identity();
      const record = game.online.record();
      onGui(ctx, () => {
        const lines = wrapText(notice(game), STAGE_W - 16);
        const noticeTop = TITLE_Y + (open ? 25 : 15);
        onStage(ctx, () => {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(-stageX(), TITLE_Y - 8, viewW, noticeTop + lines.length * LINE_HEIGHT - TITLE_Y + 12);
          drawText(ctx, ONLINE_TITLE, (STAGE_W - measureText(ONLINE_TITLE) * 2) / 2, TITLE_Y - 4, UI.text, 2);
          if (open) drawTextCentered(ctx, `${me.name}  ${rankForRecord(game.online.rankRecord())}  ${ONLINE_RECORD(record.wins, record.losses)}`, STAGE_W / 2, TITLE_Y + 15, UI.accent);
          lines.forEach((line, i) => drawTextCentered(ctx, line, STAGE_W / 2, noticeTop + i * LINE_HEIGHT, failure ? UI.bad : UI.dim));
        });
        if (search) {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, viewH - 22, viewW, 22);
          drawTextCentered(ctx, ONLINE_SEARCHING, viewW / 2, viewH - 21, UI.accent);
          drawTextCentered(ctx, ONLINE_CANCEL, viewW / 2, viewH - 11, UI.dim);
          return;
        }
        menu.render(ctx);
      });
    },
  };
}
