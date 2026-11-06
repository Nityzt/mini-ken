import { drawLabelAt } from "../art/font.ts";
import { isOpen } from "../progress.ts";
import { drawKendoka, FULL_GEAR } from "../art/kendoka.ts";
import { TEAM_COLORS } from "../art/looks.ts";
import { AKI_COLORS, BO_COLORS, MOMO_COLORS, PALETTE, SENIOR_COLORS, YUI_COLORS } from "../art/palette.ts";
import { drawPresence, drawRankTag } from "../art/presence.ts";
import { drawSprite } from "../art/sprite.ts";
import { TILE, TILE_GRIDS } from "../art/tiles.ts";
import type { TileMap } from "../core/collision.ts";
import { viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { playerColors } from "../characters.ts";
import { currentObjective } from "../objective.ts";
import { DOJOS } from "../world/dojos.ts";
import { askToGrade, showLetter, type Asker } from "../grading.ts";
import { danLabel, hasLetter, personDan, presenceOf, type PersonId } from "../ranks.ts";
import { cupOffer, doorResponse, interactionLabel, lineOffer, senpaiMenu, senseiMenu, talkToMomo, talkToSenpai, talkToSensei } from "./club-story.ts";
import { rest } from "../health.ts";
import { talkToChallenger } from "./challengers.ts";
import { openTopics } from "./chatter.ts";
import { leaveDojo } from "./exit.ts";
import { offerBet } from "./bet-menu.ts";
import { createMenu } from "./choice.ts";
import { createShop } from "./shop.ts";
import { findEgg } from "../money.ts";
import { HELP_OFFER, SCREEN_HINT, SCREEN_LOOK, SCREEN_NEEDS_TRAINING, STORAGE_LOCKED, WAZA_OFFER } from "./content.ts";
import { crowdDrawings, drawNamedChat, rankTagShown } from "./crowd.ts";
import { drawInteractPrompt, drawObjective, drawTopBar } from "./ui.ts";
import type { SenpaiId, Session } from "./curriculum.ts";
import { createDialogue } from "./dialogue.ts";
import { homeArrival, homeVisitor, learnGaze, talkToVisitor, type HomeVisitor, type Talk } from "./visits.ts";
import { CLUB_HALL_ROWS, CLUB_MAP, CLUB_SOLID, clubRows, findTiles } from "./levels.ts";
import { cameraFor, createWalker, drawRoom, drawWalker, tileInFront, touchesTile, updateWalker, type Walker } from "./topdown.ts";

const place = (char: string) => findTiles(CLUB_MAP, char)[0];
const gi = place("G");
const tsuba = place("U");
const screenTile = place("C");

const newWalker = (): Walker => ({ ...createWalker(place("@").col, place("@").row), facing: "down" });

export function createClubScene(): Scene {
  const dialogue = createDialogue();
  const menu = createMenu();
  const shop = createShop();
  let seed = 0;
  let walker = newWalker();
  let tick = 0;
  /** Someone who's finished their business here, but not their sentence. */
  let lingering: HomeVisitor | null = null;

  const visitorHere = (game: Game) => lingering ?? homeVisitor(game.run);
  const rowsFor = (game: Game) =>
    clubRows({ storageOpen: game.run.metSenpai, screenBroken: game.run.screenBroken, momoGuards: game.run.trained && !game.run.momoBeaten, visitor: visitorHere(game) !== null });
  const mapFor = (game: Game): TileMap => ({ rows: rowsFor(game), solid: CLUB_SOLID, tile: TILE });

  const startTraining = (game: Game, session: Session | null) =>
    session
      ? () => {
          game.session = session;
          game.go("training");
        }
      : undefined;
  const talkMomo = (game: Game) => {
    const reply = talkToMomo(game.run);
    if (reply.chats) {
      openTopics(game, menu, dialogue, "momo");
      return;
    }
    game.run = reply.run;
    dialogue.open(reply.lines, reply.fight ? () => game.go("duel") : undefined);
  };
  /** Asking to be sent for grading. If whoever you ask agrees, they test you themselves, or find someone who will. */
  const askAboutGrading = (game: Game, asker: Asker) => {
    if (hasLetter(game.run)) {
      const reply = showLetter(game.run, asker, Math.random());
      game.run = reply.run;
      const { fight } = reply;
      dialogue.open(reply.lines, fight ? () => {
        game.versus = fight;
        game.grading = "verification";
        game.go("duel");
      } : undefined);
      return;
    }
    const { lines, fight } = askToGrade(game.run, asker);
    dialogue.open(lines, fight ? () => {
      game.versus = fight;
      game.grading = "recommendation";
      game.go("duel");
    } : undefined);
  };
  const talkSensei = (game: Game) => {
    const reply = talkToSensei(game.run);
    const { after } = reply;
    if (after) {
      // It's yours once Sensei's said so. Backing out before then means nothing's changed hands.
      dialogue.open(reply.lines, () => {
        game.run = reply.run;
        game.showCards(() => dialogue.open(after, startTraining(game, reply.session)));
      });
      return;
    }
    game.run = reply.run;
    if (!reply.menu) {
      dialogue.open(reply.lines, startTraining(game, reply.session));
      return;
    }
    dialogue.open(reply.lines, () => {
      menu.open(senseiMenu(game.run), (id) => {
        if (id === "line") dialogue.open(lineOffer(game.run), () => game.go("line"));
        else if (id === "waza") dialogue.open(WAZA_OFFER, () => {
          game.session = { kind: "waza" };
          game.go("training");
        });
        else if (id === "help") dialogue.open(HELP_OFFER, () => {
          game.helping = true;
          game.go("line");
        });
        else if (id === "grade") askAboutGrading(game, "sensei");
        else if (id === "talk") openTopics(game, menu, dialogue, "sensei");
        else if (id === "challenge") dialogue.open(talkToChallenger(game.run, "sensei").lines, () => offerBet(menu, game, "sensei", () => {
          game.versus = "sensei";
          game.go("duel");
        }));
      });
    });
  };
  const talkSenpai = (game: Game, senpai: SenpaiId) => {
    const reply = talkToSenpai(game.run, senpai);
    const fight = reply.fight;
    if (!fight) {
      dialogue.open(reply.lines, startTraining(game, reply.session));
      return;
    }
    menu.open(senpaiMenu(game.run), (id) => {
      if (id === "spar") dialogue.open(reply.lines, () => offerBet(menu, game, fight, () => {
        game.versus = fight;
        game.go("duel");
      }));
      else if (id === "talk") openTopics(game, menu, dialogue, senpai);
      else if (id === "grade") askAboutGrading(game, senpai);
    });
  };
  /** Whatever a visitor has to say, and Ren's one point if that's what it leads to. Backing out just means Ren waits. */
  const playTalk = (game: Game, talk: Talk) => {
    game.run = talk.run;
    if (talk.teaches) {
      // Skipping the words doesn't skip the lesson.
      const learn = () => {
        // Ren's done teaching, but they're still standing there until they've said goodbye.
        lingering = homeVisitor(game.run);
        game.run = learnGaze(game.run);
        const gone = () => {
          lingering = null;
        };
        game.showCards(() => {
          if (talk.after) dialogue.open(talk.after, gone, gone);
          else gone();
        });
      };
      dialogue.open(talk.lines, learn, learn);
      return;
    }
    dialogue.open(talk.lines, talk.fight ? () => {
      game.versus = "renVisit";
      game.go("duel");
    } : undefined);
  };
  const tryDoor = (game: Game) => {
    const reply = doorResponse(game.run);
    if (reply.leaves) leaveDojo(game, menu);
    else dialogue.open(reply.lines);
  };

  return {
    busy: () => dialogue.active || menu.active,
    enter(game) {
      seed = Math.floor(Math.random() * 2 ** 31);
      lingering = null;
      // Home's where you get your strength back, however you got here.
      game.run = rest(game.run);
      if (game.wokeUp) {
        game.wokeUp = false;
        walker = newWalker();
      }
      // A fresh run, or coming back in off the road, starts at the front door.
      // Coming back from Momo's fight, there's something to say and you're still standing there.
      const arrival = homeArrival(game.run);
      if (game.message) {
        // Whoever's waiting for you can wait until this has been said.
        const nothing = () => {};
        dialogue.open(game.message, arrival ? () => playTalk(game, arrival) : undefined, arrival ? nothing : undefined);
        game.message = null;
      } else {
        if ((!game.run.metSenpai || game.run.trained) && !game.fromFight) walker = newWalker();
        if (arrival) playTalk(game, arrival);
      }
      // Nobody ends up standing inside someone who's just dropped by.
      const visitorSpot = findTiles(rowsFor(game), "V")[0];
      if (visitorSpot && touchesTile(walker, visitorSpot.col, visitorSpot.row)) walker = newWalker();
      game.debug.club = { screenBroken: game.run.screenBroken };
      game.debug.walker = walker.box;
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
      const rows = rowsFor(game);
      updateWalker(walker, game.input, mapFor(game));
      game.debug.walker = walker.box;

      if (!game.run.gi && touchesTile(walker, gi.col, gi.row)) {
        game.run = { ...game.run, gi: true };
        return;
      }
      if (game.run.screenBroken && !game.run.hasTsuba && touchesTile(walker, tsuba.col, tsuba.row)) {
        game.run = { ...game.run, hasTsuba: true };
        return;
      }

      const front = tileInFront(walker, rows);
      const struck = game.input.wasPressed("men") || game.input.wasPressed("kote") || game.input.wasPressed("do");
      if (front === "C" && struck && game.run.momoBeaten) {
        game.run = { ...game.run, screenBroken: true };
        game.debug.club = { screenBroken: true };
        game.audio.play("break");
        return;
      }
      if (!game.input.wasPressed("confirm")) return;
      if (front === "M") talkMomo(game);
      else if (front === "X") talkSensei(game);
      else if (front === "A") talkSenpai(game, "aki");
      else if (front === "B") talkSenpai(game, "bo");
      else if (front === "Y") talkSenpai(game, "yui");
      else if (front === "V") playTalk(game, talkToVisitor(game.run));
      else if (front === "D") tryDoor(game);
      else if (front === "$") shop.open("pinecone");
      else if (front === "Q") dialogue.open([STORAGE_LOCKED]);
      else if (front === "N") {
        const offer = cupOffer(game.run, "pinecone");
        dialogue.open(offer.lines, offer.enter ? () => {
          game.tournament = null;
          game.go("tournament");
        } : undefined);
      }
      else if (front === "C") dialogue.open([SCREEN_LOOK, game.run.momoBeaten ? SCREEN_HINT : SCREEN_NEEDS_TRAINING]);
      else {
        const egg = findEgg(game.run, "pinecone", front);
        if (egg) {
          game.run = egg.run;
          game.audio.play("secret");
          dialogue.open(egg.lines);
        }
      }
    },
    render(ctx, game) {
      const rows = rowsFor(game);
      // Storage stays out of sight until it's unlocked.
      const cam = cameraFor(walker, game.run.metSenpai ? rows : rows.slice(0, CLUB_HALL_ROWS));
      ctx.fillStyle = PALETTE.K;
      ctx.fillRect(0, 0, viewW, viewH);
      drawRoom(ctx, rows, cam, game.run.trained && isOpen(game.run, "door"));

      // Until storage is unlocked, the hall is all there is, however much the window could show.
      if (!game.run.metSenpai) {
        ctx.fillStyle = PALETTE.K;
        ctx.fillRect(0, CLUB_HALL_ROWS * TILE - cam.y, viewW, viewH);
      } else if (!game.run.gi) {
        drawSprite(ctx, TILE_GRIDS.iconGi, gi.col * TILE - cam.x, gi.row * TILE - cam.y - Math.floor(tick / 20) % 2);
      }
      if (game.run.metSenpai && !game.run.screenBroken) {
        // The space behind the screen stays dark, and a glint rewards looking closely.
        ctx.fillStyle = PALETTE.b;
        ctx.fillRect((screenTile.col + 1) * TILE - cam.x, screenTile.row * TILE - cam.y, 3 * TILE, TILE);
        if (Math.floor(tick / 12) % 8 === 0) {
          ctx.fillStyle = PALETTE.W;
          const gx = screenTile.col * TILE - cam.x + 8;
          const gy = screenTile.row * TILE - cam.y + 8;
          ctx.fillRect(gx - 2, gy, 5, 1);
          ctx.fillRect(gx, gy - 2, 1, 5);
        }
      } else if (game.run.screenBroken && !game.run.hasTsuba) {
        drawSprite(ctx, TILE_GRIDS.tsuba, tsuba.col * TILE - cam.x, tsuba.row * TILE - cam.y - Math.floor(tick / 18) % 2);
      }

      const tags: (() => void)[] = [];
      const person = (char: string, id: PersonId, facing: "down" | "side", gear: typeof FULL_GEAR, colors?: Record<string, string>) => {
        const spot = findTiles(rows, char)[0];
        const x = spot.col * TILE - cam.x;
        const y = spot.row * TILE - 4 - cam.y;
        const dan = personDan(id);
        const near = rankTagShown({ x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y - cam.y }, { x: x + 8, y: y + 16 });
        if (dan > 0 && near) tags.push(() => drawRankTag(ctx, danLabel(dan), x + 8, y - 8, presenceOf(dan) > 0));
        return {
          y: spot.row * TILE,
          draw: () => {
            drawPresence(ctx, x + 8, y + 20, tick, presenceOf(dan), game.reducedMotion);
            drawKendoka(ctx, x, y, facing, 0, gear, { colors });
          },
        };
      };
      const people = [
        person("M", "momo", "down", { ...FULL_GEAR, men: false }, MOMO_COLORS),
        person("X", "sensei", "down", { ...FULL_GEAR, men: false }, SENIOR_COLORS),
        person("A", "aki", "side", FULL_GEAR, AKI_COLORS),
        person("B", "bo", "down", { ...FULL_GEAR, men: false }, BO_COLORS),
        person("Y", "yui", "side", FULL_GEAR, YUI_COLORS),
        ...crowdDrawings(ctx, rows, cam, tick, game.reducedMotion, () => TEAM_COLORS.pinecone!, seed, (draw) => tags.push(draw)),
        { y: walker.box.y - 8, draw: () => drawWalker(ctx, walker, cam, game.run.gear, playerColors(game.run)) },
      ];
      const visitor = visitorHere(game);
      if (visitor) people.push(person("V", visitor === "ren" ? "renVisit" : "raccoon", "down", { ...FULL_GEAR, men: false }, visitor === "ren" ? DOJOS.radish.colors : DOJOS.raccoon.colors));
      people.sort((a, b) => a.y - b.y).forEach((p) => p.draw());
      if (!game.reducedMotion) {
        // The senpai standing near each other talk, too.
        const over = (char: string) => {
          const spot = findTiles(rows, char)[0];
          return { x: spot.col * TILE - cam.x + 8, y: spot.row * TILE - 12 - cam.y };
        };
        tags.push(() => drawNamedChat(ctx, seed, 2, tick, [over("A"), over("B")]));
        tags.push(() => drawNamedChat(ctx, seed, 4, tick, [over("M"), over("Y")]));
      }
      if (!dialogue.active && !menu.active) tags.forEach((tag) => tag());
      if (visitor === "sora" && !game.reducedMotion) {
        const spot = findTiles(rows, "V")[0];
        drawLabelAt(ctx, "z", spot.col * TILE - cam.x + 14 + Math.floor(tick / 30) % 3, spot.row * TILE - cam.y - 2 - Math.floor(tick / 30) % 3, PALETTE.W);
      }

      drawTopBar(ctx, "Pinecone Dojo", game.run);
      if (!dialogue.active && !menu.active) {
        drawObjective(ctx, currentObjective(game.run));
        const label = interactionLabel(tileInFront(walker, rows), "home");
        if (label) drawInteractPrompt(ctx, label, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - cam.y);
      }
      dialogue.render(ctx);
      menu.render(ctx);
      shop.render(ctx, game);
    },
  };
}
