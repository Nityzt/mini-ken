/** A small original dungeon trial. Positions and speeds are in the game's own pixels/ticks. */
export const PLAYER_W = 10;
export const PLAYER_H = 20;
export const DUNGEON_HP = 5;
export const RUN_SPEED = 1.8;
export const JUMP_SPEED = -5.5;
const GRAVITY = 0.32;
export type DungeonRect = { x: number; y: number; w: number; h: number };
export type DungeonTrap = DungeonRect & { period: number; activeTicks: number; offset: number };
export type DungeonPickup = { id: string; kind: 'shinai' | 'scrap' | 'egg'; x: number; y: number };
export type DungeonEnemySpec = { id: string; kind: 'ninja' | 'ren'; x: number; y: number };
export type DungeonRoom = { name: string; width: number; platforms: DungeonRect[]; traps: DungeonTrap[]; pickups: DungeonPickup[]; enemies: DungeonEnemySpec[]; bench?: { x: number; y: number }; exit: { x: number; y: number } };
export const DUNGEON_ROOMS: DungeonRoom[] = [
 { name: 'The Dry Cistern', width: 560,
  platforms: [{x:0,y:120,w:170,h:24},{x:210,y:120,w:350,h:24},{x:248,y:88,w:64,h:8}],
  traps: [],
  pickups: [{id:'cell-shinai',kind:'shinai',x:68,y:100},{id:'cell-egg',kind:'egg',x:280,y:68}],
  enemies: [{id:'cistern-watch',kind:'ninja',x:370,y:100}], exit:{x:524,y:100} },
 { name: 'The Copper Works', width: 640,
  platforms: [{x:0,y:120,w:260,h:24},{x:304,y:120,w:336,h:24},{x:338,y:88,w:64,h:8}],
  traps: [{x:146,y:112,w:24,h:8,period:150,activeTicks:36,offset:0}],
  pickups: [{id:'scrap-a',kind:'scrap',x:84,y:100},{id:'scrap-b',kind:'scrap',x:350,y:100},{id:'works-egg',kind:'egg',x:370,y:68}],
  enemies: [{id:'works-watch',kind:'ninja',x:408,y:100}], bench:{x:492,y:100},exit:{x:604,y:100} },
 { name: 'The Spy Chamber', width: 560,
  platforms: [{x:0,y:120,w:560,h:24},{x:64,y:88,w:64,h:8}],
  traps: [{x:168,y:112,w:28,h:8,period:160,activeTicks:42,offset:45}],
  pickups: [{id:'spy-egg',kind:'egg',x:96,y:68}],
  enemies: [{id:'ren-spy',kind:'ren',x:360,y:100}], exit:{x:524,y:100} },
];
export type DungeonInput = { move: -1 | 0 | 1; jump?: boolean; attack?: boolean; interact?: boolean; block?: boolean; retry?: boolean };
export type DungeonEnemy = DungeonEnemySpec & { hp: number; state: 'patrol' | 'tell' | 'strike' | 'recover' | 'down'; ticks: number; facing: -1 | 1 };
export type DungeonPlayer = { x: number; y: number; vx: number; vy: number; facing: -1 | 1; hp: number; grounded: boolean; attackTicks: number; cooldown: number; invulnerable: number };
export type DungeonEvent = { type: 'jump' | 'swing' | 'hit' | 'hurt' | 'parry' | 'pickup' | 'secret' | 'craft' | 'locked' | 'room' | 'death' | 'retry' | 'escape'; id?: string; text?: string };
/** Only progress between rooms and discoveries is persistent. A retry restores the room's guards. */
export type DungeonProgress = { room: number; collected: string[]; shinai: boolean; armor: boolean; materials: number };
export type DungeonState = DungeonProgress & { tick: number; phase: 'playing' | 'dead' | 'cleared' | 'escaped'; player: DungeonPlayer; enemies: DungeonEnemy[]; checkpoint: number; events: DungeonEvent[] };
export function createDungeon(room = 0, progress?: Partial<DungeonProgress>): DungeonState {
 const at = Math.max(0,Math.min(DUNGEON_ROOMS.length-1,Math.floor(room)));
 return { room:at,collected:[...(progress?.collected??[])],shinai:progress?.shinai??false,armor:progress?.armor??false,materials:progress?.materials??0,tick:0,phase:'playing',checkpoint:at,
  player:{x:24,y:100,vx:0,vy:0,facing:1,hp:DUNGEON_HP,grounded:true,attackTicks:0,cooldown:0,invulnerable:0},
  enemies:DUNGEON_ROOMS[at].enemies.map(enemy=>({...enemy,hp:enemy.kind==='ren'?4:2,state:'patrol',ticks:0,facing:-1})),events:[] };
}
export const dungeonProgress = (state: DungeonState): DungeonProgress => ({ room:state.room,collected:[...state.collected],shinai:state.shinai,armor:state.armor,materials:state.materials });
export const trapActive = (trap: DungeonTrap, tick: number): boolean => ((tick-trap.offset)%trap.period+trap.period)%trap.period < trap.activeTicks;
const overlap = (a: DungeonRect,b: DungeonRect): boolean => a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const near = (p: DungeonPlayer, point: {x:number;y:number}, distance=23): boolean => Math.abs(p.x-point.x)<=distance&&Math.abs(p.y-point.y)<=22;
function hurt(state: DungeonState, amount: number): void {
 if (state.player.invulnerable || state.phase!=='playing') return;
 state.player.hp=Math.max(0,state.player.hp-amount);
 state.player.invulnerable=45;
 state.events.push({type:'hurt'});
 if (!state.player.hp) { state.phase='dead';state.events.push({type:'death'}); }
}
function movePlayer(state: DungeonState,input: DungeonInput,room: DungeonRoom): void {
 const p=state.player;
 p.vx=input.move*(input.block?0.65:RUN_SPEED);
 if (input.move) p.facing=input.move;
 if (input.jump&&p.grounded) {p.vy=JUMP_SPEED;p.grounded=false;state.events.push({type:'jump'});}
 const oldX=p.x;
 p.x=Math.max(0,Math.min(room.width-PLAYER_W,p.x+p.vx));
 for (const platform of room.platforms) {
  if (!overlap({x:p.x,y:p.y,w:PLAYER_W,h:PLAYER_H},platform)) continue;
  if (p.vx>0&&oldX+PLAYER_W<=platform.x) p.x=platform.x-PLAYER_W;
  else if (p.vx<0&&oldX>=platform.x+platform.w) p.x=platform.x+platform.w;
 }
 const oldY=p.y;
 p.vy=Math.min(7,p.vy+GRAVITY);
 p.y+=p.vy;p.grounded=false;
 for (const platform of room.platforms) {
  if (p.x+PLAYER_W<=platform.x||p.x>=platform.x+platform.w) continue;
  if (p.vy>=0&&oldY+PLAYER_H<=platform.y+0.001&&p.y+PLAYER_H>=platform.y) {p.y=platform.y-PLAYER_H;p.vy=0;p.grounded=true;}
  else if(p.vy<0&&oldY>=platform.y+platform.h&&p.y<platform.y+platform.h){p.y=platform.y+platform.h;p.vy=0;}
 }
 if(p.y>170){p.hp=0;state.phase='dead';state.events.push({type:'death'});}
}
function stepEnemies(state: DungeonState,input: DungeonInput): void {
 const p=state.player;
 for(const enemy of state.enemies){
  if(enemy.hp<=0){enemy.state='down';continue;}
  const delta=p.x-enemy.x;
  const level=Math.abs(p.y-enemy.y)<24;
  if(enemy.state==='patrol'){
   enemy.facing=delta<0?-1:1;
   if(Math.abs(delta)<100){
    if(Math.abs(delta)>30)enemy.x+=enemy.facing*(enemy.kind==='ren'?1:0.65);
    else if(level){enemy.state='tell';enemy.ticks=enemy.kind==='ren'?22:30;}
   }
  } else if(enemy.state==='tell'){
   enemy.ticks--;
   if(enemy.ticks<=0){
    enemy.state='strike';enemy.ticks=6;
    const toward=delta*enemy.facing>=-4;
    if(level&&toward&&Math.abs(delta)<40){
     if(input.block&&p.facing===(enemy.x>p.x?1:-1)){
      enemy.state='recover';enemy.ticks=enemy.kind==='ren'?26:36;
      state.events.push({type:'parry',id:enemy.id});
     } else hurt(state,state.armor?1:2);
    }
   }
  } else if(enemy.state==='strike'){
   if(--enemy.ticks<=0){enemy.state='recover';enemy.ticks=enemy.kind==='ren'?24:34;}
  } else if(enemy.state==='recover'&&--enemy.ticks<=0)enemy.state='patrol';
  // The contact tick occurs once during each swing, not every tick of its animation.
  if(p.attackTicks===7&&Math.abs(p.y-enemy.y)<24&&Math.abs(delta)<38&&delta*p.facing<0){
   const behind=delta*enemy.facing<0;
   if(enemy.state==='recover'||behind){
    enemy.hp--;enemy.state=enemy.hp?'recover':'down';enemy.ticks=20;
    state.events.push({type:'hit',id:enemy.id});
   }
  }
 }
}
export function stepDungeon(previous: DungeonState,input: DungeonInput): DungeonState {
 if(previous.phase==='escaped')return previous;
 if(previous.phase==='dead'){
  if(!input.retry)return {...previous,events:[]};
  return {...createDungeon(previous.checkpoint,previous),events:[{type:'retry'}]};
 }
 const state: DungeonState={...previous,tick:previous.tick+1,collected:[...previous.collected],player:{...previous.player},enemies:previous.enemies.map(enemy=>({...enemy})),events:[]};
 const room=DUNGEON_ROOMS[state.room],p=state.player;
 p.attackTicks=Math.max(0,p.attackTicks-1);p.cooldown=Math.max(0,p.cooldown-1);p.invulnerable=Math.max(0,p.invulnerable-1);
 if(input.attack&&state.shinai&&!p.cooldown){p.attackTicks=10;p.cooldown=24;state.events.push({type:'swing'});}
 movePlayer(state,input,room);
 if(state.phase==='dead')return state;
 for(const trap of room.traps)if(trapActive(trap,state.tick)&&overlap({x:p.x,y:p.y,w:PLAYER_W,h:PLAYER_H},trap))hurt(state,state.armor?1:2);
 stepEnemies(state,input);
 if(!state.player.hp)return state;
 if(input.interact){
  for(const pickup of room.pickups){
   if(state.collected.includes(pickup.id)||!near(p,pickup))continue;
   state.collected.push(pickup.id);
   if(pickup.kind==='shinai')state.shinai=true;
   if(pickup.kind==='scrap')state.materials++;
   state.events.push({type:pickup.kind==='egg'?'secret':'pickup',id:pickup.id});
  }
  if(room.bench&&near(p,room.bench)&&!state.armor){
   if(state.materials>=2){state.materials-=2;state.armor=true;state.events.push({type:'craft'});}
   else state.events.push({type:'locked',text:'Two scraps make a practice cuirass. Search the works.'});
  }
  if(near(p,room.exit)){
   const guards=state.enemies.some(enemy=>enemy.hp>0);
   if(guards||!state.shinai||(state.room>=1&&!state.armor))state.events.push({type:'locked',text:guards?'The guard still holds the gate.':!state.shinai?'Find something to defend yourself with.':'Craft armor at the workbench before going on.'});
   else if(state.room===DUNGEON_ROOMS.length-1){state.phase='escaped';state.events.push({type:'escape'});}
   else return {...createDungeon(state.room+1,state),events:[...state.events,{type:'room'}]};
  }
 }
 return state;
}

const record = (value: unknown): value is Record<string,unknown> => typeof value==='object'&&value!==null&&!Array.isArray(value);
const numberIn = (value: unknown,min: number,max: number): value is number => typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const countIn = (value: unknown,max: number): value is number => numberIn(value,0,max)&&Number.isInteger(value);
/** Save data owns no room geometry, enemies or event callbacks: those always come from this module. */
export function parseDungeonState(raw: unknown): DungeonState | null {
 if(!record(raw)||!countIn(raw.room,DUNGEON_ROOMS.length-1)||!countIn(raw.tick,Number.MAX_SAFE_INTEGER)||raw.checkpoint!==raw.room)return null;
 if(!['playing','dead','cleared','escaped'].includes(String(raw.phase))||typeof raw.shinai!=='boolean'||typeof raw.armor!=='boolean'||!countIn(raw.materials,2))return null;
 const pickupIds=DUNGEON_ROOMS.flatMap(room=>room.pickups.map(pickup=>pickup.id));
 if(!Array.isArray(raw.collected)||!raw.collected.every(id=>typeof id==='string'&&pickupIds.includes(id))||new Set(raw.collected).size!==raw.collected.length)return null;
 const room=DUNGEON_ROOMS[raw.room],p=raw.player;
 if(!record(p)||!numberIn(p.x,0,room.width-PLAYER_W)||!numberIn(p.y,-40,200)||!numberIn(p.vx,-RUN_SPEED,RUN_SPEED)||!numberIn(p.vy,JUMP_SPEED,7)||![1,-1].includes(p.facing as number)||!countIn(p.hp,DUNGEON_HP)||typeof p.grounded!=='boolean'||!countIn(p.attackTicks,10)||!countIn(p.cooldown,24)||!countIn(p.invulnerable,45))return null;
 if((raw.phase==='dead')!==(p.hp===0))return null;
 if(!Array.isArray(raw.enemies)||raw.enemies.length!==room.enemies.length)return null;
 const enemies: DungeonEnemy[]=[];
 for(let i=0;i<room.enemies.length;i++){
  const e=raw.enemies[i],spec=room.enemies[i];
  if(!record(e)||e.id!==spec.id||e.kind!==spec.kind||!numberIn(e.x,0,room.width-PLAYER_W)||e.y!==spec.y||!countIn(e.hp,spec.kind==='ren'?4:2)||!['patrol','tell','strike','recover','down'].includes(String(e.state))||!countIn(e.ticks,36)||![1,-1].includes(e.facing as number))return null;
  if((e.state==='down')!==(e.hp===0))return null;
  enemies.push({...spec,x:e.x,hp:e.hp,state:e.state as DungeonEnemy['state'],ticks:e.ticks,facing:e.facing as -1|1});
 }
 return {room:raw.room,tick:raw.tick,checkpoint:raw.room,phase:raw.phase as DungeonState['phase'],collected:[...raw.collected] as string[],shinai:raw.shinai,armor:raw.armor,materials:raw.materials,
  player:{x:p.x,y:p.y,vx:p.vx,vy:p.vy,facing:p.facing as -1|1,hp:p.hp,grounded:p.grounded,attackTicks:p.attackTicks,cooldown:p.cooldown,invulnerable:p.invulnerable},enemies,events:[]};
}
