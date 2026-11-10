import { createAudio } from "./core/audio.ts";
import { createDungeonScene } from './scenes/dungeon.ts';
import { discoverDungeon, enterDungeon } from './dungeon-story.ts';
import { stepSpot, type Spot } from "./core/return-spot.ts";
import { createFlow, FADE_TICKS, startFade, stepFlow } from "./core/flow.ts";
import { escapeLock, keyboardLock, pausesOnFullscreenExit } from "./core/fullscreen.ts";
import { createInput } from "./core/input.ts";
import type { BindingsUi } from "./BindingsOverlay.tsx";
import { createKeybindingSync } from "./net/keybinding-sync.ts";
import { createLoop } from "./core/loop.ts";
import { createPauseMenu, menuItems, stepPauseMenu } from "./core/pause-menu.ts";
import type { Game, Scene, SceneName } from "./core/scene.ts";
import { drawTextCentered, measureText } from "./art/font.ts";
import { PALETTE, UI } from "./art/palette.ts";
import { onGui, setView, viewH, viewW, type CanvasFit } from "./core/scale.ts";
import { characterById, cleanPlayerName, playerColors, playerName, type CharacterId } from "./characters.ts";
import { createNameEntry, stepNameEntry, type NameEntry } from "./name-entry.ts";
import { createInsigniaEditor, stepInsigniaEditor, type InsigniaEditor } from "./insignia.ts";
import { canUseTicketIn } from "./grading.ts";
import { createReveal, itemsGained, stepReveal, type ItemId, type Reveal } from "./items.ts";
import { stepInventoryScreen } from "./equipment-screen.ts";
import { CHALLENGES, isClaimed, moneyText, settleChallenges } from "./money.ts";
import { goalRow, LADDER, newlyOpened } from "./progress.ts";
import { levelOf } from "./ranks.ts";
import { createRunState, playerKiMax, type RunState } from "./run-state.ts";
import { clearSave, readSave, resumeScene, writeSave, type SaveStore } from "./save.ts";
import type { NodeId } from "./world/map.ts";
import { createArtSheet } from "./scenes/art-sheet.ts";
import { createCharacterScene } from "./scenes/character-select.ts";
import { createOnlineHub, type AccountUi } from "./net/hub.ts";
import { clearInvite, inviteFromUrl } from "./net/invite.ts";
import { HP_MAX, regen, REGEN_TICKS } from "./health.ts";
import { createOnlineBracketScene } from "./scenes/online-bracket.ts";
import { createOnlineDuelScene } from "./scenes/online-duel.ts";
import { createOnlineHistoryScene } from "./scenes/online-history.ts";
import { JOIN_ALERT_TITLE } from "./scenes/online-lines.ts";
import { createOnlineLobbyScene } from "./scenes/online-lobby.ts";
import { createOnlineScene } from "./scenes/online.ts";
import { createOnlineAppearanceScene } from "./scenes/online-appearance.ts";
import { createClubScene } from "./scenes/club.ts";
import { drawInsigniaCard } from "./scenes/insignia-card.ts";
import { drawNameCard } from "./scenes/name-card.ts";
import { drawItemCard } from "./scenes/item-card.ts";
import { createBrawlScene } from "./scenes/brawl.ts";
import { createDuelScene } from "./scenes/duel.ts";
import { createKirikaeshiScene } from "./scenes/kirikaeshi.ts";
import { createLineScene } from "./scenes/line.ts";
import { createMapScene } from "./scenes/map.ts";
import { drawPauseMenu } from "./scenes/pause.ts";
import { createRivalDojoScene } from "./scenes/rival-dojo.ts";
import { createTournamentScene } from "./scenes/tournament.ts";
import { createTitleScene } from "./scenes/title.ts";
import { createTrainingScene } from "./scenes/training.ts";
import { createGradingHallScene } from "./scenes/grading-hall.ts";
import { CHALLENGE_DONE, TICKET_NOT_NOW, REST_NOTICE, nameMenuLabel } from "./scenes/content.ts";
import { createTravelScene } from "./scenes/travel.ts";


const IS_DEV = process.env.NODE_ENV !== "production";
const FADE_STEPS = 4;
const NOTICE_TICKS = 170;

let invitedTo: string | null | undefined;
/** Read once per page, because the game can be started twice in development, and using it takes it out of the address. */
function pageInvite(): string | null {
  if (invitedTo === undefined) {
    invitedTo = inviteFromUrl(location.search);
    if (invitedTo) clearInvite(history, location);
  }
  return invitedTo;
}

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
  options: { onAccountUi?(ui: AccountUi | null): void; onBindingsUi?(ui: BindingsUi | null): void },
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

  const nameOf = () => playerName(game.run);
  const scenes: Partial<Record<SceneName, Scene>> = {
    title: createTitleScene(),
    character: createCharacterScene(),
    club: createClubScene(nameOf),
    training: createTrainingScene(nameOf),
    line: createLineScene(),
    kirikaeshi: createKirikaeshiScene(),
    map: createMapScene(nameOf),
    travel: createTravelScene(),
    brawl: createBrawlScene(),
    dungeon: createDungeonScene(nameOf),
    "rival-dojo": createRivalDojoScene(nameOf),
    duel: createDuelScene(),
    tournament: createTournamentScene(),
    "grading-hall": createGradingHallScene(nameOf),
    online: createOnlineScene(),
    "online-appearance": createOnlineAppearanceScene(),
    "online-bracket": createOnlineBracketScene(),
    "online-duel": createOnlineDuelScene(),
    "online-lobby": createOnlineLobbyScene(),
    "online-history": createOnlineHistoryScene(),
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
      if (jump === 'dungeon') {
        run.node = 'radish';
        run.beaten = [...run.beaten, 'raiko'];
        run.dungeon = enterDungeon(discoverDungeon(run)).dungeon;
      }
    }
  }
  const scene = () => scenes[sceneName] ?? scenes.title!;
  // Without a real save, as on development links, there's nothing to connect to an account.
  const serverUrl = store ? process.env.NEXT_PUBLIC_TINY_KENDO_SERVER : undefined;
  const invite = serverUrl ? pageInvite() : null;
  if (invite) sceneName = "online";

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
  let card: { kind: "item"; reveal: Reveal } | { kind: "insignia"; editor: InsigniaEditor } | { kind: "name"; entry: NameEntry } | null = null;
  let afterCards: (() => void) | null = null;
  /** Where you stepped out of a room for a drill or a fight, so coming back puts you there again. */
  let spot: Spot = null;

  const switchScene = (next: SceneName) => {
    scene().leave?.(game);
    const step = stepSpot(spot, sceneName, next, game.run.node);
    spot = step.spot;
    game.returning = step.returning;
    if (game.after.length) {
      game.message = [...(game.message ?? []), ...game.after];
      game.after = [];
    }
    sceneName = next;
    game.debug.talking = false;
    game.input.clear();
    scene().enter?.(game);
    game.online.save?.sceneChanged();
  };

  // Picking a character counts: a story arriving then has to ask, or starting a new one would erase it unwarned.
  const inStory = () => sceneName !== "title" && !scene().outsideStory?.(game);
  /** The story's been replaced or removed from outside: another device, or signing out. */
  const reloadRun = (next: RunState | null) => {
    const wasInStory = inStory();
    startFresh(next ?? createRunState());
    if (!next) game.online.returnTo = "title";
    if (wasInStory) {
      flow = createFlow();
      switchScene(next ? resumeScene(next) : "title");
    }
  };

  const pageTitle = document.title;
  let titleFlash = 0;
  const stopTitleFlash = () => {
    if (!titleFlash) return;
    window.clearInterval(titleFlash);
    titleFlash = 0;
    document.title = pageTitle;
  };
  /** Someone's arrived in your lobby, and you may well be off sending someone else the link. */
  const alertJoin = () => {
    game.audio.play("secret");
    if (titleFlash || (!document.hidden && document.hasFocus())) return;
    titleFlash = window.setInterval(() => {
      if (!document.hidden && document.hasFocus()) stopTitleFlash();
      else document.title = document.title === JOIN_ALERT_TITLE ? pageTitle : JOIN_ALERT_TITLE;
    }, 1000);
    document.title = JOIN_ALERT_TITLE;
  };

  const input = createInput(window);
  const keybindings = createKeybindingSync({ store, fetcher: (...args) => fetch(...args), onChange: (bindings) => input.setBindings(bindings) });
  input.setBindings(keybindings.current());
  let editingBindings = false;
  const game: Game = {
    input,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    run,
    audio: createAudio(),
    debug: {},
    message: null,
    after: [],
    autoTo: null,
    returning: false,
    wokeUp: false,
    session: null,
    versus: versusFromUrl,
    tournament: null,
    ride: null,
    grading: null,
    helping: false,
    bet: 0,
    online: createOnlineHub({ store, readRun: () => readSave(store) ?? game.run, serverUrl, invite, alert: alertJoin, inStory, reloadRun, onSignedIn: (id) => void keybindings.signedIn(id), onSignedOut: () => keybindings.signedOut() }),
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
    newGame(character: CharacterId, name = "") {
      clearSave(store);
      startFresh({ ...createRunState(), character, name });
      game.go("club");
    },
  };

  const goNow = (next: SceneName) => {
    if (game.reducedMotion) {
      switchScene(next);
      return;
    }
    flow = startFade(flow, next);
  };

  const startFresh = (next: RunState) => {
    spot = null;
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
    game.online.save?.changed();
    lastRun = game.run;
  };

  /** Only offered where it'll actually happen, rather than closing the menu and doing nothing. */
  const canLeaveStory = () => canUseTicketIn(sceneName) && !flow.fadingTo && !scene().busy?.(game);
  const pauseItems = () => {
    const away = sceneName === "title" || sceneName === "art" || !!scene().outsideStory?.(game);
    const forfeit = flow.fadingTo ? null : scene().forfeitLabel?.(game) ?? null;
    return menuItems({ forfeit, inGame: !away, hasTare: game.run.gear.tare, nameLabel: nameMenuLabel(playerName(game.run)), multiplayer: canLeaveStory(), signIn: canLeaveStory() && game.online.accountState() === "guest" });
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
    } else if (card?.kind === "name") {
      const step = stepNameEntry(card.entry, input.typed());
      if (!step.done) card = { kind: "name", entry: step.entry };
      else {
        if (step.done === "keep") game.run = { ...game.run, name: cleanPlayerName(step.entry.text) };
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
      left: input.wasPressed("left"),
      right: input.wasPressed("right"),
      confirm: input.wasPressed("confirm"),
      cancel: input.wasPressed("cancel"),
    }, (choice, keys) => {
      // Equipping changes the run straight away, so it's saved like any other change.
      const screen = stepInventoryScreen(game.run, choice, keys);
      game.run = screen.run;
      return screen;
    }, { goal: goalRow(game.run), rows: LADDER.length });
    const openBindings = menu.page === "main" && step.menu.page === "controls";
    menu = step.menu;
    if (openBindings) {
      editingBindings = true;
      const close = () => { editingBindings = false; menu = { page: "main", choice: pauseItems().findIndex((item) => item.id === "controls") }; options.onBindingsUi?.(null); input.clear(); };
      options.onBindingsUi?.({ bindings: keybindings.current(), close, save: async (bindings) => { const saved = await keybindings.set(bindings); if (saved) close(); return saved; } });
    }
    if (step.action === "resume") flow = { ...flow, paused: false };
    else if (step.action === "use-ticket") {
      flow = { ...flow, paused: false };
      if (canUseTicketIn(sceneName) && !flow.fadingTo && !scene().busy?.(game)) {
        game.ride = "hall";
        game.go("travel");
      } else notices.push(TICKET_NOT_NOW);
    }
    else if (step.action === "name") {
      flow = { ...flow, paused: false };
      card = { kind: "name", entry: createNameEntry(characterById(game.run.character).name, game.run.name) };
    }
    else if (step.action === "insignia") {
      flow = { ...flow, paused: false };
      card = { kind: "insignia", editor: createInsigniaEditor(game.run.insignia) };
    }
    else if (step.action === "multiplayer") {
      flow = { ...flow, paused: false };
      if (canLeaveStory()) {
        game.online.returnTo = "story";
        game.go("online");
      }
    }
    else if (step.action === "sign-in") {
      flow = { ...flow, paused: false };
      game.online.openAccountForm();
    }
    else if (step.action === "forfeit") {
      flow = { ...flow, paused: false };
      scene().forfeit?.(game);
    } else if (step.action === "restart") {
      clearSave(store);
      game.online.save?.removeStory();
      startFresh(createRunState());
      flow = createFlow();
      switchScene("title");
    }
  };

  let shownUi: AccountUi | null = null;
  /** A form over the game, whose keys are its own. */
  const showAccountUi = () => {
    const ui = game.online.accountUi();
    const same = ui?.kind === shownUi?.kind && (ui?.kind !== "choice" || shownUi?.kind !== "choice" || ui.choice === shownUi.choice);
    if (!same) {
      shownUi = ui;
      options.onAccountUi?.(ui);
    }
    return ui;
  };

  const update = () => {
    const ui = showAccountUi();
    if (editingBindings) {
      input.clear();
      if (scene().keepsRunning?.(game)) scene().liveTick?.(game);
      return;
    }
    // Being paused hands the keys back, or nobody could work the menu.
    game.input.setTyping(!!ui || (!flow.paused && (card?.kind === "name" || !!scene().typing?.())));
    // A story waits for a form. Someone else's match can't.
    if (ui && !scene().keepsRunning?.(game) && !scene().neverPauses?.(game)) return;
    if (game.input.wasPressed("mute")) muted = game.audio.toggleMute();
    const result = stepFlow(flow, game.input.wasPressed("pause") && !ui && !scene().neverPauses?.(game));
    flow = result.flow;
    if (flow.paused) {
      if (scene().keepsRunning?.(game)) scene().liveTick?.(game);
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
    // Someone mid-sentence has the top of the screen, so what changed waits its turn rather than sitting on their words.
    // Scenes with people in them say when a conversation or menu is up; a drill's always "busy", so that can't be the test.
    if (notices.length && !game.debug.talking && ++noticeTicks >= NOTICE_TICKS) {
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
      if (notices.length && !game.debug.talking) {
        const width = measureText(notices[0]);
        ctx.fillStyle = UI.panel;
        ctx.fillRect((viewW - width) / 2 - 4, 21, width + 8, 11);
        drawTextCentered(ctx, notices[0], viewW / 2, 22, UI.accent);
      }
      if (card?.kind === "item") drawItemCard(ctx, card.reveal, game.run, game.reducedMotion);
      if (card?.kind === "insignia") drawInsigniaCard(ctx, card.editor, game.run);
      if (card?.kind === "name") drawNameCard(ctx, card.entry, playerColors(game.run));
      if (flow.paused) drawPauseMenu(ctx, menu, pauseItems(), game.run, game.input);
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
    // Someone else is waiting on these, so walking away doesn't stop them.
    if (scene().keepsRunning?.(game) || scene().neverPauses?.(game)) {
      game.input.clear();
      return;
    }
    if (document.hidden || !document.hasFocus()) {
      flow = { ...flow, paused: true };
      game.input.clear();
    }
  };
  const unlockAudio = () => game.audio.unlock();
  // It has to happen right here in the key press, or the browser refuses it.
  const toggleFullscreen = (event: KeyboardEvent) => {
    if (editingBindings || game.input.typing || !input.matches("fullscreen", event.key, event.code) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (document.fullscreenElement) {
      leavingFullscreen = true;
      void document.exitFullscreen().catch(() => { leavingFullscreen = false; });
    } else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  // Set while the game's own key is taking it out of fullscreen, so only the browser's Esc opens the menu.
  let leavingFullscreen = false;
  const onFullscreenChange = () => {
    const fullscreen = !!document.fullscreenElement;
    const lock = keyboardLock();
    const lockStep = escapeLock(fullscreen, !!lock);
    if (lockStep === "lock") void lock!.lock(["Escape"]).catch(() => {});
    else if (lockStep === "unlock") lock!.unlock();
    const byGame = leavingFullscreen;
    leavingFullscreen = false;
    // Whatever would have let the pause key through in update().
    const canPause = !editingBindings && !game.input.typing && !game.online.accountUi() && !scene().neverPauses?.(game);
    if (pausesOnFullscreenExit({ fullscreen, byGame, paused: flow.paused, canPause })) {
      flow = { ...flow, paused: true };
      game.input.clear();
    }
  };
  const flushSave = () => game.online.save?.flushOnClose();
  const retryBindings = () => { void keybindings.retry(); };
  window.addEventListener("online", retryBindings);
  window.addEventListener("pagehide", flushSave);
  window.addEventListener("blur", pauseIfAway);
  document.addEventListener("visibilitychange", pauseIfAway);
  window.addEventListener("keydown", unlockAudio);
  window.addEventListener("keydown", toggleFullscreen);
  document.addEventListener("fullscreenchange", onFullscreenChange);

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
      get teachCard() {
        return game.debug.teachCard;
      },
      get lesson() {
        return game.debug.lesson;
      },
      get ceremony() {
        return game.debug.ceremony;
      },
      get menToast() {
        return game.debug.menToast;
      },
      get kirikaeshi() {
        return game.debug.kirikaeshi;
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
      get dungeon() {
        return game.debug.dungeon;
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
      options.onBindingsUi?.(null);
      stopTitleFlash();
      window.removeEventListener("online", retryBindings);
      window.removeEventListener("pagehide", flushSave);
      window.removeEventListener("blur", pauseIfAway);
      document.removeEventListener("visibilitychange", pauseIfAway);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("keydown", toggleFullscreen);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    },
    resize(fit) {
      resize(fit);
      // Resizing wipes the picture, so put it straight back. Before the start, there's no scene ready to draw.
      if (started) render();
    },
  };
}
