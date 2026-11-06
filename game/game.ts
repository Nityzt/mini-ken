import { createAudio } from "./core/audio.ts";
import { createFlow, FADE_TICKS, startFade, stepFlow } from "./core/flow.ts";
import { createInput } from "./core/input.ts";
import { createLoop } from "./core/loop.ts";
import { createPauseMenu, menuItems, stepPauseMenu } from "./core/pause-menu.ts";
import type { Game, Scene, SceneName } from "./core/scene.ts";
import { drawTextCentered, measureText } from "./art/font.ts";
import { PALETTE, UI } from "./art/palette.ts";
import { onGui, setView, viewH, viewW, type CanvasFit } from "./core/scale.ts";
import type { CharacterId } from "./characters.ts";
import { createInsigniaEditor, stepInsigniaEditor, type InsigniaEditor } from "./insignia.ts";
import { canUseTicketIn } from "./grading.ts";
import { createReveal, inventoryOf, isWearable, itemsGained, stepReveal, type ItemId, type Reveal } from "./items.ts";
import { CHALLENGES, isClaimed, moneyText, settleChallenges } from "./money.ts";
import { wear, type ShopItemId } from "./shop.ts";
import { newlyOpened } from "./progress.ts";
import { levelOf } from "./ranks.ts";
import { createRunState, playerKiMax, type RunState } from "./run-state.ts";
import { clearSave, readSave, resumeScene, writeSave, type SaveStore } from "./save.ts";
import type { NodeId } from "./world/map.ts";
import { createArtSheet } from "./scenes/art-sheet.ts";
import { createCharacterScene } from "./scenes/character-select.ts";
import { createOnlineHub } from "./net/hub.ts";
import { isOpen } from "./progress.ts";
import { HP_MAX, regen, REGEN_TICKS } from "./health.ts";
import { createOnlineBracketScene } from "./scenes/online-bracket.ts";
import { createOnlineDuelScene } from "./scenes/online-duel.ts";
import { createOnlineScene } from "./scenes/online.ts";
import { createClubScene } from "./scenes/club.ts";
import { drawInsigniaCard } from "./scenes/insignia-card.ts";
import { drawItemCard } from "./scenes/item-card.ts";
import { createBrawlScene } from "./scenes/brawl.ts";
import { createDuelScene } from "./scenes/duel.ts";
import { createLineScene } from "./scenes/line.ts";
import { createMapScene } from "./scenes/map.ts";
import { drawPauseMenu } from "./scenes/pause.ts";
import { createRivalDojoScene } from "./scenes/rival-dojo.ts";
import { createTournamentScene } from "./scenes/tournament.ts";
import { createTitleScene } from "./scenes/title.ts";
import { createTrainingScene } from "./scenes/training.ts";
import { createGradingHallScene } from "./scenes/grading-hall.ts";
import { CHALLENGE_DONE, TICKET_NOT_NOW, REST_NOTICE } from "./scenes/content.ts";
import { createTravelScene } from "./scenes/travel.ts";

export type GameOverlay = "win" | null;

const IS_DEV = process.env.NODE_ENV !== "production";
const FADE_STEPS = 4;
const NOTICE_TICKS = 170;

function localStore(): SaveStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const HEALING_SCENES: SceneName[] = ["club", "rival-dojo", "map", "travel", "grading-hall"];

export function createGame(
  screen: HTMLCanvasElement,
  options: { onOverlay(overlay: GameOverlay): void },
): { start(): void; dispose(): void; resize(fit: CanvasFit): void } {
  const ctx = screen.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  let started = false;
  let healTicks = 0;
  /** Scenes draw in game pixels, and each one is this many real ones. */
  let worldPixel = 1;
  // Changing a canvas's size wipes it and forgets its settings.
  const resize = (fit: CanvasFit) => {
    setView(fit.viewW, fit.viewH, fit);
    worldPixel = fit.world;
    screen.width = fit.canvasW;
    screen.height = fit.canvasH;
    ctx.imageSmoothingEnabled = false;
  };

  const scenes: Partial<Record<SceneName, Scene>> = {
    title: createTitleScene(),
    character: createCharacterScene(),
    club: createClubScene(),
    training: createTrainingScene(),
    line: createLineScene(),
    map: createMapScene(),
    travel: createTravelScene(),
    brawl: createBrawlScene(),
    "rival-dojo": createRivalDojoScene(),
    duel: createDuelScene(),
    tournament: createTournamentScene(),
    "grading-hall": createGradingHallScene(),
    online: createOnlineScene(),
    "online-bracket": createOnlineBracketScene(),
    "online-duel": createOnlineDuelScene(),
  };
  let sceneName: SceneName = "title";
  const run = createRunState();
  // Development jumps start from made-up state, so they never touch the real save.
  let store = localStore();
  let versusFromUrl: Game["versus"] = null;

  if (IS_DEV) {
    const params = new URLSearchParams(location.search);
    if (params.has("art") || params.has("scene")) store = null;
    if (params.has("art")) {
      scenes.art = createArtSheet();
      sceneName = "art";
    }
    const jump = params.get("scene") as SceneName | null;
    const node = params.get("node") as NodeId | null;
    if (node) run.node = node;
    else if (jump === "duel" || jump === "rival-dojo") run.node = "radish";
    if (jump && scenes[jump]) sceneName = jump;
    // Jumping past the club still needs a dressed player to look right.
    if (jump && jump !== "club" && jump !== "title") {
      run.metSenpai = true;
      run.gi = true;
      run.gear = jump === "training" ? { ...run.gear, shinai: true } : { tare: true, do: true, men: true, kote: true, shinai: true };
      run.trained = jump !== "training";
      run.senseiRounds = jump === "training" ? 0 : 3;
      run.seme = jump !== "training" && !params.has("noseme");
      // Everything's open, unless the link asks to see the locks.
      if (run.trained && !params.has("locked")) {
        run.linePasses = 3;
        run.beaten = ["aki", "raccoon", "goose", "heron", "otter"];
        run.bonusKi = 150;
        run.dan = 3;
        run.waza = true;
      }
      run.dan = Number(params.get("dan") ?? run.dan);
      run.ticket = Number(params.get("ticket") ?? run.ticket);
      run.money = Number(params.get("money") ?? run.money);
      run.linePasses = Number(params.get("passes") ?? run.linePasses);
      run.bonusKi = Number(params.get("ki") ?? run.bonusKi);
      run.hp = Number(params.get("hp") ?? run.hp);
      versusFromUrl = params.get("versus") as Game["versus"];
    }
  }
  const scene = () => scenes[sceneName] ?? scenes.title!;

  let flow = createFlow();
  let muted = false;
  let menu = createPauseMenu();
  let menuOpen = false;
  // What's been saved, and what's been announced, so that only real changes do anything.
  let lastRun: RunState = run;
  let notices: string[] = [];
  let noticeTicks = 0;
  // Things earned wait here for their moment, and any scene change waits for them.
  let waitingItems: ItemId[] = [];
  let card: { kind: "item"; reveal: Reveal } | { kind: "insignia"; editor: InsigniaEditor } | null = null;
  let afterCards: (() => void) | null = null;

  const switchScene = (next: SceneName) => {
    scene().leave?.(game);
    game.fromFight = sceneName === "duel";
    if (game.after.length) {
      game.message = [...(game.message ?? []), ...game.after];
      game.after = [];
    }
    sceneName = next;
    game.debug.talking = false;
    game.input.clear();
    scene().enter?.(game);
  };

  const game: Game = {
    input: createInput(window),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    run,
    audio: createAudio(),
    debug: {},
    message: null,
    after: [],
    autoTo: null,
    fromFight: false,
    wokeUp: false,
    session: null,
    versus: versusFromUrl,
    tournament: null,
    ride: null,
    grading: null,
    helping: false,
    bet: 0,
    // Whoever hosts this later sets the address, and swaps in their own sign-in where guests are made.
    online: createOnlineHub({ store, readRun: () => readSave(store) ?? game.run, serverUrl: process.env.NEXT_PUBLIC_TINY_KENDO_SERVER }),
    go(next) {
      noticeChanges();
      // If there's something to say when you get there, it gets said first, and the cards wait their turn.
      if (card || (waitingItems.length && !game.message)) {
        afterCards = () => goNow(next);
        return;
      }
      goNow(next);
    },
    showCards(then) {
      noticeChanges();
      if (!card && !waitingItems.length) {
        then();
        return;
      }
      afterCards = then;
      if (!card) showNextCard();
    },
    hasSave: () => readSave(store) !== null,
    continueGame() {
      const saved = readSave(store);
      if (!saved) return;
      startFresh(saved);
      game.go(resumeScene(saved));
    },
    newGame(character: CharacterId) {
      clearSave(store);
      startFresh({ ...createRunState(), character });
      game.go("club");
    },
    overlay: options.onOverlay,
  };

  const goNow = (next: SceneName) => {
    if (game.reducedMotion) {
      switchScene(next);
      return;
    }
    flow = startFade(flow, next);
  };

  const startFresh = (next: RunState) => {
    game.autoTo = null;
    game.after = [];
    waitingItems = [];
    card = null;
    afterCards = null;
    game.run = next;
    lastRun = next;
    notices = [];
    noticeTicks = 0;
    game.message = null;
    game.session = null;
    game.versus = null;
    game.tournament = null;
    game.ride = null;
    game.grading = null;
    game.helping = false;
    game.bet = 0;
  };

  /** Saves any change, and announces what it earned. */
  const noticeChanges = () => {
    game.run = settleChallenges(game.run);
    if (game.run === lastRun) return;
    const earned = game.run.money - lastRun.money;
    if (earned > 0) notices.push(`+${moneyText(earned)}`);
    const gained = playerKiMax(game.run) - playerKiMax(lastRun);
    if (gained > 0) notices.push(`Ki +${gained}`);
    // Coming round after a knockout has its own words, and there's nothing restful about it.
    if (game.run.hp === HP_MAX && !game.wokeUp && game.run.hp - lastRun.hp > 1) notices.push(REST_NOTICE);
    if (levelOf(game.run.xp) > levelOf(lastRun.xp)) notices.push(`Level ${levelOf(game.run.xp)}`);
    for (const challenge of CHALLENGES) if (isClaimed(game.run, challenge.id) && !isClaimed(lastRun, challenge.id)) notices.push(`${CHALLENGE_DONE} ${challenge.label}`);
    for (const unlock of newlyOpened(lastRun, game.run)) notices.push(`Now open: ${unlock.label}`);
    waitingItems.push(...itemsGained(lastRun, game.run));
    writeSave(store, game.run);
    lastRun = game.run;
  };

  const pauseItems = () => {
    const away = sceneName === "title" || sceneName === "art" || !!scene().outsideStory?.(game);
    const forfeit = flow.fadingTo ? null : scene().forfeitLabel?.(game) ?? null;
    return menuItems({ forfeit, inGame: !away, hasTare: game.run.gear.tare, multiplayer: isOpen(game.run, "online") && canUseTicketIn(sceneName) });
  };

  const showNextCard = () => {
    const item = waitingItems.shift();
    if (item) {
      card = { kind: "item", reveal: createReveal(item) };
      game.audio.play("secret");
      return;
    }
    card = null;
    const then = afterCards;
    afterCards = null;
    then?.();
  };

  const runCard = () => {
    const { input } = game;
    if (card?.kind === "item") {
      const step = stepReveal(card.reveal, input.wasPressed("confirm"), input.wasPressed("cancel"));
      if (!step.done) card = { kind: "item", reveal: step.reveal };
      else if (step.use) {
        // Straight onto the train, instead of wherever you were headed.
        game.message = null;
        game.ride = "hall";
        afterCards = () => goNow("travel");
        showNextCard();
      }
      // A new tare comes with a chance to make it yours.
      else if (card.reveal.item === "tare") card = { kind: "insignia", editor: createInsigniaEditor(game.run.insignia) };
      else showNextCard();
    } else if (card?.kind === "insignia") {
      const step = stepInsigniaEditor(card.editor, {
        up: input.wasPressed("up"),
        down: input.wasPressed("down"),
        left: input.wasPressed("left"),
        right: input.wasPressed("right"),
        confirm: input.wasPressed("confirm"),
        cancel: input.wasPressed("cancel"),
      });
      if (!step.done) card = { kind: "insignia", editor: step.editor };
      else {
        if (step.done === "keep") game.run = { ...game.run, insignia: step.editor.insignia };
        showNextCard();
      }
    }
    game.debug.card = card;
  };

  const runMenu = () => {
    const { input } = game;
    const items = pauseItems();
    const step = stepPauseMenu(menu, items, {
      up: input.wasPressed("up"),
      down: input.wasPressed("down"),
      confirm: input.wasPressed("confirm"),
      cancel: input.wasPressed("cancel"),
    }, inventoryOf(game.run), (item) => (item === "ticket" ? "use-ticket" : isWearable(item as ItemId) ? "wear" : null));
    menu = step.menu;
    if (step.action === "wear") {
      const item = inventoryOf(game.run)[menu.choice];
      game.run = wear(game.run, item.slice("shop:".length) as ShopItemId);
    }
    if (step.action === "resume") flow = { ...flow, paused: false };
    else if (step.action === "use-ticket") {
      flow = { ...flow, paused: false };
      if (canUseTicketIn(sceneName) && !flow.fadingTo && !scene().busy?.(game)) {
        game.ride = "hall";
        game.go("travel");
      } else notices.push(TICKET_NOT_NOW);
    }
    else if (step.action === "insignia") {
      flow = { ...flow, paused: false };
      card = { kind: "insignia", editor: createInsigniaEditor(game.run.insignia) };
    }
    else if (step.action === "multiplayer") {
      flow = { ...flow, paused: false };
      if (canUseTicketIn(sceneName) && !flow.fadingTo && !scene().busy?.(game)) {
        game.online.returnTo = "story";
        game.go("online");
      }
    }
    else if (step.action === "forfeit") {
      flow = { ...flow, paused: false };
      scene().forfeit?.(game);
    } else if (step.action === "restart") {
      clearSave(store);
      startFresh(createRunState());
      flow = createFlow();
      switchScene("title");
    }
  };

  const update = () => {
    if (game.input.wasPressed("mute")) muted = game.audio.toggleMute();
    const result = stepFlow(flow, game.input.wasPressed("pause"));
    flow = result.flow;
    if (flow.paused) {
      // Open on the tick it was paused, and start taking input on the next.
      if (!menuOpen) {
        menu = createPauseMenu();
        menuOpen = true;
      } else runMenu();
      noticeChanges();
      return;
    }
    menuOpen = false;
    if (card) {
      runCard();
      noticeChanges();
      return;
    }
    if (result.switchTo) switchScene(result.switchTo);
    if (result.runScene) scene().update(game);
    // Anywhere outside a fight, you slowly get your breath back.
    if (result.runScene && HEALING_SCENES.includes(sceneName) && ++healTicks >= REGEN_TICKS) {
      healTicks = 0;
      game.run = regen(game.run);
    }
    noticeChanges();
    // Items wait until any fade has finished and nobody's mid-sentence.
    if (!card && waitingItems.length && !flow.fadingTo && flow.fadeTicks === 0 && (afterCards || !scene().busy?.(game))) showNextCard();
    if (notices.length && ++noticeTicks >= NOTICE_TICKS) {
      notices.shift();
      noticeTicks = 0;
    }
  };

  const render = () => {
    ctx.setTransform(worldPixel, 0, 0, worldPixel, 0, 0);
    scene().render(ctx, game);
    if (flow.fadeTicks > 0) {
      // Fades move in a few visible steps, to suit the pixels.
      const progress = flow.fadingTo ? 1 - flow.fadeTicks / FADE_TICKS : flow.fadeTicks / FADE_TICKS;
      ctx.globalAlpha = Math.ceil(progress * FADE_STEPS) / FADE_STEPS;
      ctx.fillStyle = PALETTE.K;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }
    onGui(ctx, () => {
      if (muted) {
        ctx.fillStyle = UI.panel;
        ctx.fillRect(viewW - 30, 21, 28, 11);
        drawTextCentered(ctx, "Mute", viewW - 16, 22, UI.text);
      }
      if (notices.length) {
        const width = measureText(notices[0]);
        ctx.fillStyle = UI.panel;
        ctx.fillRect((viewW - width) / 2 - 4, 21, width + 8, 11);
        drawTextCentered(ctx, notices[0], viewW / 2, 22, UI.accent);
      }
      if (card?.kind === "item") drawItemCard(ctx, card.reveal, game.run, game.reducedMotion);
      if (card?.kind === "insignia") drawInsigniaCard(ctx, card.editor, game.run);
      if (flow.paused) drawPauseMenu(ctx, menu, pauseItems(), game.run);
    });
  };

  const loop = createLoop(
    () => {
      update();
      game.input.endTick();
    },
    render,
  );

  // Losing focus stops the clock, so nobody loses a duel while looking away.
  const pauseIfAway = () => {
    if (document.hidden || !document.hasFocus()) {
      flow = { ...flow, paused: true };
      game.input.clear();
    }
  };
  const unlockAudio = () => game.audio.unlock();
  // It has to happen right here in the key press, or the browser refuses it.
  const toggleFullscreen = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "f" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  window.addEventListener("blur", pauseIfAway);
  document.addEventListener("visibilitychange", pauseIfAway);
  window.addEventListener("keydown", unlockAudio);
  window.addEventListener("keydown", toggleFullscreen);

  if (IS_DEV) {
    (window as unknown as { __tinyKendo?: unknown }).__tinyKendo = {
      get scene() {
        return sceneName;
      },
      get run() {
        return game.run;
      },
      get paused() {
        return flow.paused;
      },
      get muted() {
        return muted;
      },
      get duel() {
        return game.debug.duel;
      },
      get walker() {
        return game.debug.walker;
      },
      get club() {
        return game.debug.club;
      },
      get lesson() {
        return game.debug.lesson;
      },
      get talking() {
        return game.debug.talking;
      },
      get map() {
        return game.debug.map;
      },
      get brawl() {
        return game.debug.brawl;
      },
      get trip() {
        return game.debug.trip;
      },
      get line() {
        return game.debug.line;
      },
      get versus() {
        return game.versus;
      },
      get online() {
        return { hub: game.online, lobby: game.debug.online, bracket: game.debug.onlineBracket, status: game.debug.onlineStatus };
      },
      get tournament() {
        return game.tournament;
      },
      get menu() {
        return flow.paused ? menu : null;
      },
      get notices() {
        return notices;
      },
      get card() {
        return card;
      },
      get character() {
        return game.debug.character;
      },
    };
  }

  return {
    start() {
      scene().enter?.(game);
      started = true;
      loop.start();
    },
    dispose() {
      loop.stop();
      game.input.dispose();
      window.removeEventListener("blur", pauseIfAway);
      document.removeEventListener("visibilitychange", pauseIfAway);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("keydown", toggleFullscreen);
    },
    resize(fit) {
      resize(fit);
      // Resizing wipes the picture, so put it straight back. Before the start, there's no scene ready to draw.
      if (started) render();
    },
  };
}
