import { instructionText, keyLabel, teachingKeys } from "../core/key-labels.ts";
import { playerColors, playerName } from "../characters.ts";
import { drawText, LINE_HEIGHT, wrapText } from "../art/font.ts";
import { FULL_GEAR } from "../art/kendoka.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { onGui, onStage, stageX, stageY, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { parryShine } from "../duel/poses.ts";
import { screenX, skipBow, step } from "../duel/rules.ts";
import { finishSession } from "./club-story.ts";
import { FORFEIT_TRAINING, GEN_FAIL, LESSON_GOOD, LESSON_WRONG, PARRY_NOW } from "./content.ts";
import { wasTaught } from "./teaching.ts";
import { createLessonDuel, judge, lessonsFor, partnerColors, partnerName, SENPAI, sessionPartner, sessionPlace, type Lesson, type Session } from "./curriculum.ts";
import { figureAt } from "./bubble.ts";
import { createDialogue } from "./dialogue.ts";
import { applyEvents, createDuelView, createPlayerControl, drawDuelHud, drawDuelStage, drawKeyPrompt, playDuelSounds, playSemeHum, playShineTing, tickView, WIDE_TEXT, type DuelView } from "./duel.ts";
import { createTeachCards, keysLine } from "./teach-card.ts";
import { CEREMONY_TICKS, ceremonyFrame, createCeremony, drawCeremonyProps, stepCeremony, type Ceremony } from "./men-ceremony.ts";

const GROUND = 128;
/** How far above the floor the top of a fighter's head is. */
const FIGHTER_TOP = 42;

const PAUSE_TICKS = 70;
/** How far from you the senpai stops to put your men on. */
const CEREMONY_REACH = 30;

/** One session with one partner: Sensei's drills, a senpai's challenge, or Old Gen's seme. */
export function createTrainingScene(nameOf: () => string): Scene {
  const dialogue = createDialogue(nameOf);
  const cards = createTeachCards();
  let session: Session = { kind: "sensei", round: 0 };
  let lessons: Lesson[] = [];
  let lessonIndex = 0;
  let view: DuelView;
  let control = createPlayerControl();
  let tick = 0;
  let message: string | null = null;
  let pause = 0;
  let reps = 0;
  let misses = 0;
  let ended = false;
  let memo: Record<string, boolean> = {};
  /** The senpai handing over your men, and what comes after it. */
  let ceremony: { state: Ceremony; then: () => void } | null = null;
  let ceremonyView: DuelView | null = null;

  const lesson = () => lessons[lessonIndex];

  /** The senpai walking over with your men, at this tick of it. Nobody fights, so it's the stage without the HUD. */
  const drawCeremony = (ctx: CanvasRenderingContext2D, game: Game, shown: DuelView, tick: number) => {
    const frame = ceremonyFrame(tick, game.reducedMotion);
    const { duel } = shown;
    const [you, them] = duel.fighters;
    // They stop a little short of you, close enough to reach your head.
    const senpaiX = them.x + (you.x + CEREMONY_REACH - them.x) * frame.approach;
    const moved: DuelView = { ...shown, duel: { ...duel, fighters: [you, { ...them, x: senpaiX }] }, moving: [false, frame.beat === "approach"] };
    drawDuelStage(ctx, moved, sessionPlace(session), {
      opponent: "senior",
      facing: sessionPartner(session),
      opponentColors: partnerColors(session),
      gear: { ...gearFor(game), men: frame.worn },
      playerColors: playerColors(game.run),
      referees: false,
      reducedMotion: game.reducedMotion,
    });
    const stage = { senpaiX: screenX(duel, senpaiX), playerX: screenX(duel, you.x), ground: GROUND, headTop: GROUND - FIGHTER_TOP };
    onStage(ctx, () => drawCeremonyProps(ctx, frame, stage, { player: playerColors(game.run), senpai: partnerColors(session) }, tick));
  };
  /** The short tutorial belongs to nobody's story, so it mustn't read or change one. */
  const quick = () => session.kind === "quick";
  /** The men's yours, but it isn't on your head until the senpai's put it there. */
  let menWaiting = false;
  const gearFor = (game: Game) => (quick() ? FULL_GEAR : menWaiting ? { ...game.run.gear, men: false } : game.run.gear);
  const canSeme = (game: Game) => quick() || game.run.seme || session.kind === "master";

  const startRep = (game: Game) => {
    view = createDuelView(skipBow(createLessonDuel(lesson())));
    control = createPlayerControl();
    message = null;
    pause = 0;
    memo = {};
    game.debug.duel = view.duel;
    game.debug.lesson = lesson().id;
    game.debug.reps = { reps, misses };
  };

  const startLesson = (game: Game, index: number) => {
    lessonIndex = index;
    // Sensei's teaching it right now, so nobody needs the card that explains it to older saves.
    if (lesson().id === "opening" && !wasTaught(game.run, "openings")) game.run = { ...game.run, seen: [...game.run.seen, "taught:openings"] };
    reps = 0;
    misses = 0;
    startRep(game);
    // Nothing moves until you've read what this one's about and said you're ready.
    cards.show(game, { title: lesson().title, text: lesson().prompt, keys: lesson().keys });
  };

  /** Back to wherever this session started. */
  const leave = (game: Game) => {
    ended = true;
    game.go(quick() ? "online" : session.kind === "master" ? "map" : "club");
  };

  const finishAll = (game: Game) => {
    const reply = finishSession(game.run, session);
    game.run = reply.run;
    game.audio.play("pickup");
    // The session's over, so there's nothing left to give up on, even with a card up.
    ended = true;
    const done = () => {
      if (quick()) game.online.finishTutorial();
      game.message = reply.home ?? null;
      leave(game);
    };
    const onward = () => game.showCards(reply.after ? () => dialogue.open(reply.after!, done, done) : done);
    // The men is put on your head before its card comes up. Skipping the words doesn't skip that.
    menWaiting = !!reply.ceremony;
    const next = reply.ceremony ? () => startCeremony(onward) : onward;
    dialogue.open(reply.lines, next, next);
  };

  const startCeremony = (then: () => void) => {
    // Everyone back to where they'd stand to begin, whatever the drill left them doing.
    ceremonyView = createDuelView(skipBow(createLessonDuel(lesson())));
    ceremony = { state: createCeremony(), then };
  };

  const failChallenge = (game: Game) => {
    const done = () => leave(game);
    dialogue.open([session.kind === "senpai" ? SENPAI[session.senpai].fail : GEN_FAIL], done, done);
  };

  const failed = () => lesson().misses !== undefined && misses >= lesson().misses!;

  return {
    forfeitLabel: () => (dialogue.active || ended ? null : FORFEIT_TRAINING),
    forfeit: leave,
    outsideStory: () => quick(),
    // Anything earned here waits for the end, so a lesson is never interrupted.
    busy: () => true,
    enter(game) {
      session = game.session ?? { kind: "sensei", round: game.run.senseiRounds };
      game.session = null;
      lessons = lessonsFor(session);
      ended = false;
      ceremony = null;
      ceremonyView = null;
      menWaiting = false;
      cards.clear(game);
      startLesson(game, 0);
    },
    update(game) {
      game.debug.talking = dialogue.active;
      if (dialogue.active) {
        dialogue.update(game.input, game.audio);
        return;
      }
      if (ceremony && ceremonyView) {
        const before = ceremonyFrame(ceremony.state.tick, game.reducedMotion);
        const state = stepCeremony(ceremony.state, game.input.wasPressed("confirm"));
        const now = ceremonyFrame(state.tick, game.reducedMotion);
        if (now.beat === "glow" && before.beat !== "glow") game.audio.play("secret");
        if (now.worn && !before.worn) game.audio.play("pickup");
        ceremonyView.walkTick++;
        ceremony.state = state;
        game.debug.ceremony = { tick: state.tick, beat: now.beat, done: state.done };
        if (state.done) {
          const { then } = ceremony;
          ceremony = null;
          then();
        }
        return;
      }
      if (ended) return;
      if (cards.active) {
        cards.update(game);
        return;
      }
      tick++;
      if (pause > 0) {
        tickView(view);
        if (--pause > 0) return;
        if (failed()) failChallenge(game);
        else if (reps < (lesson().reps ?? 1)) startRep(game);
        else if (lessonIndex + 1 < lessons.length) startLesson(game, lessonIndex + 1);
        else finishAll(game);
        return;
      }

      const current = lesson();
      const player = control(game.input, view.duel.fighters[0], canSeme(game), view.duel.crossed);
      view.duel = step(view.duel, player, current.partner(tick, view.duel));
      game.debug.duel = view.duel;
      applyEvents(view, view.duel.events, game.reducedMotion, gearFor(game));
      playDuelSounds(game.audio, view.duel.events);
      playShineTing(game.audio, view);
      playSemeHum(game.audio, view.duel.fighters[0].stance === "seme", view.walkTick);
      tickView(view);

      if (current.done(view.duel.events, view.duel, memo)) {
        reps++;
        game.debug.reps = { reps, misses };
        message = LESSON_GOOD;
        pause = PAUSE_TICKS;
      } else if (current.misses !== undefined && judge(view.duel.events, gearFor(game))) {
        misses++;
        game.debug.reps = { reps, misses };
        if (failed()) pause = PAUSE_TICKS;
      } else if (view.duel.phase === "point") {
        message = LESSON_WRONG;
        pause = PAUSE_TICKS;
      }
    },
    render(ctx, game) {
      // Once it's started, the ceremony stays on screen behind the card, with your men on.
      if (ceremonyView) {
        drawCeremony(ctx, game, ceremonyView, ceremony?.state.tick ?? CEREMONY_TICKS);
        onGui(ctx, () => {
          const you = figureAt(ctx, stageX() + screenX(ceremonyView!.duel, ceremonyView!.duel.fighters[0].x), stageY() + GROUND - FIGHTER_TOP, stageY() + GROUND);
          dialogue.render(ctx, { at: () => you, avoid: [you] });
        });
        cards.render(ctx);
        return;
      }
      drawDuelStage(ctx, view, sessionPlace(session), {
        opponent: "senior",
        facing: sessionPartner(session),
        opponentColors: partnerColors(session),
        gear: gearFor(game),
        playerColors: playerColors(quick() ? { ...game.run, gi: true } : game.run),
        referees: false,
        reducedMotion: game.reducedMotion,
      });
      const current = lesson();
      const { duel } = view;
      drawDuelHud(ctx, view, [playerName(game.run), partnerName(session)], keysLine(current.keys.map(([key, does]) => [teachingKeys(game.input, key), does]), view.walkTick), 0, undefined, game.input);
      // When to tap: nobody learns a parry's timing from a sentence.
      const them = duel.fighters[1];
      if (current.cue && duel.phase === "fight" && them.stance === "windup") {
        const windup = duel.options.windups?.[1]?.[them.attack!] ?? 1;
        onStage(ctx, () => drawKeyPrompt(ctx, screenX(duel, them.x), GROUND, parryShine(duel, 1) > 0 ? PARRY_NOW.replace("S", keyLabel(game.input, "down", "s")) : null, them.stanceTicks / windup));
      }
      // Whoever's teaching says it from where they're standing.
      const figureOf = (i: 0 | 1) => figureAt(ctx, stageX() + screenX(duel, duel.fighters[i].x), stageY() + GROUND - FIGHTER_TOP, stageY() + GROUND);
      const you = figureOf(0);
      const partner = figureOf(1);
      onGui(ctx, () => {
        const text = instructionText(game.input, message ?? current.prompt);
        const width = Math.min(viewW - 16, WIDE_TEXT);
        const lines = wrapText(text, width - 12);
        if (current.misses !== undefined) {
          lines.push(`Clean ${reps}/${current.reps ?? 1}   Misses ${misses}/${current.misses}`);
        }
        // During the follow-through, the zanshin meter is the only prompt that matters.
        if (!view.duel.zanshin) {
          const x = Math.floor((viewW - width) / 2);
          const height = lines.length * LINE_HEIGHT + 8;
          ctx.fillStyle = PALETTE.g;
          ctx.fillRect(x, 20, width, height);
          ctx.fillStyle = UI.panel;
          ctx.fillRect(x + 1, 21, width - 2, height - 2);
          ctx.fillStyle = PALETTE.G;
          for (let i = 4; i < width - 4; i += 8) ctx.fillRect(x + i, 21, 3, 1);
          lines.forEach((line, i) => {
            drawText(ctx, line, x + 6, 24 + i * LINE_HEIGHT, message === LESSON_GOOD ? UI.good : UI.text);
          });
        }
        dialogue.render(ctx, { at: (name) => (name ? partner : you), avoid: [you] });
      });
      cards.render(ctx);
    },
  };
}
