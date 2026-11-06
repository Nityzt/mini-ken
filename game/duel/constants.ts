// Every number that sets how a duel feels. Tuned by playing, at the owner's checkpoint.
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

export const RECOVERY_TICKS = 26;
export const BROKEN_TICKS = 50;
export const LOW_KI_SLOWDOWN = 1.3;
export const LOW_KI_WALK = 0.75;

// Fumikomi: the stomp must land this close before the strike does.
export const STOMP_WINDOW = 14;
// Zanshin: after a hit, slide all the way past the opponent within the window.
export const ZANSHIN_WINDOW = 60;
export const ZANSHIN_PASS = 28;
export const ZANSHIN_SLIDE = 3;
export const ZANSHIN_EDGE_MIN = 6;
export const ZANSHIN_EDGE_MAX = 250;

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
// After a point, both walk back to their lines. There's no other wait: the next point starts when they get there.
export const RETURN_WALK = 1.8;
export const RETURN_SETTLE = 12;
export const RETURN_KI_RATE = 0.06;
// Sonkyo, sheathe, rise, step back, bow, and go.
export const CLOSING_TICKS = 190;

// Parry (suriage): a tap just before a strike lands. Mistiming it leaves you waiting to try again.
export const PARRY_WINDOW = 10;
export const PARRY_COOLDOWN = 40;
export const PARRY_KI = 8;
export const DEFLECT_TICKS = 34;
export const DEFLECT_KI_LOSS = 8;
export const COUNTER_TICKS = 30;
export const COUNTER_WINDUP = 4;

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
export const HIKI_WINDUP = 4;
export const HIKI_STEP_TICKS = 4;
export const ZANSHIN_HIKI = 24;

// Ai-uchi: both commit at once, nobody lands anything, and they pass each other and fight on from there.
/** How close their strike has to be for one landing on an open target to count as both at once. */
export const CROSS_CLEAN_WINDOW = 3;
/** And for one landing on a covered target, where you've both simply gone for it. */
export const CROSS_WRONG_WINDOW = 14;
/** A quick strike is someone going for it right then, so anything arriving around it gets caught up in it, whatever it was aimed at. */
export const CROSS_QUICK_WINDOW = 11;
export const CROSS_SPEED = 3;
export const CROSS_GAP = 54;
export const CROSS_SETTLE = 14;
