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
import { arrivalLine, DOJOS, dojoFor, MEMBERS, type OpponentId } from "../world/dojos.ts";
import { cupAt } from "../world/tournament.ts";
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
import { figureAt, speakersIn, type Figure } from "./bubble.ts";
import { createDialogue } from "./dialogue.ts";
import { createEntrance, createStride, createVisit, facingToward, personAhead, type Visit } from "./moves.ts";
import { findTiles } from "./levels.ts";
import { challengeLines, dojoArrival, dojoVisitor, roomWithVisitor, talkToDojoVisitor } from "./visits.ts";
import { cameraFor, createWalker, drawRoom, drawWalker, tileInFront, touchesTile, updateWalker, type Walker } from "./topdown.ts";
import type { NodeId } from "../world/map.ts";
import { walkingGear } from "../run-state.ts";

const dojoHere = (game: Game) => DOJOS[dojoFor(game.run.node)];
const place = (rows: string[], char: string) => findTiles(rows, char)[0];
const visitorHere = (game: Game) => dojoVisitor(game.run, dojoFor(game.run.node));
/** How someone's holding their shinai, if it says something about how they fight. */
const STANCE_HELD: Record<string, HeldShinai> = { jodan: "jodan", nito: "nito" };

/** Who can be walked up to and talked to. */
const PEOPLE = "RXGEJV";

/** Any rival's dojo. Which one it is depends on where you're standing on the map. */
export function createRivalDojoScene(nameOf: () => string): Scene {
  const dialogue = createDialogue(nameOf);
  const menu = createMenu();
  const shop = createShop();
  let walker: Walker;
  let tick = 0;
  let seed = 0;
  /** Which dojo the walker is standing in, so you only stay put if you never really left. */
  let walkerAt: NodeId | null = null;
  /** You coming in through the door, and what happens when you're in. */
  let entrance: { update(): boolean } | null = null;
  let afterEntrance: (() => void) | null = null;
  /** You going over to someone, and who it is. */
  let stride: { update(walker: Walker, map: TileMap): boolean; char: string } | null = null;
  let talkingTo: string | null = null;
  /** Whoever's next, walking over to have a word, and what it is they've got to say. */
  let visit: Visit | null = null;
  let visitLines: string[] | null = null;
  /** Whoever's next hasn't come through the door yet, so they aren't standing around in here. */
  let arriving = false;
  const roomHere = (game: Game) => (visitorHere(game) && !arriving ? roomWithVisitor(dojoHere(game).room) : dojoHere(game).room);

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
    busy: () => dialogue.active || menu.active || shop.active,
    enter(game) {
      seed = Math.floor(Math.random() * 2 ** 31);
      const dojo = dojoHere(game);
      const start = place(dojo.room, "@");
      entrance = null;
      afterEntrance = null;
      stride = null;
      talkingTo = null;
      visit = null;
      visitLines = null;
      arriving = false;
      // Back from a match, you're still standing where you started it.
      const stayed = game.fromFight && walkerAt === game.run.node;
      if (!stayed) walker = createWalker(start.col, start.row);
      walkerAt = game.run.node;
      // Whoever's next has come to have a look at you.
      const arrival = dojoArrival(game.run, dojoFor(game.run.node));
      const meetThem = () => {
        if (!arrival) return;
        arriving = false;
        game.run = arrival.run;
        // They come in by the door, and over to you.
        const door = place(dojo.room, "D");
        visit = createVisit({ rows: roomHere(game).map((row) => row.replace("V", ".")), solid: dojo.solid, start: door, door, player: walker });
        visitLines = arrival.lines;
      };
      if (game.message) {
        arriving = !!arrival;
        // X skips what's being said, and whoever's waiting is still there next time.
        dialogue.open(game.message, arrival ? meetThem : undefined, arrival ? () => {
          arriving = false;
        } : undefined);
        game.message = null;
      } else if (arrival) meetThem();
      else if (!stayed) {
        entrance = createEntrance(walker, place(dojo.room, "D"), start, { rows: dojo.room, solid: "", tile: TILE });
        afterEntrance = () => dialogue.open([arrivalLine(dojo, Math.random())]);
      }
      // Nobody ends up standing inside someone who's just dropped by.
      const visitorSpot = visitorHere(game) && findTiles(roomWithVisitor(dojo.room), "V")[0];
      if (visitorSpot && touchesTile(walker, visitorSpot.col, visitorSpot.row)) walker = createWalker(start.col, start.row);
    },
    update(game) {
      tick++;
      game.debug.talking = dialogue.active || menu.active || shop.active;
      if (dialogue.active) {
        dialogue.update(game.input, game.audio);
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
      if (entrance) {
        if (entrance.update()) {
          entrance = null;
          const next = afterEntrance;
          afterEntrance = null;
          next?.();
        }
        game.debug.walker = walker.box;
        return;
      }
      if (visit) {
        const before = visit.phase;
        visit.update(walker);
        if (before === "coming" && visit.phase === "talking") {
          const lines = visitLines;
          visitLines = null;
          if (lines) dialogue.open(lines);
          return;
        }
        // Said their piece, so they go and stand where they can watch.
        if (visit.phase === "talking") visit.leave(findTiles(room, "V")[0] ?? place(room, "D"));
        if (visit.done) visit = null;
        else if (visit.blocking) return;
      }
      if (stride) {
        if (stride.update(walker, map)) {
          const { char } = stride;
          stride = null;
          talkTo(game, char);
        }
        game.debug.walker = walker.box;
        return;
      }
      talkingTo = null;
      updateWalker(walker, game.input, map);
      game.debug.walker = walker.box;
      const front = tileInFront(walker, room);
      if (!game.input.wasPressed("confirm")) return;
      const ahead = personAhead(walker, room, dojo.solid, PEOPLE);
      if (ahead) {
        stride = { ...createStride(walker, ahead.stand), char: ahead.char };
        talkingTo = ahead.char;
        return;
      }
      if (front === "D") leaveDojo(game, menu);
      else if (front === "$") shop.open(dojoFor(game.run.node));
      else if (front === "N") {
        const cup = cupAt(game.run.node);
        if (!cup || cup === "grand") return;
        const offer = cupOffer(game.run, cup);
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
      renderRoom(ctx, game);
    },
  };

  function talkTo(game: Game, char: string): void {
    const dojo = dojoHere(game);
    if (char === "R") {
        const head = dojoFor(game.run.node);
        menu.open(headMenu(game.run), (id) => {
          if (id === "challenge") offerBet(menu, game, head, () => dialogue.open(challengeLines(game.run, head), () => game.go("duel")));
          else if (id === "talk") openTopics(game, menu, dialogue, head);
          else if (id === "grade") askAboutGrading(game, head);
        });
      }
    else if (char === "V") dialogue.open(talkToDojoVisitor(game.run, visitorHere(game)!));
    else if (char === "X") {
        menu.open(dojoSenseiMenu(game.run), (id) => {
          if (id === "talk") openTopics(game, menu, dialogue, dojo.sensei.id);
          else if (id === "challenge") challenge(game, dojo.sensei.id);
        });
      }
    else if (char === "G") talkToHelper(game, dojo.helperIds.G);
    else if (char === "E") talkToHelper(game, dojo.helperIds.E);
    else if (char === "J" && dojo.challenger) {
        const who = dojo.challenger;
        menu.open(challengerMenu(), (id) => {
          if (id === "challenge") challenge(game, who);
          else if (id === "talk") openTopics(game, menu, dialogue, who);
        });
      }
  }

  function renderRoom(ctx: CanvasRenderingContext2D, game: Game): void {
      const dojo = dojoHere(game);
      const { colors } = dojo;
      const room = roomHere(game);
      const cam = cameraFor(walker, room);
      ctx.fillStyle = PALETTE.K;
      ctx.fillRect(0, 0, viewW, viewH);
      drawRoom(ctx, room, cam, true, dojoFor(game.run.node));
      const tags: (() => void)[] = [];
      const you: Figure = figureAt(ctx, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - 12 - cam.y, walker.box.y + 8 - cam.y);
      const figures: Record<string, Figure | undefined> = {};
      const person = (char: string, id: PersonId, standing: "down" | "side", gear: Gear, look: { colors?: Record<string, string>; flip?: boolean; held?: HeldShinai }) => {
        const spot = place(room, char);
        const x = spot.col * TILE - cam.x;
        const y = spot.row * TILE - 4 - cam.y;
        figures[char] = figureAt(ctx, x + 8, y, y + 20);
        // Whoever you're talking to looks at you.
        const turned = talkingTo === char
          ? facingToward({ x: x + 8, y: y + 16 }, { x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y + walker.box.h / 2 - cam.y })
          : { facing: standing, flip: look.flip };
        const dan = personDan(id);
        const near = rankTagShown({ x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y - cam.y }, { x: x + 8, y: y + 16 });
        if (dan > 0 && near) tags.push(() => drawRankTag(ctx, danLabel(dan), x + 8, y - 8, presenceOf(dan) > 0));
        return {
          y: spot.row * TILE,
          draw: () => {
            drawPresence(ctx, x + 8, y + 20, tick, presenceOf(dan), game.reducedMotion);
            drawKendoka(ctx, x, y, turned.facing, 0, gear, { ...look, flip: turned.flip });
          },
        };
      };
      const people = [
        person("X", dojo.sensei.id, "down", { ...FULL_GEAR, men: false }, { colors: dojo.sensei.colors }),
        person("R", dojoFor(game.run.node), "down", FULL_GEAR, { colors }),
        person("G", dojo.helperIds.G, "side", { ...FULL_GEAR, men: false, shinai: false }, { colors }),
        person("E", dojo.helperIds.E, "side", { ...FULL_GEAR, men: false, kote: false }, { colors, flip: true }),
        ...crowdDrawings(ctx, room, cam, tick, game.reducedMotion, () => TEAM_COLORS[dojoFor(game.run.node)]!, seed, (draw) => tags.push(draw)),
        { y: walker.box.y - 8, draw: () => drawWalker(ctx, walker, cam, walkingGear(game.run), playerColors(game.run)) },
      ];
      if (dojo.challenger) {
        const them = MEMBERS[dojo.challenger];
        people.push(person("J", dojo.challenger, "side", FULL_GEAR, { colors: them.colors, flip: true, held: STANCE_HELD[them.kamae ?? ""] }));
      }
      const visitor = arriving ? null : visitorHere(game);
      if (visit && visitor) {
        const { walker: comer } = visit;
        figures.V = figureAt(ctx, comer.box.x + comer.box.w / 2 - cam.x, comer.box.y - 12 - cam.y, comer.box.y + 8 - cam.y);
        people.push({ y: comer.box.y - 8, draw: () => drawWalker(ctx, comer, cam, { ...FULL_GEAR, men: false }, DOJOS[visitor].colors) });
      } else if (visitor) people.push(person("V", visitor, "side", { ...FULL_GEAR, men: false }, { colors: DOJOS[visitor].colors, flip: true }));
      people.sort((a, b) => a.y - b.y).forEach((who) => who.draw());
      if (!game.reducedMotion) {
        const over = (char: string) => ({ x: place(room, char).col * TILE - cam.x + 8, y: place(room, char).row * TILE - 12 - cam.y });
        tags.push(() => drawNamedChat(ctx, seed, 2, tick, [over("G"), over("E")]));
      }
      if (!dialogue.active && !menu.active) tags.forEach((tag) => tag());
      drawTopBar(ctx, dojo.name, game.run);
      if (!dialogue.active && !menu.active) {
        drawObjective(ctx, currentObjective(game.run));
        const label = interactionLabel(personAhead(walker, room, dojo.solid, PEOPLE)?.char ?? tileInFront(walker, room), "rival");
        if (label) drawInteractPrompt(ctx, label, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - cam.y);
      }
      // Everybody here goes by a name their own line can be matched to.
      const speakers: Record<string, string> = { [dojo.rival]: "R", [`Sensei ${dojo.sensei.name}`]: "X", Sensei: "X", [MEMBERS[dojo.helperIds.G].rival]: "G", [MEMBERS[dojo.helperIds.E].rival]: "E" };
      if (dojo.challenger) speakers[MEMBERS[dojo.challenger].rival] = "J";
      if (visitor) speakers[DOJOS[visitor].rival] = "V";
      dialogue.render(ctx, speakersIn(figures, speakers, you, talkingTo));
      menu.render(ctx);
      shop.render(ctx, game);
  }
}
