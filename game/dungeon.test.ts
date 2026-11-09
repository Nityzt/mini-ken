import test from 'node:test';
import assert from 'node:assert/strict';
import { createDungeon, stepDungeon, DUNGEON_ROOMS, PLAYER_H, trapActive, type DungeonState, type DungeonInput } from './dungeon.ts';
const idle = { move: 0 as const };
const ticks = (state: DungeonState, count: number, input: DungeonInput = idle) => { for(let i=0;i<count;i++) state=stepDungeon(state,input); return state; };

test('the cell begins without equipment and the model does not mutate its input', () => {
 const state = createDungeon();
 const snapshot = structuredClone(state);
 const next = stepDungeon(state,{move:1});
 assert.deepEqual(state,snapshot);
 assert.ok(next.player.x > state.player.x);
 assert.equal(state.shinai,false);
 assert.equal(state.armor,false);
});
test('jumping crosses the first real pit while walking drops into it', () => {
 let walker = createDungeon();
 walker.player.x=147;
 walker=ticks(walker,70,{move:1});
 assert.equal(walker.phase,'dead');
 let jumper=createDungeon();
 jumper.player.x=147;
 jumper=stepDungeon(jumper,{move:1,jump:true});
 jumper=ticks(jumper,38,{move:1});
 assert.equal(jumper.phase,'playing');
 assert.ok(jumper.player.x>200);
 assert.ok(jumper.player.y+PLAYER_H<=121);
});
test('shinai and scraps need an interaction close to their actual positions', () => {
 let state=createDungeon();
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.shinai,false);
 state.player.x=64;
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.shinai,true);
 assert.ok(state.collected.includes('cell-shinai'));
 assert.equal(ticks(state,4,{move:0,interact:true}).collected.filter(id=>id==='cell-shinai').length,1);
});
test('two scraps can be crafted into armor at the workbench, never from afar', () => {
 let state=createDungeon(1,{room:1,shinai:true,armor:false,materials:2,collected:['scrap-a','scrap-b']});
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.armor,false);
 state.player.x=DUNGEON_ROOMS[1].bench!.x;
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.armor,true);
 assert.equal(state.materials,0);
});
test('traps alternate a visible tell with active damage and armor reduces damage', () => {
 const trap=DUNGEON_ROOMS[1].traps[0];
 assert.equal(trapActive(trap,trap.offset),true);
 assert.equal(trapActive(trap,trap.offset+trap.activeTicks),false);
 let state=createDungeon(1,{room:1,shinai:true,armor:false,materials:0,collected:[]});
 state.tick=trap.offset-1;
 state.player.x=trap.x;
 state.player.y=trap.y;
 const bare=stepDungeon(state,idle);
 const armored=stepDungeon({...state,armor:true},idle);
 assert.ok(bare.player.hp<state.player.hp);
 assert.ok(armored.player.hp>bare.player.hp);
});
test('unarmed attacks cannot defeat a ninja and attacks only score through an opening', () => {
 let state=createDungeon();
 const enemy=state.enemies[0];
 state.player.x=enemy.x-22;
 state.player.facing=1;
 state=stepDungeon(state,{move:0,attack:true});
 assert.equal(state.player.attackTicks,0);
 state={...state,shinai:true};
 state.enemies[0].state='recover'; state.enemies[0].ticks=50;
 const hp=state.enemies[0].hp;
 state=stepDungeon(state,{move:0,attack:true});
 state=ticks(state,4);
 assert.equal(state.enemies[0].hp,hp-1);
 state=ticks(state,8);
 assert.equal(state.enemies[0].hp,hp-1,'a single swing hits only once');
});
test('blocking a telegraphed attack leaves an opening rather than ending combat by timer', () => {
 let state=createDungeon(2,{room:2,shinai:true,armor:true,materials:0,collected:[]});
 const enemy=state.enemies[0];
 state.player.x=enemy.x-20;
 state.player.facing=1;
 enemy.state='tell';enemy.ticks=1;enemy.facing=-1;
 const hp=state.player.hp;
 state=stepDungeon(state,{move:0,block:true});
 assert.equal(state.player.hp,hp);
 assert.equal(state.enemies[0].state,'recover');
 assert.ok(state.events.some(event=>event.type==='parry'));
 assert.equal(ticks(createDungeon(2),900).phase,'playing','Ren does not lose just because time passes');
});
test('guarded room exits reject skipping enemies or equipment', () => {
 let state=createDungeon(); state.player.x=DUNGEON_ROOMS[0].exit.x;
 assert.equal(stepDungeon(state,{move:0,interact:true}).room,0);
 state={...state,shinai:true,enemies:state.enemies.map(enemy=>({...enemy,hp:0,state:'down' as const}))};
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.room,1);
 assert.equal(state.checkpoint,1);
 state.player.x=DUNGEON_ROOMS[1].exit.x;
 state.enemies=state.enemies.map(enemy=>({...enemy,hp:0,state:'down' as const}));
 assert.equal(stepDungeon(state,{move:0,interact:true}).room,1,'armor is needed before entering the spy chamber');
});
test('a death retries the room and retains scavenged equipment without duplicating discoveries', () => {
 let state=createDungeon(1,{room:1,shinai:true,armor:true,materials:0,collected:['cell-shinai','cell-egg','scrap-a','scrap-b']});
 state.phase='dead'; state.player.hp=0;
 state=stepDungeon(state,{move:0,retry:true});
 assert.equal(state.room,1);assert.equal(state.phase,'playing');assert.equal(state.armor,true);
 assert.ok(state.collected.includes('cell-egg'));assert.ok(state.player.hp>0);
 assert.ok(state.enemies.every(enemy=>enemy.hp>0));
});
test('only beating Ren and reaching the final exit escapes the trial', () => {
 let state=createDungeon(2,{room:2,shinai:true,armor:true,materials:0,collected:[]});
 state.player.x=DUNGEON_ROOMS[2].exit.x;
 assert.equal(stepDungeon(state,{move:0,interact:true}).phase,'playing');
 state.enemies=state.enemies.map(enemy=>({...enemy,hp:0,state:'down' as const}));
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.phase,'escaped');
 assert.ok(state.events.some(event=>event.type==='escape'));
});

/** A deterministic player uses the same movement, jump and combat inputs as the scene. */
function walkTo(start: DungeonState, target: number): DungeonState {
 let state=start;
 for(let count=0;count<1800&&Math.abs(state.player.x-target)>2;count++){
  const enemy=state.enemies.find(enemy=>enemy.hp>0&&Math.abs(enemy.x-state.player.x)<36&&Math.abs(enemy.y-state.player.y)<24);
  const input: DungeonInput={move:target>state.player.x?1:-1,interact:true};
  if(enemy){
   input.move=0;
   if(enemy.state==='tell'||enemy.state==='strike')input.block=true;
   else if(enemy.state==='recover')input.attack=true;
  }
  state=stepDungeon(state,input);
  if(state.room!==start.room||state.phase==='escaped')return state;
  assert.equal(state.phase,'playing',`failed approaching ${target} in room ${state.room}, at ${state.player.x},${state.player.y}`);
 }
 assert.ok(Math.abs(state.player.x-target)<=2,`could not reach ${target} in room ${state.room}: ${JSON.stringify(state)}`);
 return state;
}
function jumpTo(start:DungeonState,target:number):DungeonState {
 return walkTo(stepDungeon(start,{move:1,jump:true,interact:true}),target);
}
test('a real-input route scavenges, jumps, crafts, defeats guards and Ren, and escapes', () => {
 let state=createDungeon();
 state=walkTo(state,68);
 assert.equal(state.shinai,true);
 state=walkTo(state,148);
 state=jumpTo(state,226);
 state=jumpTo(state,280);
 // Wait on the shelf and interact to collect the hidden discovery.
 state=ticks(state,36,{move:0,interact:true});
 assert.ok(state.collected.includes('cell-egg'));
 state=walkTo(state,524);
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.room,1);
 state=walkTo(state,84);
 state=walkTo(state,120);
 state=jumpTo(state,210);
 state=walkTo(state,244);
 state=jumpTo(state,350);
 assert.equal(state.materials,2);
 state=walkTo(state,492);
 assert.equal(state.armor,true);
 state=walkTo(state,604);
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.room,2);
 state=walkTo(state,142);
 state=jumpTo(state,240);
 state=walkTo(state,524);
 state=stepDungeon(state,{move:0,interact:true});
 assert.equal(state.phase,'escaped');
 assert.ok(state.enemies.every(enemy=>enemy.hp===0));
 assert.ok(state.collected.includes('cell-egg'));
});

test('saved dungeon state validates actors and discoveries and drops transient events', async () => {
 const {parseDungeonState}=await import('./dungeon.ts');
 const state=createDungeon();
 state.events=[{type:'secret',id:'cell-egg'}];
 assert.deepEqual(parseDungeonState(JSON.parse(JSON.stringify(state))),{...state,events:[]});
 assert.equal(parseDungeonState({...state,room:9}),null);
 assert.equal(parseDungeonState({...state,player:{...state.player,x:NaN}}),null);
 assert.equal(parseDungeonState({...state,enemies:[{...state.enemies[0],id:'made-up'}]}),null);
 assert.equal(parseDungeonState({...state,collected:['not-an-egg']}),null);
 assert.equal(parseDungeonState({...state,collected:['cell-egg','cell-egg']}),null);
 assert.equal(parseDungeonState({...state,materials:-1}),null);
});
