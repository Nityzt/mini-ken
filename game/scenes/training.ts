import { playerColors, playerName } from "../characters.ts";
import { drawTextCentered, LINE_HEIGHT, wrapText } from "../art/font.ts";
import { FULL_GEAR } from "../art/kendoka.ts";
import { PALETTE, UI } from "../art/palette.ts";
import { onGui, onStage, stageX, stageY, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { parryShine } from "../duel/poses.ts";
import { screenX, skipBow, step } from "../duel/rules.ts";
import { finishSession } from "./club-story.ts";
import { FORFEIT_TRAINING, GEN_FAIL, LESSON_GOOD, LESSON_WRONG, PARRY_NOW } from "./content.ts";
import { createLessonDuel, judge, lessonsFor, partnerColors, partnerName, SENPAI, sessionPartner, sessionPlace, type Lesson, type Session } from "./curriculum.ts";
import { figureAt } from "./bubble.ts";
import { createDialogue } from "./dialogue.ts";
import { applyEvents, createDuelView, createPlayerControl, drawDuelHud, drawDuelStage, drawKeyPrompt, playDuelSounds, playSemeHum, playShineTing, tickView, WIDE_TEXT, type DuelView } from "./duel.ts";
import { createTeachCards, keysLine } from "./teach-card.ts";

const GROUND = 128;
/** How far above the floor the top of a fighter's head is. */
const FIGHTER_TOP = 42;

const PAUSE_TICKS = 70;

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

  const lesson = () => lessons[lessonIndex];
  /** The short tutorial belongs to nobody's story, so it mustn't read or change one. */
  const quick = () => session.kind === "quick";
  const gearFor = (game: Game) => (quick() ? FULL_GEAR : game.run.gear);
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
    dialogue.open(reply.lines, onward, onward);
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
      cards.clear(game);
      startLesson(game, 0);
    },
    update(game) {
      game.debug.talking = dialogue.active;
      if (dialogue.active) {
        dialogue.update(game.input, game.audio);
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
      drawDuelHud(ctx, view, [playerName(game.run), partnerName(session)], keysLine(current.keys, view.walkTick));
      // When to tap: nobody learns a parry's timing from a sentence.
      const them = duel.fighters[1];
      if (current.cue && duel.phase === "fight" && them.stance === "windup") {
        const windup = duel.options.windups?.[1]?.[them.attack!] ?? 1;
        onStage(ctx, () => drawKeyPrompt(ctx, screenX(duel, them.x), GROUND, parryShine(duel, 1) > 0 ? PARRY_NOW : null, them.stanceTicks / windup));
      }
      // Whoever's teaching says it from where they're standing.
      const figureOf = (i: 0 | 1) => figureAt(ctx, stageX() + screenX(duel, duel.fighters[i].x), stageY() + GROUND - FIGHTER_TOP, stageY() + GROUND);
      const you = figureOf(0);
      const partner = figureOf(1);
      onGui(ctx, () => {
        const text = message ?? current.prompt;
        const lines = wrapText(text, Math.min(viewW - 16, WIDE_TEXT));
        if (current.misses !== undefined) {
          lines.push(`Clean ${reps}/${current.reps ?? 1}   Misses ${misses}/${current.misses}`);
        }
        // During the follow-through, the zanshin meter is the only prompt that matters.
        if (!view.duel.zanshin) {
          ctx.fillStyle = UI.panel;
          ctx.fillRect(0, 20, viewW, lines.length * LINE_HEIGHT + 4);
          lines.forEach((line, i) => {
            drawTextCentered(ctx, line, viewW / 2, 22 + i * LINE_HEIGHT, message === LESSON_GOOD ? UI.good : UI.accent);
          });
        }
        dialogue.render(ctx, { at: (name) => (name ? partner : you), avoid: [you] });
      });
      cards.render(ctx);
    },
  };
}
