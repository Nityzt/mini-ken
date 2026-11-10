import test from "node:test";
import assert from "node:assert/strict";
import {
  createDungeon, stepDungeon, parseDungeonState, trapPhase, maxHp, solidPlatforms,
  DUNGEON_ROOMS, FINAL_ROOM, PLAYER_H, PLAYER_W, BASE_HP, CRUMBLE_TICKS, SCRAP_FOR_ARMOR,
  type DungeonState, type DungeonInput,
} from "./dungeon.ts";

const idle: DungeonInput = { move: 0 };
const ticks = (state: DungeonState, count: number, input: DungeonInput = idle): DungeonState => {
  for (let i = 0; i < count; i++) state = stepDungeon(state, input);
  return state;
};
/** A room with nobody in it, for testing movement alone. */
const empty = (room: number, progress: Parameters<typeof createDungeon>[1] = {}): DungeonState => {
  const state = createDungeon(room, { shinai: true, ...progress });
  state.enemies = state.enemies.map((enemy) => ({ ...enemy, hp: 0, state: "down" }));
  return state;
};
const at = (state: DungeonState, x: number, top: number): DungeonState => {
  state.player.x = x;
  state.player.y = top - PLAYER_H;
  return state;
};

test("the cell starts you with nothing, and a step never changes the state it was given", () => {
  const state = createDungeon();
  const snapshot = structuredClone(state);
  const next = stepDungeon(state, { move: 1 });
  assert.deepEqual(state, snapshot);
  assert.ok(next.player.x > state.player.x);
  assert.equal(state.shinai, false);
  assert.deepEqual(state.pieces, []);
  assert.equal(state.player.hp, BASE_HP);
});

test("a storey can't be jumped, only caught and climbed by holding up", () => {
  const block = DUNGEON_ROOMS[0].platforms[2];
  // Jumping without holding up bumps against the block and comes back down.
  let state = at(empty(0), block.x - PLAYER_W, 120);
  state.player.facing = 1;
  state = stepDungeon(state, { move: 1, jump: true });
  state = ticks(state, 40, { move: 1 });
  assert.equal(state.player.y + PLAYER_H, 120);
  // Holding up catches the edge, hangs a moment, then pulls you up on top.
  state = stepDungeon(state, { move: 1, jump: true, up: true });
  let grabbed = false;
  for (let i = 0; i < 60; i++) {
    state = stepDungeon(state, { move: 0, up: true });
    grabbed ||= !!state.player.ledge;
  }
  assert.ok(grabbed, "hung from the ledge on the way");
  assert.equal(state.player.ledge, null);
  assert.equal(state.player.y + PLAYER_H, block.y, "standing on top");
  assert.ok(state.player.x >= block.x && state.player.x + PLAYER_W <= block.x + block.w);
});

test("letting go of a ledge drops you, and falling short of a pit's far side can still be saved", () => {
  let state = at(empty(0), 200 - 4, 120);
  state.player.facing = 1;
  state = ticks(state, 30, { move: 1, up: false });
  assert.equal(state.phase, "dead", "walking into the pit is a fall");
  // Falling short of the far side, up held catches its edge.
  const short = () => {
    const falling = at(empty(0), 222, 118);
    falling.player.grounded = false;
    falling.player.vy = 1;
    falling.player.facing = 1;
    return falling;
  };
  let saver = short();
  for (let i = 0; i < 40 && !saver.player.ledge; i++) saver = stepDungeon(saver, { move: 1, up: true });
  assert.ok(saver.player.ledge, "caught the far edge");
  saver = ticks(saver, 40, { move: 0, up: true });
  assert.equal(saver.phase, "playing");
  assert.equal(saver.player.y + PLAYER_H, 120);
  assert.ok(saver.player.x >= 236);
  let dropper = short();
  for (let i = 0; i < 40 && !dropper.player.ledge; i++) dropper = stepDungeon(dropper, { move: 1, up: true });
  assert.ok(dropper.player.ledge);
  dropper = ticks(dropper, 60, { move: 0, block: true });
  assert.equal(dropper.phase, "dead");
});

test("a running jump clears the cell's pit", () => {
  let state = at(empty(0), 150, 120);
  state = ticks(state, 20, { move: 1 });
  while (state.player.x < 186) state = stepDungeon(state, { move: 1 });
  state = stepDungeon(state, { move: 1, jump: true });
  state = ticks(state, 40, { move: 1 });
  assert.equal(state.phase, "playing");
  assert.ok(state.player.x > 236);
});

test("a jump pressed a moment late, after running off an edge, still counts", () => {
  let state = at(empty(0), 186, 120);
  state.player.vx = 1.7;
  state = ticks(state, 10, { move: 1 });
  assert.equal(state.player.grounded, false);
  const jumped = stepDungeon(state, { move: 1, jump: true });
  assert.ok(jumped.events.some((event) => event.type === "jump"));
});

test("a loose slab shakes, then falls, and comes back on a retry", () => {
  const slab = DUNGEON_ROOMS[1].platforms.find((platform) => platform.loose)!;
  let state = at(empty(1), slab.x + 12, 120);
  state = stepDungeon(state, idle);
  assert.ok(state.events.some((event) => event.type === "crumble"));
  state = ticks(state, CRUMBLE_TICKS - 3);
  assert.equal(state.player.grounded, true, "it holds while it shakes");
  state = ticks(state, 40);
  assert.equal(state.phase, "dead");
  assert.ok(!solidPlatforms(state).includes(slab));
  state = stepDungeon(state, { move: 0, retry: true });
  assert.ok(solidPlatforms(state).includes(slab));
  // Running straight over it is safe.
  let runner = at(empty(1), slab.x - 40, 120);
  runner = ticks(runner, 70, { move: 1 });
  assert.equal(runner.phase, "playing");
  assert.ok(runner.player.x > slab.x + slab.w);
});

test("spikes rattle before they rise, and only hurt while up", () => {
  const spikes = DUNGEON_ROOMS[1].traps.find((trap) => trap.kind === "spikes")!;
  assert.equal(trapPhase(spikes, spikes.offset), "warn");
  assert.equal(trapPhase(spikes, spikes.offset + spikes.warn), "active");
  assert.equal(trapPhase(spikes, spikes.offset + spikes.warn + spikes.active), "rest");
  let state = at(empty(1), spikes.x + 10, 120);
  state.tick = spikes.offset - 1;
  state = ticks(state, spikes.warn);
  assert.equal(state.player.hp, BASE_HP, "the warning itself is harmless");
  state = ticks(state, 2);
  assert.equal(state.player.hp, BASE_HP - 1);
});

test("a dart shows its slot first, and guarding facing it turns it aside", () => {
  const darts = DUNGEON_ROOMS[1].traps.find((trap) => trap.kind === "darts")!;
  const fire = (block: boolean) => {
    let state = at(empty(1), darts.x - 60, 120);
    state.player.facing = 1;
    state.tick = darts.offset + darts.warn - 2;
    state = ticks(state, 3, { move: 0, block });
    assert.equal(state.projectiles.length, 1, "fired when the glow ends");
    return ticks(state, 40, { move: 0, block });
  };
  const open = fire(false);
  assert.equal(open.player.hp, BASE_HP - 1);
  const guarded = fire(true);
  assert.equal(guarded.player.hp, BASE_HP);
  assert.equal(guarded.projectiles.length, 0);
  // Darts fall spent before the spikes, so waiting for the spikes is never a dart's target.
  const waiting = ticks(at(empty(1), 40, 120), 600);
  assert.equal(waiting.player.hp, BASE_HP);
});

test("a press shakes before it drops, and is safe to pass between drops", () => {
  const press = DUNGEON_ROOMS[2].traps[0];
  let state = at(empty(2), press.x + 5, 120);
  state.tick = press.offset - 1;
  state = ticks(state, press.warn);
  assert.equal(state.player.hp, maxHp([]));
  state = ticks(state, 6);
  assert.equal(state.player.hp, maxHp([]) - 2);
});

test("a guard blocks a swing from the front, but not one after its own strike is turned aside", () => {
  let state = createDungeon(0, { shinai: true });
  const guard = state.enemies[0];
  state = at(state, guard.x - 24, 120);
  state.player.facing = 1;
  guard.state = "chase";
  guard.noticed = true;
  guard.facing = -1;
  state = stepDungeon(state, { move: 0, attack: true });
  state = ticks(state, 6);
  assert.ok(state.events.some((event) => event.type === "blocked") || state.enemies[0].state === "block");
  assert.equal(state.enemies[0].hp, 2);
  // Its answer comes quickly; guarding parries it and leaves it open.
  let parried = false;
  for (let i = 0; i < 40 && !parried; i++) {
    state = stepDungeon(state, { move: 0, block: true });
    parried = state.events.some((event) => event.type === "parry");
  }
  assert.ok(parried);
  assert.equal(state.enemies[0].state, "recover");
  state = stepDungeon(state, { move: 0, attack: true });
  state = ticks(state, 6);
  assert.equal(state.enemies[0].hp, 1);
});

test("an unarmed swing does nothing, and a guard can't be walked through", () => {
  let state = createDungeon();
  const guard = state.enemies[0];
  state = at(state, guard.x - 40, 120);
  state = stepDungeon(state, { move: 0, attack: true });
  assert.equal(state.player.attackTicks, 0);
  for (let i = 0; i < 30; i++) state = stepDungeon(state, { move: 1, block: true });
  assert.ok(state.player.x + PLAYER_W <= state.enemies[0].x + 2);
});

test("pickups need you beside them, and each is taken once", () => {
  let state = createDungeon();
  state = stepDungeon(state, { move: 0, interact: true });
  assert.equal(state.shinai, false);
  const shinai = DUNGEON_ROOMS[0].pickups[0];
  state = at(state, shinai.x, 80);
  state = stepDungeon(state, { move: 0, interact: true });
  assert.equal(state.shinai, true);
  assert.equal(ticks(state, 4, { move: 0, interact: true }).collected.filter((id) => id === shinai.id).length, 1);
});

test("scrap becomes armor at the workbench, and armor and kote add health", () => {
  let state = empty(2, { materials: SCRAP_FOR_ARMOR - 1 });
  const bench = DUNGEON_ROOMS[2].bench!;
  state = at(state, bench.x, 120);
  state = stepDungeon(state, { move: 0, interact: true });
  assert.ok(state.events.some((event) => event.type === "locked"));
  state = { ...state, materials: SCRAP_FOR_ARMOR };
  state = stepDungeon(state, { move: 0, interact: true });
  assert.deepEqual(state.pieces, ["do"]);
  assert.equal(state.player.hp, BASE_HP + 2);
  assert.equal(maxHp(["do", "kote"]), BASE_HP + 3);
});

test("doors hold until the guards are down and what's needed is found", () => {
  let state = createDungeon();
  state = at(state, DUNGEON_ROOMS[0].exit.x, 120);
  assert.equal(stepDungeon(state, { move: 0, interact: true }).room, 0);
  state = { ...state, shinai: true, enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0, state: "down" as const })) };
  state = stepDungeon(state, { move: 0, interact: true });
  assert.equal(state.room, 1);
  assert.equal(state.checkpoint, 1);
  let works = at(empty(2), DUNGEON_ROOMS[2].exit.x, 120);
  assert.equal(stepDungeon(works, { move: 0, interact: true }).room, 2, "armor first");
  works = { ...works, pieces: ["do"] };
  assert.equal(stepDungeon(works, { move: 0, interact: true }).room, 3);
  let final = at(empty(FINAL_ROOM), DUNGEON_ROOMS[FINAL_ROOM].exit.x, 120);
  assert.equal(stepDungeon(final, { move: 0, interact: true }).phase, "playing", "your gear first");
  final = { ...final, recovered: true };
  assert.equal(stepDungeon(final, { move: 0, interact: true }).phase, "escaped");
});

test("Ren vanishes every second hit and comes back behind you, and the chest waits for Ren", () => {
  let state = createDungeon(FINAL_ROOM, { shinai: true, pieces: ["do", "kote"] });
  const chest = DUNGEON_ROOMS[FINAL_ROOM].pickups[0];
  state = at(state, chest.x, 120);
  assert.equal(stepDungeon(state, { move: 0, interact: true }).recovered, false);
  state = at(createDungeon(FINAL_ROOM, { shinai: true }), 100, 120);
  const ren = state.enemies[0];
  ren.x = 124;
  ren.state = "recover";
  ren.ticks = 30;
  ren.hp = 5;
  ren.facing = -1;
  state.player.facing = 1;
  state = stepDungeon(state, { move: 0, attack: true });
  state = ticks(state, 6);
  assert.equal(state.enemies[0].state, "vanish");
  state = ticks(state, 30);
  const back = state.enemies[0];
  assert.ok(back.x < state.player.x, "behind you");
  assert.equal(ticks(createDungeon(FINAL_ROOM), 900).phase !== "escaped", true, "time alone never ends it");
  // Once hurt, a parried strike is followed by a second: dropping the guard after the first gets you hit.
  let chained = at(createDungeon(FINAL_ROOM, { shinai: true }), 100, 120);
  Object.assign(chained.enemies[0], { x: 122, state: "tell", ticks: 1, hp: 5, facing: -1 });
  chained.player.facing = 1;
  chained = stepDungeon(chained, { move: 0, block: true });
  assert.ok(chained.events.some((event) => event.type === "parry"));
  assert.equal(chained.enemies[0].state, "tell");
  const hp = chained.player.hp;
  chained = ticks(chained, 20);
  assert.ok(chained.player.hp < hp);
});

/**
 * A deterministic player using only the scene's inputs: it guards a tell, strikes an opening, and waits out
 * traps. If a room's layout stops being beatable, this is what notices.
 */
function play(start: DungeonState) {
  let state = start;
  const step = (input: DungeonInput) => {
    state = stepDungeon(state, input);
    assert.notEqual(state.phase, "dead", `died in ${DUNGEON_ROOMS[state.room].name} at ${Math.round(state.player.x)},${Math.round(state.player.y)}: ${state.cause}`);
  };
  const fightInput = (): DungeonInput | null => {
    const p = state.player;
    const foe = state.enemies.find((enemy) => enemy.hp > 0 && enemy.state !== "vanish" && Math.abs(enemy.y - p.y) < 16 && Math.abs(enemy.x - p.x) < 40);
    const shot = state.projectiles.find((s) => Math.abs(s.x - (p.x + 5)) < 40 && s.y > p.y && s.y < p.y + PLAYER_H + 4);
    const onSlab = solidPlatforms(state).some((platform) => platform.loose && p.x + PLAYER_W > platform.x && p.x < platform.x + platform.w);
    if (shot && !onSlab) return { move: 0, block: true, ...(Math.sign(shot.x - p.x) !== p.facing ? { move: Math.sign(shot.x - p.x) as -1 | 1 } : {}) };
    if (!foe) return null;
    const dir = Math.sign(foe.x - p.x) as -1 | 1;
    if (p.facing !== dir) return { move: dir };
    if (foe.state === "tell" || foe.state === "strike" || foe.state === "block") return { move: 0, block: true };
    if (foe.state === "recover" || foe.state === "aim" || foe.kind === "thrower") return Math.abs(foe.x - p.x) > 26 ? { move: dir } : { move: 0, attack: true };
    return { move: 0, block: true };
  };
  return {
    get state() { return state; },
    step,
    /** Fights and dodges along the way, but otherwise walks. */
    walkTo(x: number, safe: () => boolean = () => true) {
      for (let i = 0; i < 3000 && Math.abs(state.player.x - x) > 1.5; i++) {
        step(fightInput() ?? (safe() ? { move: state.player.x < x ? 1 : -1 } : idle));
      }
      assert.ok(Math.abs(state.player.x - x) <= 1.5, `could not reach ${x} in ${DUNGEON_ROOMS[state.room].name} from ${state.player.x}`);
      step(idle);
    },
    fight() {
      for (let i = 0; i < 3000 && state.enemies.some((enemy) => enemy.hp > 0); i++) {
        const foe = state.enemies.find((enemy) => enemy.hp > 0)!;
        step(fightInput() ?? (foe.state === "vanish" ? { move: 0, block: true } : { move: Math.sign(foe.x - state.player.x) as -1 | 1 }));
      }
      assert.ok(state.enemies.every((enemy) => enemy.hp === 0), "won the fight");
    },
    climb(dir: -1 | 1) {
      const top = state.player.y;
      step({ move: dir, jump: true, up: true });
      for (let i = 0; i < 80 && !(state.player.grounded && state.player.y < top - 20); i++) step({ move: 0, up: true });
      assert.ok(state.player.y < top - 20, `climbed in ${DUNGEON_ROOMS[state.room].name} at ${state.player.x}`);
    },
    runJump(dir: -1 | 1, distance: number) {
      const from = state.player.x;
      while (Math.abs(state.player.x - from) < distance) step({ move: dir });
      step({ move: dir, jump: true });
      for (let i = 0; i < 60 && !state.player.grounded; i++) step({ move: dir });
      for (let i = 0; i < 3; i++) step({ move: dir });
    },
    use() {
      step({ move: 0, interact: true });
    },
    wait(until: () => boolean) {
      for (let i = 0; i < 600 && !until(); i++) step(fightInput() ?? idle);
    },
  };
}

test("a real-input route arms, climbs, crafts, defeats the guards and Ren, and escapes with everything", () => {
  const run = play(createDungeon());
  const rooms = DUNGEON_ROOMS;
  // The cell: climb to the shinai, then the shelf above for the crane.
  run.walkTo(rooms[0].platforms[2].x - PLAYER_W);
  run.climb(1);
  run.walkTo(rooms[0].pickups[0].x);
  run.use();
  assert.equal(run.state.shinai, true);
  run.walkTo(rooms[0].platforms[2].x + 1);
  run.state.player.facing = -1;
  run.climb(-1);
  run.walkTo(rooms[0].pickups[1].x);
  run.use();
  assert.ok(run.state.collected.includes("cell-crane"));
  run.walkTo(rooms[0].platforms[3].x + rooms[0].platforms[3].w - PLAYER_W - 1);
  run.walkTo(150);
  run.runJump(1, 36);
  run.fight();
  run.walkTo(rooms[0].exit.x);
  run.use();
  assert.equal(run.state.room, 1);
  // The spike hall: wait out the spikes, run the slab, guard the darts, climb to the guard.
  const spikes = rooms[1].traps[0];
  run.walkTo(spikes.x - 14);
  run.wait(() => trapPhase(spikes, run.state.tick) === "rest" && trapPhase(spikes, run.state.tick + 30) === "rest");
  run.walkTo(rooms[1].platforms[3].x - PLAYER_W);
  run.climb(1);
  run.fight();
  run.walkTo(rooms[1].pickups[0].x);
  run.use();
  assert.equal(run.state.materials, 1);
  run.walkTo(rooms[1].platforms[4].x + rooms[1].platforms[4].w);
  run.state.player.facing = -1;
  run.climb(-1);
  run.walkTo(rooms[1].pickups[1].x);
  run.use();
  assert.ok(run.state.collected.includes("hall-crane"));
  run.walkTo(rooms[1].exit.x);
  run.use();
  assert.equal(run.state.room, 2);
  // The copper works: time the presses, beat the guard below, climb to the thrower and the kote.
  const [pressA, pressB] = rooms[2].traps;
  const clear = (trap: typeof pressA, ahead: number) => [0, 6, 12, 18, ahead].every((dt) => trapPhase(trap, run.state.tick + dt) === "rest");
  run.walkTo(pressA.x - 14);
  run.wait(() => clear(pressA, 20));
  run.walkTo(rooms[2].pickups[0].x);
  run.use();
  run.wait(() => clear(pressB, 20));
  run.walkTo(pressB.x + pressB.w + 4);
  run.walkTo(rooms[2].pickups[1].x);
  run.use();
  run.walkTo(rooms[2].platforms[1].x - PLAYER_W);
  run.climb(1);
  run.fight();
  run.walkTo(rooms[2].pickups[2].x);
  run.use();
  assert.ok(run.state.pieces.includes("kote"));
  run.walkTo(rooms[2].pickups[3].x);
  run.use();
  run.walkTo(rooms[2].bench!.x);
  run.use();
  assert.ok(run.state.pieces.includes("do"));
  run.walkTo(rooms[2].exit.x);
  run.use();
  assert.equal(run.state.room, FINAL_ROOM);
  // Ren.
  run.fight();
  run.walkTo(rooms[FINAL_ROOM].pickups[0].x);
  run.use();
  assert.equal(run.state.recovered, true);
  run.walkTo(rooms[FINAL_ROOM].exit.x);
  run.use();
  assert.equal(run.state.phase, "escaped");
  assert.ok(run.state.collected.includes("cell-crane") && run.state.collected.includes("hall-crane"));
});

test("a save keeps the room, gear and finds, and starts you at the room's door", () => {
  let state = createDungeon(2, { shinai: true, pieces: ["kote"], materials: 2, collected: ["cell-shinai", "hall-scrap", "works-scrap-a", "works-kote"] });
  state = ticks(state, 30, { move: 1 });
  const parsed = parseDungeonState(JSON.parse(JSON.stringify(state)));
  assert.ok(parsed);
  assert.equal(parsed.room, 2);
  assert.deepEqual(parsed.pieces, ["kote"]);
  assert.equal(parsed.materials, 2);
  assert.equal(parsed.player.x, DUNGEON_ROOMS[2].start.x);
  assert.equal(parseDungeonState({ ...state, room: 9 }), null);
  assert.equal(parseDungeonState({ ...state, collected: ["not-a-find"] }), null);
  assert.equal(parseDungeonState({ ...state, collected: ["cell-shinai", "cell-shinai"] }), null);
  assert.equal(parseDungeonState({ ...state, pieces: ["men"] }), null);
  assert.equal(parseDungeonState({ ...state, materials: -1 }), null);
  // The first version of the trial saved armor as a flag and no pieces: it can't be trusted, so it starts again.
  assert.equal(parseDungeonState({ room: 1, tick: 4, collected: [], shinai: true, armor: false, materials: 0, phase: "playing", checkpoint: 1 }), null);
});
