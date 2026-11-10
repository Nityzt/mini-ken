import { senseiOnShinai, senseiReminder } from "./shinai-story.ts";
import { SAYU_COUNT, type KirikaeshiOutcome } from "../duel/kirikaeshi.ts";
import { hasLetter, MAX_DAN } from "../ranks.ts";
import { canChallengeSensei } from "./challengers.ts";
import type { ChoiceOption } from "./choice.ts";
import { isOpen, lockedLine, lockFor, LINE_PASSES_TO_UNLOCK, needsSentence, nextGoal } from "../progress.ts";
import { CUPS, type CupId } from "../world/tournament.ts";
import { earn, maybeTip, withFeat } from "../money.ts";
import { gainXp, PAY_DRILL, PAY_HELPING, recordKirikaeshiPass, recordLinePass, recordWin, XP_DRILL, type RunState } from "../run-state.ts";
import {
  CUP_ENTER, CUP_WON_BEFORE, cupNotice, DOOR_LOCKED, DOOR_NEEDS_SPAR, DRILL_PRAISE, GEN_DONE, GEN_DONE_AFTER, GI_REMINDER, KOTE_DONE, LINE_AGAIN, LINE_FIRST, LINE_NO_KEYS, LINE_STREETS_OPEN,
  lineExtraRun, lineFailed, lineRunDone, MOMO_AFTER, MOMO_GOT_GI, MOMO_GUARD, MOMO_GUARD_SEME, momoPractice, MOMO_WELCOME, SENPAI_LINES, SENSEI_AGAIN, SENSEI_ALL_OPEN,
  helpPaid, HELP_FAILED, MENU_CHALLENGE, MENU_CHALLENGE_THEM, MENU_GRADE, MENU_HELP, MENU_LEAVE, MENU_LETTER, MENU_LINE, MENU_SPAR, MENU_TALK, MENU_WAZA, MENU_WAZA_AGAIN, QUICK_DONE, WAZA_AGAIN_DONE, WAZA_DONE, SENSEI_NEXT, SENSEI_NO_GI, SENSEI_ROUND_DONE, SENSEI_SHINAI, SENSEI_SHINAI_AFTER, SENSEI_WAITING, SHINAI_WAITING, SPAR_DOOR_OPEN, SPAR_KI,
  eitherOf, KIRIKAESHI_AGAIN, KIRIKAESHI_FIRST, KIRIKAESHI_LOST, KIRIKAESHI_WINDED, kirikaeshiDone, kirikaeshiGrew, MENU_KIRIKAESHI, SENSEI_NOT_YET, SENSEI_OFFER, SENSEI_WHY, WHY_REPLY } from "./content.ts";
import { CHALLENGE_REWARD, SENPAI, SENPAI_IDS, type SenpaiId, type Session } from "./curriculum.ts";
import { MEN_CEREMONY_SEEN } from "./men-ceremony.ts";
import { wasTaught } from "./teaching.ts";

/** What each person says depends only on how far through the armor loop the player is. */

/** The level of challenge waiting to be passed, if any: Sensei has taught it and the armor isn't earned. */
export function pendingChallenge(run: RunState): number | null {
  const level = run.senseiRounds - 1;
  if (level < 0 || level >= CHALLENGE_REWARD.length) return null;
  return run.gear[CHALLENGE_REWARD[level]] ? null : level;
}

/**
 * The senpai who haven't passed you for any armor yet: each piece has to come from someone different.
 * A save with all three somehow on record still leaves everyone free, so nobody is ever stranded.
 */
export function freeSenpai(run: RunState): SenpaiId[] {
  const used = Object.values(run.armorFrom);
  const free = SENPAI_IDS.filter((id) => !used.includes(id));
  return free.length ? free : SENPAI_IDS;
}

/** The senpai still left to pass, by name, for Sensei and the objective line. */
export const freeSenpaiNames = (run: RunState): string => eitherOf(freeSenpai(run).map((id) => SENPAI[id].name));

/** `escort` means Momo walks you to the storage room afterwards, and it's the walk that unlocks it. */
export function talkToMomo(run: RunState): { lines: string[]; run: RunState; fight: boolean; chats?: boolean; escort?: boolean } {
  if (run.momoBeaten) return { lines: MOMO_AFTER, run, fight: false, chats: true };
  if (run.trained) return { lines: run.seme ? MOMO_GUARD_SEME : MOMO_GUARD, run, fight: true };
  if (run.gear.tare) return { lines: momoPractice(freeSenpaiNames(run)), run, fight: false };
  if (run.gear.shinai) return { lines: SHINAI_WAITING, run, fight: false };
  if (run.gi) return { lines: MOMO_GOT_GI, run, fight: false };
  if (run.metSenpai) return { lines: GI_REMINDER, run, fight: false };
  return { lines: MOMO_WELCOME, run, fight: false, escort: true };
}

/**
 * How Sensei sets up the line drill, depending on how far along you are. Choosing it from his menu was the
 * decision, so there's no "ready?" after it. When the drill's own card is about to say the same thing, the
 * card says it and Sensei doesn't, and an empty list means straight in.
 */
export function lineOffer(run: RunState): string[] {
  if (run.linePasses === 0) return wasTaught(run, "line") ? [LINE_FIRST] : [];
  if (run.linePasses >= LINE_PASSES_TO_UNLOCK - 1) return wasTaught(run, "lineNoKeys") ? [LINE_NO_KEYS] : [];
  return [LINE_AGAIN];
}

export type SenseiChoice = "line" | "kirikaeshi" | "waza" | "help" | "grade" | "challenge" | "talk" | "leave";
export type SenpaiChoice = "spar" | "talk" | "grade" | "leave";

const gradeOption = (run: RunState) => (run.dan < MAX_DAN ? [{ id: "grade" as const, label: hasLetter(run) ? MENU_LETTER : MENU_GRADE }] : []);

/** What you can ask Sensei for, once you're armored. */
export function senseiMenu(run: RunState): ChoiceOption<SenseiChoice>[] {
  return [
    { id: "line", label: MENU_LINE },
    { id: "kirikaeshi", label: MENU_KIRIKAESHI },
    { id: "waza", label: run.waza ? MENU_WAZA_AGAIN : MENU_WAZA },
    { id: "help", label: MENU_HELP },
    ...gradeOption(run),
    ...(canChallengeSensei(run) ? [{ id: "challenge" as const, label: MENU_CHALLENGE }] : []),
    { id: "talk", label: MENU_TALK },
    { id: "leave", label: MENU_LEAVE },
  ];
}

/** What you can ask a senpai for, once you're armored. */
export const senpaiMenu = (run: RunState): ChoiceOption<SenpaiChoice>[] => [
  { id: "spar", label: MENU_SPAR },
  { id: "talk", label: MENU_TALK },
  ...gradeOption(run),
  { id: "leave", label: MENU_LEAVE },
];

/** What you can ask someone at another dojo. */
export const helperMenu = (run: RunState): ChoiceOption<"talk" | "grade" | "leave">[] => [
  { id: "talk", label: MENU_TALK },
  ...gradeOption(run),
  { id: "leave", label: MENU_LEAVE },
];
/** What you can ask the person you came to beat. */
export const headMenu = (run: RunState): ChoiceOption<"challenge" | "talk" | "grade" | "leave">[] => [
  { id: "challenge", label: MENU_CHALLENGE_THEM },
  { id: "talk", label: MENU_TALK },
  ...gradeOption(run),
  { id: "leave", label: MENU_LEAVE },
];
/** What you can ask another dojo's sensei. They'll tell you for themselves if you haven't got the rank. */
export const dojoSenseiMenu = (_run: RunState): ChoiceOption<"talk" | "challenge" | "leave">[] => [
  { id: "talk", label: MENU_TALK },
  { id: "challenge", label: MENU_CHALLENGE_THEM },
  { id: "leave", label: MENU_LEAVE },
];

/** Someone with a stance of their own, who'd sooner fight you than talk, but will do both. */
export const challengerMenu = (): ChoiceOption<"challenge" | "talk" | "leave">[] => [
  { id: "challenge", label: MENU_CHALLENGE_THEM },
  { id: "talk", label: MENU_TALK },
  { id: "leave", label: MENU_LEAVE },
];

/** `lines` lead up to anything you're given, and `after` is what gets said once you've seen it. */
export function talkToSensei(run: RunState): { lines: string[]; after?: string[]; run: RunState; session: Session | null; menu?: boolean; ask?: "why" | "offer" } {
  if (run.trained) {
    const onShinai = senseiOnShinai(run);
    if (onShinai) return { ...onShinai, session: null };
    const reminder = senseiReminder(run);
    const goal = nextGoal(run);
    return { lines: [...(reminder ? [reminder] : []), goal ? needsSentence(run, goal) : SENSEI_ALL_OPEN], run, session: null, menu: true };
  }
  if (!run.gi) return { lines: [SENSEI_NO_GI], run, session: null };
  if (!run.gear.shinai) {
    if (!run.whyKendo) return { lines: SENSEI_WHY, run, session: null, ask: "why" };
    return { lines: SENSEI_OFFER, run, session: null, ask: "offer" };
  }
  if (run.senseiRounds === 0) return { lines: SENSEI_AGAIN, run, session: { kind: "sensei", round: 0 } };
  const pending = pendingChallenge(run);
  if (pending !== null) return { lines: [SENSEI_WAITING[pending](freeSenpaiNames(run))], run, session: null };
  return { lines: [SENSEI_NEXT[run.senseiRounds]], run, session: { kind: "sensei", round: run.senseiRounds } };
}

/** Why you've come. There's no wrong answer, and Sensei remembers it. The offer of the shinai comes straight after. */
export const answerWhy = (run: RunState, why: string): { lines: string[]; run: RunState } => ({ lines: [WHY_REPLY[why], ...SENSEI_OFFER], run: { ...run, whyKendo: why } });

/** Taking up the offer. `after` and `session` are only there once you've said yes. */
export function answerOffer(run: RunState, answer: string): { lines: string[]; after?: string[]; run: RunState; session: Session | null } {
  if (answer !== "yes") return { lines: SENSEI_NOT_YET, run, session: null };
  return { lines: SENSEI_SHINAI, after: SENSEI_SHINAI_AFTER, run: { ...run, gear: { ...run.gear, shinai: true } }, session: { kind: "sensei", round: 0 } };
}

export function talkToSenpai(run: RunState, senpai: SenpaiId): { lines: string[]; session: Session | null; fight?: SenpaiId } {
  const lines = SENPAI_LINES[senpai];
  const level = pendingChallenge(run);
  if (level !== null) {
    // They've already given you a piece, so this one has to come from someone else. They're still happy to talk.
    const given = CHALLENGE_REWARD.find((piece) => run.armorFrom[piece] === senpai);
    if (given && !freeSenpai(run).includes(senpai)) return { lines: [lines.given(given, freeSenpaiNames(run))], session: null };
    return { lines: [lines.intro], session: { kind: "senpai", senpai, level } };
  }
  if (run.trained) return { lines: [lines.spar], session: null, fight: senpai };
  return { lines: run.gear.shinai && !run.trained && run.senseiRounds > 0 ? [lines.seeSensei] : lines.chat, session: null };
}

/** What finishing a training session earns, and what gets said about it: `lines` up to the gift, `after` once you've seen it, and `home` once you're back out in the dojo. */
export function finishSession(before: RunState, session: Session): { run: RunState; lines: string[]; after?: string[]; home?: string[]; ceremony?: "men" } {
  // The short tutorial is for people not playing the story, and practising what you already know pays nothing.
  if (session.kind === "quick") return { run: before, lines: QUICK_DONE };
  if (session.kind === "waza" && before.waza) return { run: before, lines: WAZA_AGAIN_DONE };
  const run = earn(gainXp(before, XP_DRILL), PAY_DRILL);
  if (session.kind === "waza") return { run: { ...run, waza: true }, lines: WAZA_DONE };
  if (session.kind === "master") return { run: { ...run, seme: true }, lines: GEN_DONE, after: GEN_DONE_AFTER };
  if (session.kind === "senpai") {
    const earned = CHALLENGE_REWARD[session.level];
    const gear = { ...run.gear, [earned]: true };
    // The men is put on your head for you, the first time, and the dojo mentions it once you're back.
    const ceremony = earned === "men" && !before.gear.men;
    return {
      run: { ...run, gear, trained: earned === "kote", armorFrom: { ...run.armorFrom, [earned]: session.senpai }, ...(ceremony ? { seen: [...run.seen, MEN_CEREMONY_SEEN] } : {}) },
      lines: [SENPAI_LINES[session.senpai].pass],
      ...(earned === "kote" ? { home: [KOTE_DONE] } : {}),
      ...(ceremony ? { ceremony: "men" as const } : {}),
    };
  }
  const next = { ...run, senseiRounds: Math.max(run.senseiRounds, session.round + 1) };
  if (session.round > 0) return { run: next, lines: [SENSEI_ROUND_DONE[session.round](freeSenpaiNames(next))] };
  return {
    run: { ...next, gear: { ...next.gear, tare: true } },
    lines: [DRILL_PRAISE.tare!],
    after: [SENSEI_ROUND_DONE[0](freeSenpaiNames(next))],
  };
}

/** A win in a real match against a senpai. */
export function sparOutcome(run: RunState, senpai: SenpaiId): { run: RunState; lines: string[] } {
  const next = recordWin(run, senpai);
  return {
    run: next,
    lines: [
      SENPAI_LINES[senpai].sparWin,
      ...(next.bonusKi > run.bonusKi ? [SPAR_KI] : []),
      ...(isOpen(next, "door") && !isOpen(run, "door") ? [SPAR_DOOR_OPEN] : []),
    ],
  };
}

const PERFECT_LINE_LENGTH = 5;

/** How a run of the line drill went. A failed run costs nothing. Helping the beginners pays, and isn't your own practice. */
export function lineOutcome(run: RunState, result: { passed: boolean; cleans: number; count: number }, helping = false, roll = 1): { run: RunState; lines: string[] } {
  const { passed, cleans, count } = result;
  if (helping) {
    if (!passed) return { run, lines: [HELP_FAILED] };
    const tip = maybeTip(earn(run, PAY_HELPING), roll);
    return { run: tip.run, lines: [helpPaid(PAY_HELPING), ...(tip.line ? [tip.line] : [])] };
  }
  if (!passed) return { run, lines: [lineFailed(cleans, count)] };
  const perfect = cleans === count && count >= PERFECT_LINE_LENGTH;
  const next = recordLinePass(perfect ? withFeat(run, "perfectLine") : run);
  if (next.linePasses > LINE_PASSES_TO_UNLOCK) return { run: next, lines: [lineExtraRun(cleans, count)] };
  if (next.linePasses === LINE_PASSES_TO_UNLOCK) return { run: next, lines: [LINE_STREETS_OPEN] };
  return { run: next, lines: [lineRunDone(cleans, count, next.linePasses, LINE_PASSES_TO_UNLOCK)] };
}

/** How Sensei sets up kirikaeshi, depending on how far along you are. */
export const kirikaeshiOffer = (run: RunState): string[] => (run.kirikaeshiPasses === 0 ? KIRIKAESHI_FIRST : [KIRIKAESHI_AGAIN]);

/** Being on Bo's beat is only ever praise: a pass earns the same however slowly it went. */
export function kirikaeshiOutcome(run: RunState, result: { outcome: KirikaeshiOutcome; misses: number; onBeat: number }): { run: RunState; lines: string[] } {
  const { outcome, misses, onBeat } = result;
  if (outcome === "winded") return { run, lines: [KIRIKAESHI_WINDED] };
  if (outcome === "lost") return { run, lines: [KIRIKAESHI_LOST] };
  const next = recordKirikaeshiPass(run);
  return { run: next, lines: [(next.bonusKi > run.bonusKi ? kirikaeshiGrew : kirikaeshiDone)(misses, onBeat, SAYU_COUNT)] };
}

export function doorResponse(run: RunState): { leaves: boolean; lines: string[] } {
  if (isOpen(run, "door")) return { leaves: true, lines: [] };
  return { leaves: false, lines: [run.trained ? DOOR_NEEDS_SPAR : DOOR_LOCKED] };
}

/** What a dojo's notice board says about its cup. */
export function cupOffer(run: RunState, cup: Exclude<CupId, "grand">): { lines: string[]; enter: boolean } {
  const lock = lockFor(run, `cup:${cup}`);
  if (lock) return { lines: [lockedLine(run, lock)], enter: false };
  const won = run.cups.includes(cup);
  return { lines: [cupNotice(CUPS[cup].name, !won), won ? CUP_WON_BEFORE : CUP_ENTER], enter: true };
}

const LABELS = {
  hall: { P: "Talk", D: "Leave" },
  home: { $: "Merch", M: "Talk", X: "Talk", A: "Talk", B: "Talk", Y: "Talk", V: "Talk", Z: "Talk", N: "Notice board", D: "Leave", C: "Look", Q: "Door" },
  rival: { $: "Merch", X: "Talk", G: "Talk", E: "Talk", V: "Talk", R: "Talk", J: "Challenge", N: "Notice board", D: "Leave" },
} satisfies Record<string, Record<string, string>>;

/**
 * The words over your head. Facing someone, it names them: their own tag would sit right beside it, or on top
 * of you when they're below, so it's hidden and the prompt says who it is instead.
 */
export const promptFor = (label: string, name?: string): string => (name && label === "Talk" ? `Talk to ${name}` : label);

/** What pressing E would do at this tile, if anything. Shown over your head, so nobody has to guess. */
export const interactionLabel = (tile: string, place: keyof typeof LABELS): string | null => (LABELS[place] as Record<string, string>)[tile] ?? null;

