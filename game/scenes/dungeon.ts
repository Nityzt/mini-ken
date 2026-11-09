import { drawFighter, type DuelPose } from '../art/duel-sprites.ts';
import { drawText, drawTextCentered, wrapText } from '../art/font.ts';
import { FULL_GEAR, NO_GEAR, type Gear } from '../art/kendoka.ts';
import { PALETTE, RIVAL_COLORS, UI } from '../art/palette.ts';
import { playerColors } from '../characters.ts';
import { keyLabel } from '../core/key-labels.ts';
import { onGui, onStage, STAGE_H, STAGE_W, viewH, viewW } from '../core/scale.ts';
import type { Game, Scene } from '../core/scene.ts';
import { createDungeon, DUNGEON_ROOMS, PLAYER_H, PLAYER_W, stepDungeon, trapActive, type DungeonState } from '../dungeon.ts';
import { abandonDungeon, captureDungeon, dungeonStage, finishDungeon, saveDungeonProgress } from '../dungeon-story.ts';
import { createDialogue } from './dialogue.ts';

/** The trap, rather than a fair scoring match, decides this encounter. Movement, hits and guarding remain live. */
export type Ambush = { tick: number; x: number; renX: number; hp: number; hits: number; swing: number; cooldown: number; phase: 'fight' | 'captured' };
export const createAmbush = (): Ambush => ({ tick: 0, x: 78, renX: 174, hp: 3, hits: 0, swing: 0, cooldown: 0, phase: 'fight' });
export function stepAmbush(before: Ambush, input: { move: -1 | 0 | 1; attack: boolean; block: boolean }): Ambush {
  if (before.phase !== 'fight') return before;
  const state = { ...before, tick: before.tick + 1, swing: Math.max(0, before.swing - 1), cooldown: Math.max(0, before.cooldown - 1) };
  state.x = Math.max(30, Math.min(210, state.x + input.move * (input.block ? 0.4 : 1.3)));
  const distance = state.x - state.renX;
  const beat = state.tick % 90;
  if (Math.abs(distance) > 22 && beat < 60) state.renX += Math.sign(distance) * 1.45;
  if (input.attack && !state.cooldown) {
    state.swing = 12;
    state.cooldown = 24;
    if (Math.abs(state.renX - state.x) < 37 && beat < 60) state.hits++;
  }
  if (beat === 84 && Math.abs(state.renX - state.x) < 36 && !input.block) state.hp = Math.max(1, state.hp - 1);
  if (state.tick >= 600) { state.hp = 0; state.phase = 'captured'; }
  return state;
}

const NINJA_COLORS = { I: '#34374C', i: '#555A70', N: '#181D2B', S: '#34374C', s: '#181D2B', H: '#181D2B', h: '#34374C', W: '#34374C', w: '#555A70', R: '#C8665A' };
const ROOM_COLORS = ['#373547', '#314448', '#3F3541'];
const CAPTURE_LINES = [
  'Ren: That door was closed for a reason.',
  'Ren: Show me what you saw. Shinai up!',
];
const THROWN_LINES = [
  'Ren knocks a hidden catch. Smoke fills the room before you can reach the door.',
  'Your armor and shinai are taken. You wake below the dojo, beside an open drain.',
  'Find a weapon. Gather scraps and use a workbench to make armor. Then find a way out.',
  'Face a guard and hold down to parry. Strike as they recover. The tunnels reward patience.',
];
const ESCAPE_LINES = [
  'Ren: So the drain did not hold you. Yes. A spy, with a dojo for a hiding place.',
  'Ren: You have seen one room of a much larger house. We will meet again.',
  'Ren vanishes into a service tunnel. Your missing equipment is in a chest by the exit.',
];

/** Scene-local state is saved through the story helpers, never over the player's ordinary equipment. */
export function createDungeonScene(nameOf: () => string = () => 'you'): Scene {
  const dialogue = createDialogue(nameOf);
  let ambush = createAmbush();
  let state: DungeonState = createDungeon();
  let mode: 'ambush' | 'trial' | 'escape' = 'ambush';
  let notice = '';
  let noticeTicks = 0;
  let revealed = false;

  const publish = (game: Game) => {
    game.debug.dungeon = { mode, ambush, state, notice, dialogue: dialogue.active };
  };
  const beginTrial = (game: Game) => {
    mode = 'trial';
    game.run = captureDungeon(game.run);
    state = createDungeon();
    game.run = saveDungeonProgress(game.run, state);
    notice = 'Find a weapon. The exit is to the right.';
    noticeTicks = 240;
    publish(game);
  };
  return {
    busy: () => dialogue.active || mode === 'ambush' || mode === 'escape',
    forfeitLabel: () => 'Leave trial and recover your gear',
    forfeit(game) {
      game.run = abandonDungeon(game.run);
      game.message = ['You find the service ladder and recover your equipment. The hidden door is still there when you are ready.'];
      game.go('rival-dojo');
    },
    enter(game) {
      ambush = createAmbush();
      state = createDungeon();
      mode = dungeonStage(game.run) === 'active' ? 'trial' : 'ambush';
      if (mode === 'trial') state = game.run.dungeon.progress ?? createDungeon();
      revealed = state.room === DUNGEON_ROOMS.length - 1;
      if (mode === 'ambush') dialogue.open(CAPTURE_LINES, undefined, undefined);
      publish(game);
    },
    update(game) {
      if (noticeTicks > 0) noticeTicks--;
      if (dialogue.active) { dialogue.update(game.input, game.audio); publish(game); return; }
      if (mode === 'ambush') {
        const next = stepAmbush(ambush, { move: game.input.isDown('left') ? -1 : game.input.isDown('right') ? 1 : 0, attack: game.input.wasPressed('men') || game.input.wasPressed('kote') || game.input.wasPressed('do'), block: game.input.isDown('down') });
        if (next.hits > ambush.hits) game.audio.play('clean');
        if (next.swing > ambush.swing) game.audio.play('swing');
        ambush = next;
        if (ambush.phase === 'captured') dialogue.open(THROWN_LINES, () => beginTrial(game), () => beginTrial(game));
      } else if (mode === 'trial') {
        const before = state;
        const interact = game.input.wasPressed('confirm');
        state = stepDungeon(state, { move: game.input.isDown('left') ? -1 : game.input.isDown('right') ? 1 : 0, jump: !interact && game.input.wasPressed('up'), attack: !interact && (game.input.wasPressed('men') || game.input.wasPressed('kote') || game.input.wasPressed('do')), interact, block: game.input.isDown('down'), retry: interact });
        if (state.player.attackTicks > before.player.attackTicks) game.audio.play('swing');
        if (state.player.hp < before.player.hp) game.audio.play('break');
        if (state.collected.length > before.collected.length || state.armor !== before.armor) game.audio.play('pickup');
        if (state.room !== before.room) { notice = DUNGEON_ROOMS[state.room].name; noticeTicks = 180; }
        for (const event of state.events) {
          if (event.type === 'locked' && event.text) { notice = event.text; noticeTicks = 240; }
          if (event.type === 'parry') { game.audio.play('parry'); notice = 'Now! Strike while the guard recovers.'; noticeTicks = 90; }
          if (event.type === 'hit') game.audio.play('clean');
          if (event.type === 'craft') { notice = 'Scrap armor fitted. You can take a hit.'; noticeTicks = 180; }
          if (event.type === 'secret') { notice = 'A tiny paper crane hides a practice token.'; noticeTicks = 180; }
        }
        if (state.room === DUNGEON_ROOMS.length - 1 && !revealed) {
          revealed = true;
          dialogue.open(['Ren steps out in a dark mask.', 'Ren: A ninja spy needs more than a good disguise. You should have stayed in your cell.']);
        }
        game.run = saveDungeonProgress(game.run, state);
        if (state.phase === 'escaped') {
          mode = 'escape';
          const leave = () => { game.run = finishDungeon(game.run); game.go('rival-dojo'); };
          dialogue.open(ESCAPE_LINES, leave, leave);
        }
      }
      publish(game);
    },
    render(ctx, game) {
      ctx.fillStyle = '#151824';
      ctx.fillRect(0, 0, viewW, viewH);
      onStage(ctx, () => {
        if (mode === 'ambush') drawAmbush(ctx, game, ambush);
        else drawDungeonRoom(ctx, game, state);
      });
      onGui(ctx, () => {
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, 0, viewW, 24);
        const title = mode === 'ambush' ? 'Behind the Radish screen' : DUNGEON_ROOMS[state.room].name;
        drawText(ctx, title, 4, 2, UI.accent);
        const status = mode === 'ambush' ? `Hits ${ambush.hits}   HP ${ambush.hp}/3` : `HP ${state.player.hp}   Scrap ${state.materials}   ${state.armor ? 'Armored' : state.shinai ? 'Armed' : 'Unarmed'}`;
        drawText(ctx, status, 4, 13, UI.text);
        ctx.fillStyle = UI.panel;
        ctx.fillRect(0, viewH - 22, viewW, 22);
        const movement = `${keyLabel(game.input, 'left', 'a')}/${keyLabel(game.input, 'right', 'd')} move   ${mode === 'ambush' ? '' : `${keyLabel(game.input, 'up', 'w')} jump   `}${keyLabel(game.input, 'down', 's')} guard`;
        const actions = `${keyLabel(game.input, 'men', 'j')} strike${mode === 'ambush' ? '' : `   ${keyLabel(game.input, 'confirm', 'e')} use`}`;
        drawTextCentered(ctx, movement, viewW / 2, viewH - 20, UI.dim);
        drawTextCentered(ctx, actions, viewW / 2, viewH - 10, UI.dim);
        if (noticeTicks > 0 && !dialogue.active) wrapText(notice, viewW - 12).slice(0, 2).forEach((line, i) => drawTextCentered(ctx, line, viewW / 2, 28 + i * 10, UI.accent));
        if (mode === 'trial' && state.phase === 'dead') {
          onStage(ctx, () => {
            ctx.fillStyle = UI.panel; ctx.fillRect(28, 49, 200, 40);
            drawTextCentered(ctx, 'Caught in the tunnels', STAGE_W / 2, 56, UI.bad);
            drawTextCentered(ctx, `${keyLabel(game.input, 'confirm', 'e')} retry from checkpoint`, STAGE_W / 2, 72, UI.text);
          });
        }
        dialogue.render(ctx);
      });
    },
  };
}

function drawAmbush(ctx: CanvasRenderingContext2D, game: Game, state: Ambush): void {
  ctx.fillStyle = '#332E37'; ctx.fillRect(0, 14, STAGE_W, 112);
  ctx.fillStyle = '#797061'; ctx.fillRect(0, 113, STAGE_W, 18);
  for (let x = 0; x < STAGE_W; x += 24) { ctx.fillStyle = '#51494A'; ctx.fillRect(x, 18, 2, 90); }
  ctx.fillStyle = '#A05B5A'; ctx.fillRect(114, 30, 28, 60);
  drawTextCentered(ctx, 'RADISH', 128, 37, PALETTE.w);
  const beat = state.tick % 90;
  const playerPose: DuelPose = state.phase === 'captured' ? 'stumble' : state.swing ? 'strikeMen' : game.input.isDown('down') ? 'block' : 'guard';
  const renPose: DuelPose = beat >= 84 ? 'strikeMen' : beat >= 60 ? 'tellBigRaise' : 'guard';
  drawFighter(ctx, state.x, 113, playerPose, 'player', Math.floor(state.tick / 10), game.run.gear, { colors: playerColors(game.run), flip: state.x > state.renX, insignia: game.run.insignia, weapon: game.run.gear.shinai ? 'shinai' : 'none' });
  drawFighter(ctx, state.renX, 113, renPose, 'rival', Math.floor(state.tick / 10), FULL_GEAR, { colors: RIVAL_COLORS, flip: state.renX > state.x });
  if (beat >= 60) drawTextCentered(ctx, '!', state.renX, 63, UI.bad);
  if (state.tick > 550) {
    ctx.fillStyle = '#758380';
    for (let x = 0; x < STAGE_W; x += 20) ctx.fillRect(x, 111 - Math.floor((state.tick - 550) / 3), 24, 18);
  }
}

function drawDungeonRoom(ctx: CanvasRenderingContext2D, game: Game, state: DungeonState): void {
  const room = DUNGEON_ROOMS[state.room];
  const camera = Math.max(0, Math.min(room.width - STAGE_W, state.player.x - 94));
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 13, STAGE_W, 118); ctx.clip();
  ctx.translate(-Math.floor(camera), 0);
  ctx.fillStyle = ROOM_COLORS[state.room]; ctx.fillRect(0, 13, room.width, 118);
  for (let y = 22; y < 130; y += 16) for (let x = ((y / 16) % 2) * 16; x < room.width; x += 32) {
    ctx.fillStyle = '#1F2835'; ctx.fillRect(x, y, 31, 1); ctx.fillRect(x, y, 1, 16);
  }
  for (let x = 34; x < room.width; x += 134) {
    ctx.fillStyle = '#161D29'; ctx.fillRect(x, 29, 22, 48);
    ctx.fillStyle = '#727775'; ctx.fillRect(x + 5, 29, 2, 48); ctx.fillRect(x + 15, 29, 2, 48);
  }
  for (const platform of room.platforms) {
    ctx.fillStyle = '#161D29'; ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = '#818A85'; ctx.fillRect(platform.x, platform.y, platform.w, 3);
    ctx.fillStyle = '#515D60'; ctx.fillRect(platform.x, platform.y + 3, platform.w, 3);
  }
  for (const trap of room.traps) {
    const active = trapActive(trap, state.tick);
    ctx.fillStyle = active ? '#D38B80' : '#8C775A';
    for (let x = trap.x; x < trap.x + trap.w; x += 5) {
      ctx.fillRect(x, trap.y + trap.h - 3, 4, 3);
      if (active) { ctx.fillRect(x + 1, trap.y + 2, 2, Math.max(1, trap.h - 2)); ctx.fillRect(x + 2, trap.y, 1, 3); }
    }
  }
  for (const pickup of room.pickups) {
    if (state.collected.includes(pickup.id)) continue;
    const bob = game.reducedMotion ? 0 : Math.floor(Math.sin(state.tick / 12) * 2);
    const y = pickup.y + bob;
    ctx.fillStyle = pickup.kind === 'egg' ? '#E7D892' : pickup.kind === 'shinai' ? '#D4B574' : '#9AB9B1';
    if (pickup.kind === 'shinai') { ctx.fillRect(pickup.x + 2, y - 8, 2, 16); ctx.fillRect(pickup.x, y + 3, 6, 2); }
    else if (pickup.kind === 'egg') { ctx.fillRect(pickup.x, y, 7, 3); ctx.fillRect(pickup.x + 2, y - 3, 3, 7); }
    else { ctx.fillRect(pickup.x, y, 8, 6); ctx.fillStyle = '#C1D3CB'; ctx.fillRect(pickup.x + 1, y + 1, 2, 3); }
  }
  if (room.bench) {
    const { x } = room.bench;
    const y = room.bench.y + PLAYER_H;
    ctx.fillStyle = '#B39767'; ctx.fillRect(x - 10, y - 7, 24, 4); ctx.fillRect(x - 8, y - 3, 3, 8); ctx.fillRect(x + 8, y - 3, 3, 8);
    ctx.fillStyle = '#9AB9B1'; ctx.fillRect(x - 3, y - 12, 8, 5);
    drawTextCentered(ctx, 'WORKBENCH', x, y - 25, '#D4CCAE');
  }
  const exit = { x: room.exit.x, y: room.exit.y + PLAYER_H };
  ctx.fillStyle = '#111622'; ctx.fillRect(exit.x - 7, exit.y - 28, 20, 30);
  ctx.fillStyle = '#B1B69B'; ctx.fillRect(exit.x - 8, exit.y - 29, 22, 3);
  drawTextCentered(ctx, state.room === DUNGEON_ROOMS.length - 1 ? 'EXIT' : 'ONWARD', exit.x + 3, exit.y - 40, '#D4CCAE');
  for (const enemy of state.enemies) {
    if (enemy.state === 'down') continue;
    drawSmallFighter(ctx, enemy.x + PLAYER_W / 2, enemy.y + PLAYER_H, enemy.state === 'tell' ? 'tellBigRaise' : enemy.state === 'strike' ? 'strikeMen' : enemy.state === 'recover' ? 'recover' : 'guard', Math.floor(state.tick / 10), { ...NO_GEAR, shinai: true }, enemy.kind === 'ren' ? { ...NINJA_COLORS, R: '#BC3B56', H: '#211923' } : NINJA_COLORS, enemy.facing === -1);
    ctx.fillStyle = '#D4B799'; ctx.fillRect(enemy.x + (enemy.facing === 1 ? 4 : 0), enemy.y + 5, 6, 2);
    if (enemy.state === 'tell') drawTextCentered(ctx, '!', enemy.x + 5, enemy.y - 11, UI.bad);
    if (enemy.kind === 'ren') drawTextCentered(ctx, 'REN', enemy.x + 5, enemy.y - 21, '#ED9AA7');
  }
  const gear: Gear = { ...NO_GEAR, shinai: state.shinai, tare: state.armor, do: state.armor, kote: state.armor };
  const pose: DuelPose = state.player.attackTicks ? 'strikeMen' : !state.player.grounded ? 'launch' : state.phase === 'dead' ? 'stumble' : game.input.isDown('down') ? 'block' : 'guard';
  if (!state.player.invulnerable || game.reducedMotion || state.tick % 6 < 3) drawSmallFighter(ctx, state.player.x + PLAYER_W / 2, state.player.y + PLAYER_H, pose, Math.floor(state.tick / 8), gear, playerColors({ ...game.run, equipped: {}, owned: [], look: '' }), state.player.facing === -1);
  ctx.restore();
}

function drawSmallFighter(ctx: CanvasRenderingContext2D, x: number, y: number, pose: DuelPose, frame: number, gear: Gear, colors: Record<string, string>, flip: boolean): void {
  ctx.save(); ctx.scale(0.5, 0.5);
  drawFighter(ctx, x * 2, y * 2, pose, 'player', frame, gear, { colors, flip, showRibbon: false, weapon: gear.shinai ? 'shinai' : 'none' });
  ctx.restore();
}
