import test from "node:test";
import assert from "node:assert/strict";
import { ceremonyAt, closingAt, poseFor, windupCoil, COIL_TICKS } from "./poses.ts";
import { BOW_TICKS, CLOSING_TICKS } from "./constants.ts";
import { blendPose, DUEL_GRIDS, POSES, shinaiTip, type DuelPose } from "../art/duel-sprites.ts";
import type { AttackKind, Fighter, Stance } from "./rules.ts";

const fighter = (stance: Stance, attack: AttackKind | null = null): Fighter => ({
  kamae: "chudan",
  x: 100, ki: 100, kiMax: 100, stance, stanceTicks: 5, attack, points: 0, stompAge: 9999, launchTicks: 0, launchDir: 0, pressure: 0, kiaiTicks: 0, parryCooldown: 0, counterTicks: 0, hiki: false, opening: null, openingTicks: 0, queued: null, countering: false, reparryTicks: 0, reparryUsed: false,
});
const fight = { phase: "fight" as const, striking: null, scored: false };

test("each tell shows the pose the player learns to read", () => {
  assert.equal(poseFor(fighter("windup", "men"), fight), "tellHandsUp");
  assert.equal(poseFor(fighter("windup", "quickMen"), fight), "tellHandsUp");
  assert.equal(poseFor(fighter("windup", "kote"), fight), "tellTipDip");
  // A do strike leaves the men open, just as a kote strike does, so it has the same tell.
  assert.equal(poseFor(fighter("windup", "do"), fight), "tellTipDip");
  assert.equal(poseFor(fighter("windup", "bigMen"), fight), "tellBigRaise");
});

test("the basic stances have their own poses", () => {
  assert.equal(poseFor(fighter("guard"), fight), "guard");
  assert.equal(poseFor(fighter("block"), fight), "block");
  assert.equal(poseFor(fighter("recovery"), fight), "recover");
  assert.equal(poseFor(fighter("broken"), fight), "stunned");
});

test("a landing strike shows its target", () => {
  assert.equal(poseFor(fighter("recovery"), { ...fight, striking: "men" }), "strikeMen");
  assert.equal(poseFor(fighter("recovery"), { ...fight, striking: "kote" }), "strikeKote");
  assert.equal(poseFor(fighter("recovery"), { ...fight, striking: "do" }), "strikeDo");
});

test("walking back after a point, the shinai comes down, and it's guard again at the line", () => {
  assert.equal(poseFor(fighter("guard"), { phase: "point", striking: null, scored: true, walkingHome: true }), "walkHome");
  assert.equal(poseFor(fighter("guard"), { phase: "point", striking: null, scored: false, walkingHome: true }), "walkHome");
  assert.equal(poseFor(fighter("guard"), { phase: "point", striking: null, scored: true, walkingHome: false }), "guard");
});

test("the striker holds zanshin while sliding through", () => {
  assert.equal(poseFor(fighter("guard"), { phase: "zanshin", striking: null, scored: true }), "zanshin");
  assert.equal(poseFor(fighter("guard"), { phase: "zanshin", striking: null, scored: false }), "guard");
});

test("powering up and flinching have their own poses", () => {
  assert.equal(poseFor(fighter("seme"), fight), "seme");
  assert.equal(poseFor(fighter("shaken"), fight), "stunned");
});

test("a launching fighter shows the launch", () => {
  assert.equal(poseFor({ ...fighter("guard"), launchTicks: 5 }, fight), "launch");
});

test("the opening ceremony runs in the real order", () => {
  const order: string[] = [];
  for (let left = BOW_TICKS; left >= 1; left--) {
    const { pose } = ceremonyAt(left);
    if (order[order.length - 1] !== pose) order.push(pose);
  }
  assert.deepEqual(order, ["sageto", "bow", "sageto", "taito", "draw", "sonkyo", "guard"]);
});

test("the three steps forward come before the draw and finish by sonkyo", () => {
  assert.ok(ceremonyAt(BOW_TICKS).stepBack > 0);
  for (let left = BOW_TICKS; left > 1; left--) {
    assert.ok(ceremonyAt(left - 1).stepBack <= ceremonyAt(left).stepBack);
    if (ceremonyAt(left).pose === "sonkyo") assert.equal(ceremonyAt(left).stepBack, 0);
  }
});

test("the ceremony shows through poseFor", () => {
  assert.equal(poseFor(fighter("guard"), { phase: "bow", striking: null, scored: false, bowTicksLeft: BOW_TICKS }), "sageto");
});

test("the shinai stays in the left hand until it's drawn", () => {
  for (const pose of ["sageto", "bow", "taito"] as const) assert.equal(POSES[pose].sheathed, true, pose);
  for (const pose of ["draw", "sonkyo", "guard"] as const) assert.ok(!POSES[pose].sheathed, pose);
});

test("sonkyo crouches lower than standing", () => {
  assert.ok((POSES.sonkyo.head?.[1] ?? 0) >= 6);
  assert.equal(POSES.sonkyo.legs, "sonkyo");
});

test("both fighters bow at the start, and have gone by the end with the shinai at their side", () => {
  assert.equal(poseFor(fighter("guard"), { phase: "bow", striking: null, scored: false }), "bow");
  assert.equal(poseFor(fighter("guard"), { phase: "over", striking: null, scored: true }), "taitoFree");
});

test("the closing ceremony runs in the real order: sonkyo, sheathe, rise, step back, bow, leave", () => {
  const order: string[] = [];
  for (let left = CLOSING_TICKS; left >= 1; left--) {
    const { pose } = closingAt(left);
    if (order[order.length - 1] !== pose) order.push(pose);
  }
  assert.deepEqual(order, ["guard", "sonkyo", "sonkyoTurn", "sonkyoTuck", "sonkyoSheathe", "taitoFree", "bowTaito", "taitoFree"]);
});

test("the shinai is sheathed while still in sonkyo, and nobody moves until they've risen", () => {
  assert.equal(POSES.sonkyoSheathe.legs, "sonkyo");
  assert.equal(POSES.sonkyoSheathe.sheathed, true);
  for (let left = CLOSING_TICKS; left >= 1; left--) {
    const { pose, stepBack } = closingAt(left);
    if (POSES[pose].legs === "sonkyo" || pose === "guard") assert.equal(stepBack, 0, pose);
  }
});

test("they step back before the bow, never forward, and only walk away after it", () => {
  let bowed = false;
  let last = 0;
  for (let left = CLOSING_TICKS; left >= 1; left--) {
    const at = closingAt(left);
    assert.ok(at.stepBack >= last, "only ever further back");
    last = at.stepBack;
    if (at.pose === "bowTaito") {
      bowed = true;
      assert.ok(at.stepBack > 0, "stepped back first");
      assert.equal(at.walking, false, "stands still to bow");
    }
    assert.equal(at.away, bowed && at.pose === "taitoFree" && at.walking, `at ${left}`);
  }
  assert.ok(bowed);
  assert.equal(closingAt(1).away, true, "ends walking away");
});

test("the closing ceremony shows through poseFor", () => {
  assert.equal(poseFor(fighter("guard"), { phase: "closing", striking: null, scored: false, closingTicksLeft: CLOSING_TICKS }), "guard");
  assert.equal(poseFor(fighter("guard"), { phase: "closing", striking: null, scored: false, closingTicksLeft: 1 }), "taitoFree");
});

// The first row of the legs that shows: sonkyo's thighs are drawn level, over the waist.
const THIGH_CROUCHED = 34;
const THIGH_STANDING = 28;
const LEG_GRIDS: Record<string, string[]> = { sonkyo: DUEL_GRIDS.duelLegsSonkyo, sink: DUEL_GRIDS.duelLegsSink ?? [] };
const WAIST_BOTTOM = 27;
const LEGS_TOP = 28;

test("going down into sonkyo and rising from it, the body never floats above the legs", () => {
  const moves: [DuelPose, DuelPose][] = [["guard", "sonkyo"], ["draw", "sonkyo"], ["sonkyo", "guard"], ["sonkyoSheathe", "taitoFree"]];
  for (const [from, to] of moves) {
    for (let t = 0; t <= 1; t += 1 / 24) {
      const blended = blendPose(POSES[from], POSES[to], t);
      const rows = LEG_GRIDS[blended.legs ?? ""] ?? DUEL_GRIDS.duelLegsStand;
      const firstRow = rows.findIndex((row) => row.replace(/\./g, "") !== "");
      const bottom = WAIST_BOTTOM + (blended.torso?.[1] ?? 0);
      assert.ok(bottom + 1 >= LEGS_TOP + firstRow, `${from} to ${to} at ${t.toFixed(2)}: waist ends at ${bottom}, legs start at ${LEGS_TOP + firstRow}`);
    }
  }
});

test("the legs bend in stages on the way down and on the way up", () => {
  const legsAlong = (from: DuelPose, to: DuelPose) => {
    const seen: string[] = [];
    for (let t = 0; t <= 1; t += 1 / 24) {
      const legs = blendPose(POSES[from], POSES[to], t).legs ?? "standing";
      if (seen[seen.length - 1] !== legs) seen.push(legs);
    }
    return seen;
  };
  assert.deepEqual(legsAlong("guard", "sonkyo"), ["standing", "sink", "sonkyo"]);
  assert.deepEqual(legsAlong("sonkyoSheathe", "taitoFree"), ["sonkyo", "sink", "standing"]);
});

const CLOSING_HOLD = ["sonkyoTuck", "sonkyoSheathe", "taitoFree", "bowTaito"] as const;

test("sheathing, the shinai swings over the top to behind the body, not back through it", () => {
  const path = [POSES.sonkyo.angle, POSES.sonkyoTurn.angle, POSES.sonkyoTuck.angle];
  assert.ok(path[0] > path[1] && path[1] > path[2], "one way round");
  assert.ok(path[1] <= -90, "up past upright");
  assert.ok(path[2] < -180, "and on over, past flat behind");
});

test("sheathing, the shinai goes over on the left side, and the right hand stays on the grip until it's there", () => {
  const { hand, angle, handBelowTsuba = 0, rightHand } = POSES.sonkyoTuck;
  const radians = (angle * Math.PI) / 180;
  const along = (i: number) => [hand[0] + Math.cos(radians) * (i - handBelowTsuba), hand[1] + Math.sin(radians) * (i - handBelowTsuba)];
  assert.ok(POSES.sonkyoTurn.sheathed && POSES.sonkyoTuck.sheathed, "the far side");
  assert.ok(rightHand, "held by both");
  const near = Math.min(...[-1, -2, -3, -4, -5, -6].map((i) => Math.hypot(along(i)[0] - rightHand[0], along(i)[1] - rightHand[1])));
  assert.ok(near <= 1.5, `the right hand is ${near} from the grip`);
});

test("once sheathed, the right hand rests on the thigh and the left holds on under the tsuba", () => {
  for (const pose of ["sonkyoSheathe", "taitoFree", "bowTaito"] as const) {
    const { hand, rightHand, torso, handBelowTsuba = 0 } = POSES[pose];
    assert.ok(rightHand, pose);
    assert.ok(rightHand[1] >= (POSES[pose].legs === "sonkyo" ? THIGH_CROUCHED : THIGH_STANDING), `${pose}: on the thigh`);
    assert.ok(handBelowTsuba >= 3, `${pose}: the hand's clear of the tsuba`);
    assert.ok(Math.abs(hand[1] - ((torso?.[1] ?? 0) + 22)) <= 3, `${pose}: at the waist`);
  }
});

test("standing, the shinai is held at 45 degrees with the tip behind them and towards the ground", () => {
  for (const pose of ["taitoFree", "bowTaito"] as const) {
    const radians = (POSES[pose].angle * Math.PI) / 180;
    assert.ok(Math.cos(radians) < 0, `${pose}: behind`);
    assert.ok(Math.sin(radians) > 0, `${pose}: down`);
    assert.ok(Math.abs(Math.cos(radians) + Math.sin(radians)) < 0.01, `${pose}: at 45 degrees`);
  }
});

test("the tip never goes through the floor, crouched or standing", () => {
  const GROUND = 100;
  for (const pose of CLOSING_HOLD) assert.ok(shinaiTip(50, GROUND, pose, false)[1] < GROUND, pose);
});

test("from the moment it's sheathed to walking out, the shinai stays at the waist with the right hand free", () => {
  let sheathed = false;
  for (let left = CLOSING_TICKS; left >= 1; left--) {
    const { pose } = closingAt(left);
    if (pose === "sonkyoSheathe") sheathed = true;
    if (sheathed) assert.ok(POSES[pose].rightHand && POSES[pose].handBelowTsuba, `${left}: ${pose}`);
  }
  assert.ok(sheathed);
});

test("new stances have their own poses", () => {
  assert.equal(poseFor(fighter("parry"), fight), "parry");
  assert.equal(poseFor(fighter("deflected"), fight), "deflected");
  assert.equal(poseFor(fighter("stumble"), fight), "stumble");
  assert.equal(poseFor(fighter("tsuba"), { ...fight, tsuba: "hold" }), "tsuba");
  assert.equal(poseFor(fighter("tsuba"), { ...fight, tsuba: "push" }), "tsubaPush");
  assert.equal(poseFor(fighter("tsuba"), { ...fight, tsuba: "guard" }), "tsubaGuard");
  assert.equal(poseFor(fighter("tsuba"), { ...fight, tsuba: "pull" }), "tsubaPull");
});

test("a strike pulled back from the lock looks different from one going forward", () => {
  assert.equal(poseFor(fighter("recovery"), { ...fight, striking: "men", hiki: true }), "hikiMen");
  assert.equal(poseFor(fighter("recovery"), { ...fight, striking: "kote", hiki: true }), "hikiKote");
  assert.equal(poseFor(fighter("recovery"), { ...fight, striking: "do", hiki: true }), "hikiDo");
});

test("a reaction, like being hit, shows over whatever the stance would", () => {
  assert.equal(poseFor(fighter("guard"), { ...fight, reaction: "hit" }), "hit");
  assert.equal(poseFor(fighter("guard"), { phase: "zanshin", striking: null, scored: false, reaction: "hit" }), "hit");
  assert.equal(poseFor(fighter("guard"), { ...fight, reaction: "suriage" }), "suriage");
});

test("only the first shows while striking, so a landing strike is never hidden", () => {
  assert.equal(poseFor(fighter("guard"), { ...fight, striking: "men", reaction: "hit" }), "strikeMen");
});

test("passing through looks like carrying on, and they come back to guard as they turn", () => {
  assert.equal(poseFor(fighter("guard"), { phase: "crossing", striking: null, scored: false }), "zanshin");
  assert.equal(poseFor(fighter("guard"), { phase: "turning", striking: null, scored: false }), "guard");
});

// What real kendo looks like, from watching two 7th dan frame by frame.
test("zanshin carries the hands up over the head, because they go straight back up after the cut", () => {
  assert.ok(POSES.zanshin.hand[1] <= 4, "the hands are up at the top of the head");
  assert.ok(POSES.zanshin.angle < -90, "the blade's past upright");
});

test("taking a hit doesn't collapse anyone: the hands stay up and the body stays put", () => {
  assert.ok(POSES.hit.hand[1] <= POSES.guard.hand[1], "the hands don't drop");
  assert.ok(Math.abs(POSES.hit.torso?.[0] ?? 0) <= 1, "the body doesn't reel");
});

test("in a lock the hands are at the chest with the blades upright, and the pull still gives itself away", () => {
  for (const pose of ["tsuba", "tsubaPush", "tsubaGuard"] as const) {
    assert.ok(POSES[pose].hand[1] <= 21, pose);
    assert.ok(Math.abs(POSES[pose].angle + 90) <= 15, pose);
  }
  assert.ok(POSES.tsubaPull.hand[1] - POSES.tsuba.hand[1] >= 6, "the hands drop for a pull, which is the tell");
});

test("parting from a lock keeps the tip up, on its way down to guard", () => {
  assert.equal(poseFor(fighter("guard"), { phase: "wakare", striking: null, scored: false }), "tsubaPart");
  assert.ok(POSES.tsubaPart.angle < POSES.guard.angle - 20);
  assert.ok(POSES.tsubaPart.angle > POSES.tsuba.angle);
});

test("the draw brings the blade up high, before it comes down into sonkyo", () => {
  assert.ok(POSES.draw.angle < POSES.sonkyo.angle - 20);
});

const coilDuel = (stance: Stance, stanceTicks: number, hiki = false, phase: "fight" | "point" = "fight") => {
  const f = { ...fighter(stance, "men"), stanceTicks, hiki };
  return { phase, fighters: [fighter("guard"), f] as [Fighter, Fighter] };
};

test("a strike gathers itself over its last moments, whatever the tell", () => {
  assert.equal(windupCoil(coilDuel("windup", COIL_TICKS + 1), 1), 0);
  let last = 0;
  for (let left = COIL_TICKS; left >= 1; left--) {
    const coil = windupCoil(coilDuel("windup", left), 1);
    assert.ok(coil > last, `${left} ticks left`);
    last = coil;
  }
  assert.equal(last, 1);
});

test("nothing else gathers: not standing, not a pull out of a lock, not outside the fight", () => {
  assert.equal(windupCoil(coilDuel("guard", 5), 1), 0);
  assert.equal(windupCoil(coilDuel("windup", 3, true), 1), 0);
  assert.equal(windupCoil(coilDuel("windup", 3, false, "point"), 1), 0);
});
