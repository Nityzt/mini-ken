import test from 'node:test';
import assert from 'node:assert/strict';
import { playerColors } from '../characters.ts';
import { createRunState } from '../run-state.ts';
import { equip, EQUIPMENT } from '../equipment.ts';
import { drawKendoka } from './kendoka.ts';
import { drawFighter } from './duel-sprites.ts';

type Canvas = { pixels: Map<string,string>; width:number; height:number; getContext: () => PixelContext; ctx: PixelContext };
type PixelContext = { fillStyle:string; fillRect(x:number,y:number,w:number,h:number):void; drawImage(source:Canvas,x:number,y:number):void };
function canvas(): Canvas {
 const pixels = new Map<string,string>();
 const ctx: PixelContext = { fillStyle: '', fillRect(x:number,y:number,w:number,h:number) { for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) pixels.set(`${x+dx},${y+dy}`,this.fillStyle); }, drawImage(source: ReturnType<typeof canvas>,x:number,y:number) { for(const [key,color] of source.pixels) { const [dx,dy]=key.split(',').map(Number); pixels.set(`${x+dx},${y+dy}`,color); } } };
 return { pixels, width:0, height:0, getContext: () => ctx, ctx };
}

test('walking and dueling keep the colors of two equipped armor pieces separate', () => {
 const original = (globalThis as {document?: unknown}).document;
 (globalThis as {document?: unknown}).document = { createElement: canvas };
 try {
  const run = { ...createRunState(), gi:true, owned:['blossomTare','forgeDo'], gear:{shinai:true,tare:true,do:true,men:true,kote:true} };
  const both = equip(equip(run,'blossomTare'),'forgeDo');
  const colors = playerColors(both);
  const walking = canvas();
  drawKendoka(walking.ctx as unknown as CanvasRenderingContext2D,0,0,'down',0,both.gear,{colors});
  const duel = canvas();
  drawFighter(duel.ctx as unknown as CanvasRenderingContext2D,16,40,'guard','player',0,both.gear,{colors,showRibbon:false});
  for(const [name,target] of [['walking',walking],['duel',duel]] as const) {
   const rendered = new Set(target.pixels.values());
   assert.ok(rendered.has(EQUIPMENT.blossomTare.colors!.I), `${name}: blossom tare stays pink with a copper do`);
   assert.ok(rendered.has(EQUIPMENT.forgeDo.colors!.I), `${name}: forge do stays copper with a pink tare`);
  }
 } finally { (globalThis as {document?:unknown}).document = original; }
});
