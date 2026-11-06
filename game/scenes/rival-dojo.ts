import { drawKendoka, FULL_GEAR, type Gear, type HeldShinai } from "../art/kendoka.ts";
import { TEAM_COLORS } from "../art/looks.ts";
import { PALETTE } from "../art/palette.ts";
import { drawPresence, drawRankTag } from "../art/presence.ts";
import { TILE } from "../art/tiles.ts";
import type { TileMap } from "../core/collision.ts";
import { viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { playerColors } from "../characters.ts";
import { danLabel, personDan, presenceOf, type PersonId } from "../ranks.ts";
import { arrivalLine, DOJOS, dojoFor, MEMBERS, type DojoId, type OpponentId } from "../world/dojos.ts";
import { talkToChallenger, type ChallengerId } from "./challengers.ts";
import { offerBet } from "./bet-menu.ts";
import { askAway } from "../grading.ts";
import { createMenu } from "./choice.ts";
import { createShop } from "./shop.ts";
import { findEgg } from "../money.ts";
import { crowdDrawings, drawNamedChat, rankTagShown } from "./crowd.ts";
import { challengerMenu, cupOffer, dojoSenseiMenu, headMenu, helperMenu, interactionLabel } from "./club-story.ts";
import { openTopics } from "./chatter.ts";
import { leaveDojo } from "./exit.ts";
import { drawInteractPrompt, drawObjective, drawTopBar } from "./ui.ts";
import { currentObjective } from "../objective.ts";
import { createDialogue } from "./dialogue.ts";
import { findTiles } from "./levels.ts";
import { challengeLines, dojoArrival, dojoVisitor, roomWithVisitor, talkToDojoVisitor } from "./visits.ts";
import { cameraFor, createWalker, drawRoom, drawWalker, tileInFront, touchesTile, updateWalker, type Walker } from "./topdown.ts";
import type { NodeId } from "../world/map.ts";

const dojoHere = (game: Game) => DOJOS[dojoFor(game.run.node)];
const place = (rows: string[], char: string) => findTiles(rows, char)[0];
const visitorHere = (game: Game) => dojoVisitor(game.run, dojoFor(game.run.node));
/** How someone's holding their shinai, if it says something about how they fight. */
const STANCE_HELD: Record<string, HeldShinai> = { jodan: "jodan", nito: "nito" };
const roomHere = (game: Game) => (visitorHere(game) ? roomWithVisitor(dojoHere(game).room) : dojoHere(game).room);

/** Any rival's dojo. Which one it is depends on where you're standing on the map. */
export function createRivalDojoScene(): Scene {
  const dialogue = createDialogue();
  const menu = createMenu();
  const shop = createShop();
  let walker: Walker;
  let tick = 0;
  let seed = 0;
  /** Which dojo the walker is standing in, so you only stay put if you never really left. */
  let walkerAt: NodeId | null = null;

  /** Asking about grading here. Winning earns a letter to take home, which is all anyone here can give you. */
  const askAboutGrading = (game: Game, who: OpponentId) => {
    const { lines, fight } = askAway(game.run, who);
    dialogue.open(lines, fight ? () => {
      game.versus = fight;
      game.grading = "recommendation";
      game.go("duel");
    } : undefined);
  };
  const talkToHelper = (game: Game, who: OpponentId) =>
    menu.open(helperMenu(game.run), (id) => {
      if (id === "talk") openTopics(game, menu, dialogue, who);
      else if (id === "grade") askAboutGrading(game, who);
    });
  /** They all want the same thing before they'll fight: a rank. */
  const challenge = (game: Game, who: ChallengerId) => {
    const reply = talkToChallenger(game.run, who);
    dialogue.open(reply.lines, reply.fight ? () => offerBet(menu, game, who, () => {
      game.versus = who;
      game.go("duel");
    }) : undefined);
  };

  return {
    busy: () => dialogue.active || menu.active,
    enter(game) {
      seed = Math.floor(Math.random() * 2 ** 31);
      const dojo = dojoHere(game);
      const start = place(dojo.room, "@");
      // Back from a match, you're still standing where you started it.
      const stayed = game.fromFight && walkerAt === game.run.node;
      if (!stayed) walker = createWalker(start.col, start.row);
      walkerAt = game.run.node;
      // Whoever's next has come to have a look at you.
      const arrival = dojoArrival(game.run, dojoFor(game.run.node));
      const meetThem = () => {
        if (!arrival) return;
        game.run = arrival.run;
        dialogue.open(arrival.lines);
      };
      if (game.message) {
        // X skips what's being said, and whoever's waiting is still there next time.
        dialogue.open(game.message, arrival ? meetThem : undefined, arrival ? () => {} : undefined);
        game.message = null;
      } else if (arrival) meetThem();
      else if (!stayed) dialogue.open([arrivalLine(dojo, Math.random())]);
      // Nobody ends up standing inside someone who's just dropped by.
      const visitorSpot = findTiles(roomHere(game), "V")[0];
      if (visitorSpot && touchesTile(walker, visitorSpot.col, visitorSpot.row)) walker = createWalker(start.col, start.row);
    },
    update(game) {
      tick++;
      game.debug.talking = dialogue.active || menu.active || shop.active;
      if (dialogue.active) {
        dialogue.update(game.input);
        return;
      }
      if (menu.active) {
        menu.update(game.input);
        return;
      }
      if (shop.active) {
        shop.update(game);
        return;
      }
      const dojo = dojoHere(game);
      const room = roomHere(game);
      const map: TileMap = { rows: room, solid: dojo.solid, tile: TILE };
      updateWalker(walker, game.input, map);
      game.debug.walker = walker.box;
      const front = tileInFront(walker, room);
      if (!game.input.wasPressed("confirm")) return;
      if (front === "D") leaveDojo(game, menu);
      else if (front === "R") {
        const head = dojoFor(game.run.node);
        menu.open(headMenu(game.run), (id) => {
          if (id === "challenge") offerBet(menu, game, head, () => dialogue.open(challengeLines(game.run, head), () => game.go("duel")));
          else if (id === "talk") openTopics(game, menu, dialogue, head);
          else if (id === "grade") askAboutGrading(game, head);
        });
      }
      else if (front === "V") dialogue.open(talkToDojoVisitor(game.run, visitorHere(game)!));
      else if (front === "X") {
        menu.open(dojoSenseiMenu(game.run), (id) => {
          if (id === "talk") openTopics(game, menu, dialogue, dojo.sensei.id);
          else if (id === "challenge") challenge(game, dojo.sensei.id);
        });
      }
      else if (front === "G") talkToHelper(game, dojo.helperIds.G);
      else if (front === "E") talkToHelper(game, dojo.helperIds.E);
      else if (front === "J" && dojo.challenger) {
        const who = dojo.challenger;
        menu.open(challengerMenu(), (id) => {
          if (id === "challenge") challenge(game, who);
          else if (id === "talk") openTopics(game, menu, dialogue, who);
        });
      }
      else if (front === "$") shop.open(dojoFor(game.run.node));
      else if (front === "N") {
        const offer = cupOffer(game.run, dojoFor(game.run.node) as DojoId);
        dialogue.open(offer.lines, offer.enter ? () => {
          game.tournament = null;
          game.go("tournament");
        } : undefined);
      } else {
        const egg = findEgg(game.run, dojoFor(game.run.node), front);
        if (egg) {
          game.run = egg.run;
          game.audio.play("secret");
          dialogue.open(egg.lines);
        }
      }
    },
    render(ctx, game) {
      const dojo = dojoHere(game);
      const { colors } = dojo;
      const room = roomHere(game);
      const cam = cameraFor(walker, room);
      ctx.fillStyle = PALETTE.K;
      ctx.fillRect(0, 0, viewW, viewH);
      drawRoom(ctx, room, cam, true, dojoFor(game.run.node));
      const tags: (() => void)[] = [];
      const person = (char: string, id: PersonId, facing: "down" | "side", gear: Gear, look: { colors?: Record<string, string>; flip?: boolean; held?: HeldShinai }) => {
        const spot = place(room, char);
        const x = spot.col * TILE - cam.x;
        const y = spot.row * TILE - 4 - cam.y;
        const dan = personDan(id);
        const near = rankTagShown({ x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y - cam.y }, { x: x + 8, y: y + 16 });
        if (dan > 0 && near) tags.push(() => drawRankTag(ctx, danLabel(dan), x + 8, y - 8, presenceOf(dan) > 0));
        return {
          y: spot.row * TILE,
          draw: () => {
            drawPresence(ctx, x + 8, y + 20, tick, presenceOf(dan), game.reducedMotion);
            drawKendoka(ctx, x, y, facing, 0, gear, look);
          },
        };
      };
      const people = [
        person("X", dojo.sensei.id, "down", { ...FULL_GEAR, men: false }, { colors: dojo.sensei.colors }),
        person("R", dojoFor(game.run.node), "down", FULL_GEAR, { colors }),
        person("G", dojo.helperIds.G, "side", { ...FULL_GEAR, men: false, shinai: false }, { colors }),
        person("E", dojo.helperIds.E, "side", { ...FULL_GEAR, men: false, kote: false }, { colors, flip: true }),
        ...crowdDrawings(ctx, room, cam, tick, game.reducedMotion, () => TEAM_COLORS[dojoFor(game.run.node)]!, seed, (draw) => tags.push(draw)),
        { y: walker.box.y - 8, draw: () => drawWalker(ctx, walker, cam, game.run.gear, playerColors(game.run)) },
      ];
      if (dojo.challenger) {
        const them = MEMBERS[dojo.challenger];
        people.push(person("J", dojo.challenger, "side", FULL_GEAR, { colors: them.colors, flip: true, held: STANCE_HELD[them.kamae ?? ""] }));
      }
      const visitor = visitorHere(game);
      if (visitor) people.push(person("V", visitor, "side", { ...FULL_GEAR, men: false }, { colors: DOJOS[visitor].colors, flip: true }));
      people.sort((a, b) => a.y - b.y).forEach((who) => who.draw());
      if (!game.reducedMotion) {
        const over = (char: string) => ({ x: place(room, char).col * TILE - cam.x + 8, y: place(room, char).row * TILE - 12 - cam.y });
        tags.push(() => drawNamedChat(ctx, seed, 2, tick, [over("G"), over("E")]));
      }
      if (!dialogue.active && !menu.active) tags.forEach((tag) => tag());
      drawTopBar(ctx, dojo.name, game.run);
      if (!dialogue.active && !menu.active) {
        drawObjective(ctx, currentObjective(game.run));
        const label = interactionLabel(tileInFront(walker, room), "rival");
        if (label) drawInteractPrompt(ctx, label, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - cam.y);
      }
      dialogue.render(ctx);
      menu.render(ctx);
      shop.render(ctx, game);
    },
  };
}
