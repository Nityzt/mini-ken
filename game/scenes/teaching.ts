import { targetPrompt } from "../duel/hud.ts";
import { parryShine } from "../duel/poses.ts";
import { exposedTargets, type DuelState, type Target } from "../duel/rules.ts";
import type { Game } from "../core/scene.ts";
import type { RunState } from "../run-state.ts";
import { BRAWL_HELP, LESSON_PROMPTS, LINE_NO_KEYS } from "./content.ts";
import type { TeachCard, TeachCards, TeachKey } from "./teach-card.ts";

const SLIDE: TeachKey = ["D", "hold to slide through"];
const MOVE: TeachKey = ["A D", "move"];
const strike = (key: string, name: string): TeachKey => [`${key} + Space`, name];
const MEN = strike("J", "men");

/** What heads each drill's card, and the keys it needs. Its words are the drill's own prompt. */
const LESSON_CARDS: Record<keyof typeof LESSON_PROMPTS, { title: string; keys: TeachKey[] }> = {
  suriashi: { title: "Suriashi", keys: [["D", "slide in"], ["A", "slide back"]] },
  fumikomi: { title: "Fumikomi", keys: [MEN] },
  zanshin: { title: "Zanshin", keys: [MEN, SLIDE] },
  block: { title: "Block", keys: [["S", "hold to block"]] },
  do: { title: "Do", keys: [strike("L", "do"), SLIDE] },
  kote: { title: "Kote", keys: [strike("K", "kote"), SLIDE] },
  launch: { title: "Launch", keys: [["D D", "launch"], MEN, SLIDE] },
  parry: { title: "Parry", keys: [["S", "tap as the tip shines"]] },
  parryCounter: { title: "Parry and counter", keys: [["S", "tap as the tip shines"], MEN, SLIDE] },
  lockPush: { title: "Lock: push", keys: [["D", "hold to push"], ["A", "step out"]] },
  lockHiki: { title: "Lock: pull back", keys: [strike("J", "pull back and cut"), ["A", "hold to carry on back"]] },
  lockHold: { title: "Lock: hold", keys: [["S", "hold when the hands drop"]] },
  cross: { title: "Ai-uchi", keys: [strike("J", "swing as Sensei does")] },
  crossTurn: { title: "Ai-uchi, then on", keys: [strike("J", "men"), ["A", "walk back in, hold to finish"]] },
  opening: { title: "Openings", keys: [["W", "raise: shows your do"], ["Q", "wrist: shows your kote"], ["E", "drop: shows your men"]] },
  quickOpening: { title: "Openings", keys: [["W", "raise: shows your do"], ["Q", "wrist: shows your kote"], ["E", "drop: shows your men"]] },
  quickSeme: { title: "Seme", keys: [["I", "hold to press"], ["Space", "shout while pressing"]] },
  quickStrike: { title: "Men", keys: [["D", "slide in"], MEN, SLIDE] },
  quickTell: { title: "Read the tell", keys: [strike("K", "kote"), SLIDE] },
  quickParry: { title: "Parry", keys: [["S", "tap as the tip shines"]] },
  quickPush: { title: "Lock: push", keys: [["D", "hold to push"]] },
  quickHiki: { title: "Lock: pull back", keys: [strike("J", "pull back and cut"), ["A", "hold to carry on back"]] },
  quickCross: { title: "Ai-uchi", keys: [strike("J", "swing as Coach does")] },
  semeHold: { title: "Seme", keys: [["I", "hold to press"], ["Space", "shout while pressing"]] },
  semePunish: { title: "Punish the flinch", keys: [["I", "hold to press"], MEN, SLIDE] },
  semeRead: { title: "Let go in time", keys: [["I", "hold to press"], strike("L", "do"), SLIDE] },
};

/** Everything a drill needs to say about itself, on the card and during it. */
export const lessonText = (id: keyof typeof LESSON_PROMPTS) => {
  const card = LESSON_CARDS[id];
  // Pulling back from a lock, a parry's counter and a launch come with their own start. Everything else needs an opening first.
  const opensFirst = !NO_OPENING_NEEDED.has(id) && card.keys.some(([key]) => key.includes("J") || key.includes("K") || key.includes("L"));
  return { prompt: LESSON_PROMPTS[id], ...card, keys: opensFirst ? [OPEN_FIRST, ...card.keys] : card.keys };
};
const NO_OPENING_NEEDED = new Set<string>(["lockHiki", "quickHiki", "parryCounter", "launch"]);
const OPEN_FIRST: TeachKey = ["W Q E", "hold an opening first"];

const TARGET_KEY: Record<Target, string> = { men: "J", kote: "K", do: "L" };
const CHALLENGE_TITLE = (name: string) => `${name}'s challenge`;
/** A senpai's challenge names a target, and past the first one they hit back. */
export const challengeText = (name: string, target: Target, canBeHit: boolean): { title: string; keys: TeachKey[] } => ({
  title: CHALLENGE_TITLE(name),
  keys: [MOVE, OPEN_FIRST, strike(TARGET_KEY[target], target), ...(canBeHit ? [["S", "hold to block"] as TeachKey] : []), SLIDE],
});

export const KIRIKAESHI_CARD: TeachCard = {
  title: "Kirikaeshi",
  text: "Sensei Kuma: Big men, then sayu men left and right, at your own pace. Bo waits for each one. One last big men goes all the way through.",
  keys: [["Space + J", "big men"], ["A D", "sayu men, taking turns"], SLIDE],
};
export const LINE_CARD: TeachCard = {
  title: "Line drill",
  text: "Sensei Kuma: Each senpai shows one opening. Strike it before the bar runs out, stomp, and slide through to the next.",
  keys: [["J K L", "men, kote, do"], ["Space", "stomp with the strike"], SLIDE],
};
export const LINE_NO_KEYS_CARD: TeachCard = {
  title: "No more prompts",
  text: LINE_NO_KEYS,
  keys: [["J", "the tip dips"], ["K", "the hands rise"], ["L", "the arms go high"]],
};
export const BRAWL_CARD: TeachCard = {
  title: "Street fight",
  text: `Nobody's refereeing. They hit back, and that costs you health. ${BRAWL_HELP}.`,
  keys: [MOVE, ["J K L", "men, kote, do"], ["Space", "stomp with the strike"], ["S", "hold to block"], ["A D", "hold forward after a hit"]],
};

/** What someone going online hasn't been shown yet. Having been asked once is enough, whatever they said. */
export function primerNeeds(run: RunState, asked: boolean): ("opening" | "seme")[] {
  if (asked) return [];
  return [...(wasTaught(run, "openings") ? [] : (["opening"] as const)), ...(run.seme ? [] : (["seme"] as const))];
}

const taughtKey = (id: string) => `taught:${id}`;
export const wasTaught = (run: RunState, id: string): boolean => run.seen.includes(taughtKey(id));

/** Shows a card the first time something comes up in this save, and never again. */
export function teachOnce(game: Pick<Game, "run" | "audio" | "debug">, cards: TeachCards, id: string, card: TeachCard): void {
  if (wasTaught(game.run, id)) return;
  // A first match explains openings along with everything else, so only an older save needs its own card for them.
  const alongside = id === "firstMatch" && !wasTaught(game.run, "openings") ? [taughtKey("openings")] : [];
  game.run = { ...game.run, seen: [...game.run.seen, taughtKey(id), ...alongside] };
  cards.show(game, card);
}

/** Things a real match can spring on you. Each one stops the match at the moment it first happens. */
export type DuelMoment = "openings" | "firstMatch" | "tell" | "parry" | "lock" | "cross";

/** What's happening right now that might need explaining. The parry, the lock and crossing have a lesson, and anyone who's had it knows. */
export function duelMoments(duel: Pick<DuelState, "phase" | "fighters" | "options" | "events">, known: { waza: boolean; tellsShown: boolean }): DuelMoment[] {
  const moments: DuelMoment[] = [];
  if (duel.phase === "fight") moments.push("firstMatch", "openings");
  const them = duel.fighters[1];
  if (known.tellsShown && duel.phase === "fight" && (them.stance === "opening" || (them.stance === "windup" && them.attack))) moments.push("tell");
  if (!known.waza) {
    if (parryShine(duel, 1) > 0) moments.push("parry");
    if (duel.events.some((e) => e.type === "lock")) moments.push("lock");
    if (duel.events.some((e) => e.type === "cross")) moments.push("cross");
  }
  return moments;
}

export function momentCard(moment: DuelMoment, duel: Pick<DuelState, "fighters" | "crossed" | "options">): TeachCard {
  const toward = duel.crossed ? "A" : "D";
  const away = duel.crossed ? "D" : "A";
  const through: TeachKey = [toward, "hold to slide through"];
  switch (moment) {
    case "openings":
      return {
        title: "Openings",
        text: "Every strike now starts from an opening, and yours shows what's open. Any opening can lead to any strike, so what you show is real or it's bait. Plain guard is the only place ki comes back.",
        keys: [["W", "raise: shows your do"], ["Q", "wrist: shows your kote"], ["E", "drop: shows your men"], ["S", "cancel into a block or parry"]],
      };
    case "firstMatch":
      return {
        title: "Your first match",
        text: `First to ${duel.options.pointsToWin === 1 ? "one point" : "two points"} wins. For a point, open up, strike and stomp together, then slide through.`,
        keys: [["A D", "move"], ["W Q E, J K L", "open, then strike"], ["Space", "stomp with the strike"], ["S", "hold to block"], through],
      };
    case "tell": {
      const them = duel.fighters[1];
      const [key, name] = targetPrompt(exposedTargets(them)[0]).split(" ");
      return {
        title: "Read the tell",
        text: "Every strike starts from an opening, and what it shows is what's open. The box over them names the key that hits it, and its bar is how long you've got. It might only be bait.",
        keys: [strike(key, name), through],
      };
    }
    case "parry":
      return {
        title: "Parry",
        text: "When their tip shines, the strike's about to land. Tap S then, and it's knocked aside for free. Holding S is only a block.",
        keys: [["S", "tap as the tip shines"]],
      };
    case "lock":
      return {
        title: "Hilts locked",
        text: "Tsuba-zeriai. A push beats a held guard, a hold beats a pull back, and a pull back beats a push.",
        keys: [[toward, "hold to push"], ["S", "hold when their hands drop"], ["J K L", "pull back and cut"], [away, "step out"]],
      };
    case "cross":
      return {
        title: "You passed",
        text: "Ai-uchi: you swung together, so nobody scores. You're on their other side now, and the fight carries on from here.",
        keys: [[toward, "walk back in"]],
      };
  }
}

export const tipCard = (tip: string): TeachCard => ({ title: "Why that scored", text: tip, keys: [] });
