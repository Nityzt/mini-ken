// Every number that sets how a duel feels. Tuned by playing, at the owner's checkpoint.

// Tempo: the game runs 60 frames a second, and a duel's rules only move on this many of every this many frames.
// So every tick below lasts 25ms rather than 16.7ms, and everything keeps its proportions. It's counted in the
// rules, so both players of an online match stay in step.
export const TEMPO_TICKS = 2;
export const TEMPO_FRAMES = 3;

export const RING_MIN = 24;
export const RING_MAX = 232;
export const START_DISTANCE = 90;
export const MIN_DISTANCE = 12;
export const RANGE_MIN = 18;
export const RANGE_MAX = 48;
export const LOCK_DISTANCE = 34;
export const WALK = 1.1;

export const KI_MAX = 100;
export const TSUBA_KI_MAX = 125;
export const KI_LOW = 30;
export const SWING_COST = 14;
export const ABSORB_COST = 25;
export const KI_RECOVERY = 0.25;
export const KI_AFTER_BREAK = 35;

// Long enough that someone in plain guard can see a miss, open up and punish it: a reaction, plus the opening, plus the strike.
export const RECOVERY_TICKS = 38;
/** Street fights run at full speed on their own rules, and a miss there costs what it always has. */
export const BRAWL_RECOVERY_TICKS = 26;
export const BROKEN_TICKS = 50;
export const LOW_KI_SLOWDOWN = 1.3;
export const LOW_KI_WALK = 0.75;

// Openings: every ordinary strike starts from one, which shows a target and says nothing about what's coming.
/** How long a new opening has to be held before a strike can start from it. */
export const OPENING_MIN = 10;
export const OPENING_START_KI = 10;
/** A held block costs a little even when nothing hits it, so nobody can sit behind one for ever. */
export const BLOCK_DRAIN = 0.1;

// Fumikomi: the stomp must land this close before the strike does. It has to cover the shortest opening and the slowest usual strike, since the stomp can start them both.
export const STOMP_WINDOW = 28;
/** Kirikaeshi and street fights run at full speed, not on a duel's tempo, so they keep the tighter stomp. */
export const DRILL_STOMP_WINDOW = 14;
// Zanshin: after a hit, slide all the way past the opponent within the window.
export const ZANSHIN_WINDOW = 60;
export const ZANSHIN_PASS = 28;
export const ZANSHIN_SLIDE = 3;
export const ZANSHIN_EDGE_MIN = 6;
export const ZANSHIN_EDGE_MAX = 250;
/** The flag goes up about as the striker gets past them, counting the tick of the hit. The point still isn't settled until the slide's done. */
export const FLAG_AFTER_HIT = 12;

// Launch: the rear foot drives a long forward (or backward) move.
export const LAUNCH_TICKS = 14;
export const LAUNCH_SPEED = 4;
export const LAUNCH_COST = 10;

// Seme: hold to press the opponent with your spirit, spending ki.
export const SEME_DRAIN = 0.5;
export const SEME_START_KI = 10;
export const SEME_TICKS = 150;
export const SEME_DECAY = 0.5;
export const SEME_RANGE = 90;
export const SHAKEN_TICKS = 45;
export const SHAKEN_KI_LOSS = 15;
export const BRAWL_SEME_TICKS = 90;
export const COWER_TICKS = 70;

// Kiai: the shout that goes with seme. It pushes hard, costs ki, and needs a breath between.
export const KIAI_COST = 12;
export const KIAI_PRESS = 40;
export const KIAI_COOLDOWN = 50;
export const BRAWL_KIAI_PRESS = 25;

export const BOW_TICKS = 150;
export const POINTS_TO_WIN = 2;
// The whole match has two minutes of fighting, at 25ms a tick.
export const MATCH_TICKS = 4800;
// After a point, both walk back to their lines. There's no other wait: the next point starts when they get there.
export const RETURN_WALK = 1.8;
export const RETURN_SETTLE = 30;
export const RETURN_KI_RATE = 0.06;
// Sonkyo, sheathe, rise, step back, bow, and go.
export const CLOSING_TICKS = 230;

// Parry (suriage): a tap just before a strike lands. Mistiming it leaves you waiting to try again.
export const PARRY_WINDOW = 10;
export const PARRY_COOLDOWN = 40;
export const PARRY_KI = 8;
export const DEFLECT_TICKS = 34;
export const DEFLECT_KI_LOSS = 8;
export const COUNTER_TICKS = 30;
export const COUNTER_WINDUP = 6;
/** A counter drives in as it goes: this many ticks at launch speed. */
export const COUNTER_DRIVE_TICKS = 2;
/** Parrying a counter is a read, not a reaction: the window's shorter than the counter itself. Only one try, and missing it costs. */
/** A tap's window runs out on the same tick as a strike this far off, as with a parry, so the latest tap is one less. */
export const REPARRY_WINDOW = 5;
export const REPARRY_MISS = 14;
/** A first parry from this close has no room for a counter, which drives in about 8, so the two bind. */
export const PARRY_LOCK_WITHIN = 26;
/** And a second parry, since the counter has driven them closer. */
export const REPARRY_LOCK_WITHIN = 32;
/** How long before a strike lands their tip starts to shine. The shine has to lead the window by a reaction: at the duel's tempo, tapping 225 to 425ms after it appears works. */
export const PARRY_SHINE_LEAD = 17;
/** The most ticks a strike can have left for a tap to parry it. A tap's window runs out on the same tick as a strike this far off, hence the one less. */
export const PARRY_LATEST_TAP = PARRY_WINDOW - 1;

// Tsuba-zeriai: locked hilt to hilt. Push beats a held guard, a held guard beats a hiki strike, and a hiki strike beats a push.
export const TSUBA_ENTER = 18;
export const TSUBA_CARRY = 28;
export const TSUBA_GAP = 18;
export const TSUBA_CLOSE_SPEED = 2;
export const TSUBA_DRIFT = 0.3;
export const TSUBA_BREAK = 50;
export const TSUBA_PUSH_COST = 0.15;
export const TSUBA_TICKS = 210;
export const TSUBA_WAKARE_GAP = 56;
export const TAIATARI_BALANCE = 18;
export const SHOVE_TICKS = 5;
export const STUMBLE_TICKS = 40;
export const HIKI_TELL = 14;
export const HIKI_WINDUP = 6;
export const HIKI_STEP_TICKS = 4;
export const ZANSHIN_HIKI = 24;

// Ai-uchi: both commit at once, nobody lands anything, and they pass each other and fight on from there.
/** How close their strike has to be for one landing on an open target to count as both at once. */
export const CROSS_CLEAN_WINDOW = 3;
/** And for one landing on a covered target, where you've both simply gone for it. */
export const CROSS_WRONG_WINDOW = 14;
/** A quick strike is someone going for it right then, so anything arriving around it gets caught up in it, whatever it was aimed at. */
export const CROSS_QUICK_WINDOW = 15;
/** Cuts meeting this close bind and close hilt to hilt instead of passing. Rivals stand further off than this, so it's stepping in that makes it happen. */
export const CROSS_LOCK_WITHIN = 32;
export const CROSS_SPEED = 3;
export const CROSS_GAP = 54;
export const CROSS_SETTLE = 24;

// Impact freeze: everything holds for this many frames on contact, so you can see what just happened. Bigger moments hold longer.
export const FREEZE_HIT = 16;
export const FREEZE_BREAK = 16;
export const FREEZE_PARRY = 12;
export const FREEZE_CROSS = 10;
export const FREEZE_AIUCHI = 10;
export const FREEZE_SHOVE = 8;
export const FREEZE_LOCK = 8;
export const FREEZE_SHAKEN = 8;
export const FREEZE_BLOCK = 6;
