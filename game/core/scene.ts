import type { CharacterId } from "../characters.ts";
import type { GradingStage } from "../grading.ts";
import type { RunState } from "../run-state.ts";
import type { Session } from "../scenes/curriculum.ts";
import type { OpponentId } from "../world/dojos.ts";
import type { NodeId } from "../world/map.ts";
import type { Tournament } from "../world/tournament.ts";
import type { GameAudio } from "./audio.ts";
import type { Input } from "./input.ts";
import type { OnlineHub } from "../net/hub.ts";

export type SceneName = "art" | "title" | "character" | "club" | "training" | "line" | "kirikaeshi" | "map" | "travel" | "brawl" | "rival-dojo" | "duel" | "tournament" | "grading-hall" | "online" | "online-appearance" | "online-bracket" | "online-duel" | "online-lobby" | "online-history" | "dungeon";

export type Game = {
  input: Input;
  reducedMotion: boolean;
  run: RunState;
  audio: GameAudio;
  /** Read-only state published for development checks. */
  debug: Record<string, unknown>;
  /** Lines to show when the map opens, such as how a fight went. */
  message: string[] | null;
  /** Said after whatever the next scene was going to say. */
  after: string[];
  /** Somewhere you've chosen to walk to. The map takes you there. */
  autoTo: NodeId | null;
  /** You've just come back from a match, so you're still standing where you were. */
  fromFight: boolean;
  /** You've just been knocked out, so you come round by the front door. */
  wokeUp: boolean;
  /** Who the training scene should run next. */
  session: Session | null;
  /** Who the next match is against, when it isn't simply whoever waits at this place. */
  versus: OpponentId | null;
  /** The bracket being played, if any. */
  tournament: Tournament | null;
  /** Where the next ride is headed: a stop on the map, or to or from the grading hall. */
  ride: NodeId | "hall" | "fromHall" | null;
  /** Which part of getting a grade is under way, if any. */
  grading: GradingStage | null;
  /** The next line drill is helping the beginners, rather than your own practice. */
  helping: boolean;
  /** What you've put on the next match, already paid. */
  bet: number;
  /** Multiplayer, which has nothing to do with the story's state. */
  online: OnlineHub;
  go(scene: SceneName): void;
  /** Shows anything just earned straight away, even mid-conversation, and then carries on. */
  showCards(then: () => void): void;
  /** There's a saved game to pick up. */
  hasSave(): boolean;
  continueGame(): void;
  /** Erases any save and starts from the beginning, as this character. */
  newGame(character: CharacterId, name?: string): void;
};

export type Scene = {
  /** Keys should be read as text for now, rather than as controls. */
  typing?(): boolean;
  enter?(game: Game): void;
  leave?(game: Game): void;
  /** What the pause menu calls giving up on this, or null if there's nothing to give up on right now. */
  forfeitLabel?(game: Game): string | null;
  forfeit?(game: Game): void;
  /** Not part of any story, so there's no progress to show or game to restart from here. */
  outsideStory?(game: Game): boolean;
  /** True while something's mid-flow here, like a conversation, and a new item should wait its turn. */
  busy?(game: Game): boolean;
  /** Real people are waiting on this, so it keeps going behind the pause menu and when the tab loses focus. */
  keepsRunning?(game: Game): boolean;
  /** One tick while the pause menu's open, when `keepsRunning` says so. */
  liveTick?(game: Game): void;
  /** There's no pausing here at all, because something could happen at any moment. */
  neverPauses?(game: Game): boolean;
  update(game: Game): void;
  render(ctx: CanvasRenderingContext2D, game: Game): void;
};
