import type { Game } from "../core/scene.ts";
import { moneyText } from "../money.ts";
import type { RunState } from "../run-state.ts";
import { AFTER_WINS, PEOPLE, WAKE_UP } from "./chatter-lines.ts";
import type { ChoiceOption, Menu } from "./choice.ts";
import { MENU_ADVICE, MENU_CHAT, MENU_LEAVE, MENU_NEWS } from "./content.ts";
import type { Dialogue } from "./dialogue.ts";

export type Topic = "news" | "chat" | "advice";
export const isTopic = (id: string): id is Topic => id === "news" || id === "chat" || id === "advice";

/** What you can bring up with anyone. */
export const TOPICS: ChoiceOption<Topic>[] = [
  { id: "news", label: MENU_NEWS },
  { id: "chat", label: MENU_CHAT },
  { id: "advice", label: MENU_ADVICE },
];

const saidKey = (who: string, id: string) => `said:${who}:${id}`;

/** The next line in a list that goes round, so all of it gets said before any of it's said again. */
function nextInTurn(run: RunState, key: string, lines: string[]): { run: RunState; line: string } {
  const turn = run.talked[key] ?? 0;
  return { run: { ...run, talked: { ...run.talked, [key]: turn + 1 } }, line: lines[turn % lines.length] };
}

/**
 * What someone says when you bring something up. News is whatever's on their mind about what you've done,
 * and each thing only gets said once. When there's nothing new, they just talk, and they don't repeat themselves.
 */
export function talkAbout(run: RunState, who: string, topic: Topic): { run: RunState; lines: string[] } {
  const person = PEOPLE[who];
  if (topic === "news") {
    // If they've got your money, that comes first, and it stays true until you've dealt with it.
    const held = run.held[who] ?? 0;
    if (held > 0) return { run, lines: [`${person.name}: I've still got your ${moneyText(held)}. Beat me, and it's yours.`] };
    const reaction = person.news.find((item) => item.when(run) && !run.seen.includes(saidKey(who, item.id)));
    if (reaction) return { run: { ...run, seen: [...run.seen, saidKey(who, reaction.id)] }, lines: [reaction.line] };
  }
  const list = topic === "advice" ? person.advice : person.small;
  const next = nextInTurn(run, `${who}:${topic === "advice" ? "advice" : "chat"}`, list);
  return { run: next.run, lines: [next.line] };
}

/** Talking with someone: pick a subject, hear them out, and pick another until you've had enough. */
export function openTopics(game: Game, menu: Menu, dialogue: Dialogue, who: string): void {
  menu.open([...TOPICS, { id: "leave", label: MENU_LEAVE }], (id) => {
    if (!isTopic(id)) return;
    const reply = talkAbout(game.run, who, id);
    game.run = reply.run;
    dialogue.open(reply.lines, () => openTopics(game, menu, dialogue, who));
  });
}

/** What a dojo's head says right after you've beaten them, with you still standing on their floor. */
export function afterWinLines(run: RunState, head: string, firstWin: boolean, narration: string): { run: RunState; lines: string[] } {
  const after = AFTER_WINS[head];
  if (firstWin) return { run, lines: [narration, ...after.first] };
  const next = nextInTurn(run, `${head}:after`, after.again);
  return { run: next.run, lines: [narration, next.line] };
}

/** Coming round at home. The more often it's happened, the less impressed anyone is. */
export function wakeUpLines(run: RunState, taken: number, holder: string): { run: RunState; lines: string[] } {
  const turn = run.talked.wake ?? 0;
  const lines = WAKE_UP[Math.min(turn, WAKE_UP.length - 1)];
  const money = taken > 0
    ? `You're ${moneyText(taken)} lighter. ${holder[0].toUpperCase()}${holder.slice(1)} kept it. Win that fight, and you'll get it back.`
    : "Your purse was empty, so at least nobody took anything.";
  return { run: { ...run, talked: { ...run.talked, wake: turn + 1 } }, lines: [...lines, money] };
}

/** Everything anyone might say, for the checks that every line fits and can be drawn. */
export const allChatterLines = (): string[] => [
  ...Object.values(PEOPLE).flatMap((person) => [...person.news.map((item) => item.line), ...person.small, ...person.advice]),
  ...Object.values(AFTER_WINS).flatMap((after) => [...after.first, ...after.again]),
  ...WAKE_UP.flat(),
];
