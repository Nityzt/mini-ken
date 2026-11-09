import { keyLabel } from "../core/key-labels.ts";
import { drawLabelAt } from "../art/font.ts";
import { isOpen } from "../progress.ts";
import { drawKendoka, FULL_GEAR, type Gear } from "../art/kendoka.ts";
import { lookOf, TEAM_COLORS } from "../art/looks.ts";
import { AKI_COLORS, BO_COLORS, MOMO_COLORS, PALETTE, SENIOR_COLORS, YUI_COLORS } from "../art/palette.ts";
import { drawPresence, drawRankTag } from "../art/presence.ts";
import { drawSprite } from "../art/sprite.ts";
import { TILE, TILE_GRIDS } from "../art/tiles.ts";
import type { TileMap } from "../core/collision.ts";
import { viewH, viewW } from "../core/scale.ts";
import type { Game, Scene } from "../core/scene.ts";
import { playerColors } from "../characters.ts";
import { currentObjective } from "../objective.ts";
import { DOJOS, opponentById } from "../world/dojos.ts";
import { askToGrade, showLetter, type Asker } from "../grading.ts";
import { hasLetter, personDan, presenceOf, type PersonId } from "../ranks.ts";
import { answerOffer, answerWhy, cupOffer, doorResponse, interactionLabel, kirikaeshiOffer, lineOffer, senpaiMenu, senseiMenu, talkToMomo, talkToSenpai, talkToSensei } from "./club-story.ts";
import { rest } from "../health.ts";
import { talkToChallenger } from "./challengers.ts";
import { openTopics } from "./chatter.ts";
import { leaveDojo } from "./exit.ts";
import { offerBet } from "./bet-menu.ts";
import { createMenu } from "./choice.ts";
import { createShop } from "./shop.ts";
import { findEgg } from "../money.ts";
import { HELP_OFFER, MOMO_AT_DOOR, MOMO_STORAGE_OPEN, OFFER_OPTIONS, SCREEN_HINT, SCREEN_LOOK, SCREEN_NEEDS_TRAINING, SCREEN_NO_SHINAI, STORAGE_LOCKED, WAZA_OFFER, WHY_OPTIONS } from "./content.ts";
import { crowdDrawings, drawNamedChat, rankTagShown } from "./crowd.ts";
import { drawInteractPrompt, drawObjective, drawTopBar } from "./ui.ts";
import type { SenpaiId, Session } from "./curriculum.ts";
import { figureAt, speakersIn, type Figure } from "./bubble.ts";
import { createDialogue } from "./dialogue.ts";
import { createEntrance, createStride, createVisit, dressingAt, facingToward, gainedGear, personAhead, type Visit } from "./moves.ts";
import { homeArrival, homeVisitor, learnGaze, talkToVisitor, type HomeVisitor, type Talk } from "./visits.ts";
import { CLUB_HALL_ROWS, CLUB_MAP, CLUB_SOLID, clubRows, findTiles } from "./levels.ts";
import { createEscort, tileOf, type Escort, type Tile } from "./club-intro.ts";
import { cameraFor, createWalker, drawClothPuffs, drawRoom, drawWalker, tileInFront, touchesTile, updateWalker, type Walker } from "./topdown.ts";
import { doorWelcome } from "./welcome.ts";
import { walkingGear, type RunState } from "../run-state.ts";

const place = (char: string) => findTiles(CLUB_MAP, char)[0];
const gi = place("G");
const tsuba = place("U");
const screenTile = place("C");
const storageDoor = place("Q");

/** Who can be walked up to and talked to. */
const PEOPLE = "MXABYVZ";
const SPEAKERS: Record<string, string> = { "Senpai Momo": "M", Momo: "M", "Sensei Kuma": "X", Sensei: "X", Aki: "A", Bo: "B", Yui: "Y", Ren: "V", Sora: "V", Nao: "Z" };
type Clothes = { gi: boolean; gear: Gear };
type Dressing = { tick: number; before: Clothes; after: Clothes; held: string | null; sounded: boolean; then: () => void };
const HELD_ICON: Partial<Record<keyof Gear, string>> = { do: "iconDo", men: "iconMen", kote: "iconKote", shinai: "iconShinai" };

const newWalker = (): Walker => ({ ...createWalker(place("@").col, place("@").row), facing: "down" });

/** The storage door rattles in its frame, then slides aside to show the room behind it. */
function drawStorageDoor(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }, door: { slide: number; shake: number }): void {
  const options = { colors: lookOf("pinecone").room };
  const x = storageDoor.col * TILE - cam.x;
  const y = storageDoor.row * TILE - cam.y;
  drawSprite(ctx, TILE_GRIDS.doorOpen, x, y, options);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, TILE, TILE);
  ctx.clip();
  drawSprite(ctx, TILE_GRIDS.doorClosed, x - Math.round(door.slide * TILE) + door.shake, y, options);
  ctx.restore();
}

export function createClubScene(nameOf: () => string): Scene {
  const dialogue = createDialogue(nameOf);
  const menu = createMenu();
  const shop = createShop();
  let seed = 0;
  let walker = newWalker();
  let tick = 0;
  /** Someone who's finished their business here, but not their sentence. */
  let lingering: HomeVisitor | null = null;
  /** Momo showing you to the storage room, for as long as that takes. */
  let escort: Escort | null = null;
  /** You coming in through the door, and what happens when you're in. */
  let entrance: { update(): boolean } | null = null;
  let afterEntrance: (() => void) | null = null;
  /** You going over to someone, and who it is. */
  let stride: { update(walker: Walker, map: TileMap): boolean; char: string } | null = null;
  /** Who you're talking to, so they can look at you. */
  let talkingTo: string | null = null;
  /** Someone walking over to you, and what they've come to say. */
  let visit: Visit | null = null;
  let visitTalk: Talk | null = null;
  /** Someone's on their way but hasn't come through the door yet, so they aren't standing around in here. */
  let arriving = false;
  /** Where whoever you're fighting was standing, because a match doesn't move anybody. */
  let foughtFrom: Tile | null = null;
  let dressing: Dressing | null = null;
  /** What you've actually got on, so anything new can be put on where people can see. */
  let worn: Gear | null = null;

  const visitorHere = (game: Game) => (arriving ? null : lingering ?? homeVisitor(game.run));
  const rowsFor = (game: Game) => {
    const rows = clubRows({ storageOpen: game.run.metSenpai, screenBroken: game.run.screenBroken, momoGuards: game.run.trained && !game.run.momoBeaten, visitor: visitorHere(game) !== null });
    // Momo's out walking, so her usual spot is empty.
    return escort ? rows.map((row) => row.replace("M", ".")) : rows;
  };
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
    if (reply.escort) {
      dialogue.open(reply.lines, () => startEscort(game));
      return;
    }
    dialogue.open(reply.lines, reply.fight ? () => game.go("duel") : undefined);
  };
  /** Momo walks you to the storage room, opens the door, and tells you what to do with what's inside. */
  const startEscort = (game: Game) => {
    const home = findTiles(rowsFor(game), "M")[0];
    // Nothing the player does can back out of a line with nowhere to go, so each ends the same way whether or not it was skipped.
    const carryOn = () => escort?.proceed();
    const rows = rowsFor(game).map((row) => row.replace("M", "."));
    escort = createEscort({
      rows,
      solid: CLUB_SOLID,
      player: walker,
      home,
      door: storageDoor,
      events: {
        arrived: () => dialogue.open(MOMO_AT_DOOR, carryOn, carryOn),
        opened: () => {
          // The door's open now, and the storage room with it.
          game.run = { ...game.run, metSenpai: true };
          dialogue.open(MOMO_STORAGE_OPEN, carryOn, carryOn);
        },
        sound: (name) => game.audio.play(name),
      },
    });
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
  /** Getting changed, where people can see. `then` happens once you're done. */
  const putOn = (game: Game, after: Clothes, then: () => void, held?: string) => {
    const before: Clothes = { gi: game.run.gi, gear: worn ?? walkingGear(game.run) };
    const piece = (Object.keys(HELD_ICON) as (keyof Gear)[]).find((p) => after.gear[p] && !before.gear[p]);
    dressing = { tick: 0, before, after, held: held ?? (piece ? HELD_ICON[piece]! : null), sounded: false, then };
    worn = after.gear;
  };
  /** Somebody walks over to you, says their piece, and goes on their way. */
  const comeOver = (game: Game, talk: Talk, from?: { col: number; row: number }) => {
    const rows = rowsFor(game).map((row) => row.replace("V", "."));
    const door = place("D");
    visit = createVisit({ rows, solid: CLUB_SOLID, start: from ?? door, door, player: walker });
    visitTalk = talk;
  };
  /** It's yours once Sensei's said so. Backing out before then means nothing's changed hands. */
  const handOver = (game: Game, reply: { lines: string[]; after?: string[]; run: RunState; session: Session | null }, after: string[]) => {
    dialogue.open(reply.lines, () => {
      game.run = reply.run;
      game.showCards(() => {
        const next = () => dialogue.open(after, startTraining(game, reply.session));
        if (worn && gainedGear(worn, walkingGear(game.run))) putOn(game, { gi: game.run.gi, gear: walkingGear(game.run) }, next);
        else next();
      });
    });
  };
  /** Why you've come, and then whether you'll take the shinai. X just walks away, and Sensei asks again next time. */
  const askSensei = (game: Game, ask: "why" | "offer") => {
    menu.open(ask === "why" ? WHY_OPTIONS : OFFER_OPTIONS, (id) => {
      if (ask === "why") {
        const answer = answerWhy(game.run, id);
        game.run = answer.run;
        dialogue.open(answer.lines, () => askSensei(game, "offer"));
        return;
      }
      const answer = answerOffer(game.run, id);
      if (answer.after) handOver(game, answer, answer.after);
      else dialogue.open(answer.lines);
    });
  };
  const talkSensei = (game: Game) => {
    const reply = talkToSensei(game.run);
    if (reply.after) {
      handOver(game, reply, reply.after);
      return;
    }
    if (reply.ask) {
      dialogue.open(reply.lines, () => askSensei(game, reply.ask!));
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
        else if (id === "kirikaeshi") dialogue.open(kirikaeshiOffer(game.run), () => game.go("kirikaeshi"));
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
          // Ren's done here, and goes back out the way they came.
          const spot = findTiles(rowsFor(game), "V")[0];
          lingering = null;
          if (!visit && spot) visit = createVisit({ rows: rowsFor(game), solid: CLUB_SOLID, start: spot, door: place("D"), player: walker, alreadyHere: true });
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
      foughtFrom = visit ? tileOf(visit.walker) : findTiles(rowsFor(game), "V")[0];
      game.versus = "renVisit";
      game.go("duel");
    } : undefined);
  };
  const talkTo = (game: Game, char: string) => {
    if (char === "Z") dialogue.open(["Nao: Momo is on the left side of the hall. Walk up and press E to talk to her."]);
    else if (char === "M") talkMomo(game);
    else if (char === "X") talkSensei(game);
    else if (char === "A") talkSenpai(game, "aki");
    else if (char === "B") talkSenpai(game, "bo");
    else if (char === "Y") talkSenpai(game, "yui");
    else if (char === "V") playTalk(game, talkToVisitor(game.run));
  };
  const tryDoor = (game: Game) => {
    const reply = doorResponse(game.run);
    if (reply.leaves) leaveDojo(game, menu);
    else dialogue.open(reply.lines);
  };

  return {
    busy: () => dialogue.active || menu.active || shop.active,
    enter(game) {
      seed = Math.floor(Math.random() * 2 ** 31);
      lingering = null;
      escort = null;
      entrance = null;
      afterEntrance = null;
      stride = null;
      talkingTo = null;
      visit = null;
      visitTalk = null;
      arriving = false;
      dressing = null;
      worn ??= walkingGear(game.run);
      // Home's where you get your strength back, however you got here.
      game.run = rest(game.run);
      // Back from a drill or a match started here, you're standing (and facing) where you were. Arriving any other way,
      // or coming round after a knockout, starts you back near the door.
      if (game.wokeUp || !game.returning) walker = newWalker();
      game.wokeUp = false;
      // Nobody ends up standing inside someone who's just dropped by.
      const visitorSpot = findTiles(rowsFor(game), "V")[0];
      if (visitorSpot && touchesTile(walker, visitorSpot.col, visitorSpot.row)) walker = newWalker();
      // A fresh run, or coming back in off the road, starts at the front door.
      // Coming back from Momo's fight, there's something to say and you're still standing there.
      const arrival = homeArrival(game.run);
      // Whoever's just fought you is still right where they were, and picks up from there.
      const fought = game.returning ? foughtFrom : null;
      foughtFrom = null;
      if (fought) visit = createVisit({ rows: rowsFor(game).map((row) => row.replace("V", ".")), solid: CLUB_SOLID, start: fought, door: place("D"), player: walker, alreadyHere: true });
      // Anyone else comes in by the door.
      arriving = !!arrival && !fought;
      const greet = () => {
        if (!arrival) return;
        arriving = false;
        if (fought) playTalk(game, arrival);
        else comeOver(game, arrival);
      };
      if (game.message) {
        // Whoever's waiting for you can wait until this has been said.
        const waits = () => {
          arriving = false;
        };
        dialogue.open(game.message, arrival ? greet : undefined, arrival ? waits : undefined);
        game.message = null;
      } else if ((!game.run.metSenpai || game.run.trained) && !game.returning) {
        walker = newWalker();
        entrance = createEntrance(walker, place("D"), place("@"), { rows: CLUB_MAP, solid: "", tile: TILE });
        afterEntrance = () => {
          const welcome = doorWelcome(game.run);
          if (welcome) {
            game.run = welcome.run;
            dialogue.open(welcome.lines, greet, greet);
          } else greet();
        };
      } else greet();
      game.debug.visitor = visit?.walker.box ?? null;
      game.debug.visitorStanding = visitorHere(game) !== null;
      game.debug.club = { screenBroken: game.run.screenBroken };
      game.debug.walker = walker.box;
      game.debug.facing = walker.facing;
    },
    update(game) {
      tick++;
      game.debug.visitor = visit?.walker.box ?? null;
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
      const rows = rowsFor(game);
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
      if (dressing) {
        const frame = dressingAt(++dressing.tick, game.reducedMotion);
        if (frame.changed && !dressing.sounded) {
          dressing.sounded = true;
          game.audio.play("pickup");
        }
        if (frame.done || game.input.wasPressed("confirm")) {
          const { then } = dressing;
          dressing = null;
          then();
        }
        return;
      }
      if (visit) {
        const before = visit.phase;
        visit.update(walker);
        if (before === "coming" && visit.phase === "talking") {
          const talk = visitTalk;
          visitTalk = null;
          if (talk) playTalk(game, talk);
          return;
        }
        // They've said what they came to say.
        if (visit.phase === "talking") visit.leave(findTiles(rowsFor(game), "V")[0] ?? place("D"));
        if (visit.done) visit = null;
        else if (visit.blocking) return;
      }
      if (stride) {
        if (stride.update(walker, mapFor(game))) {
          const { char } = stride;
          stride = null;
          talkTo(game, char);
        }
        game.debug.walker = walker.box;
        return;
      }
      talkingTo = null;
      if (worn && gainedGear(worn, walkingGear(game.run))) {
        putOn(game, { gi: game.run.gi, gear: walkingGear(game.run) }, () => {});
        return;
      }
      worn = walkingGear(game.run);
      if (escort) {
        escort.update(walker, mapFor(game));
        game.debug.walker = walker.box;
        if (escort.done) escort = null;
        else if (escort.blocking) return;
      }
      updateWalker(walker, game.input, mapFor(game));
      game.debug.walker = walker.box;
      game.debug.facing = walker.facing;

      if (!game.run.gi && touchesTile(walker, gi.col, gi.row)) {
        walker.moving = false;
        putOn(game, { gi: true, gear: walkingGear(game.run) }, () => {
          game.run = { ...game.run, gi: true };
        }, "iconGi");
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
      const ahead = personAhead(walker, rows, CLUB_SOLID, PEOPLE);
      if (ahead) {
        stride = { ...createStride(walker, ahead.stand), char: ahead.char };
        talkingTo = ahead.char;
        return;
      }
      if (front === "D") tryDoor(game);
      else if (front === "$") shop.open("pinecone");
      else if (front === "Q") dialogue.open([STORAGE_LOCKED]);
      else if (front === "N") {
        const offer = cupOffer(game.run, "pinecone");
        dialogue.open(offer.lines, offer.enter ? () => {
          game.tournament = null;
          game.go("tournament");
        } : undefined);
      }
      else if (front === "C") dialogue.open([SCREEN_LOOK, !game.run.gear.shinai ? SCREEN_NO_SHINAI : game.run.momoBeaten ? SCREEN_HINT : SCREEN_NEEDS_TRAINING]);
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
      if (escort && escort.door.slide < 1) drawStorageDoor(ctx, cam, escort.door);

      // Until storage is unlocked, the hall is all there is, however much the window could show.
      if (!game.run.metSenpai) {
        ctx.fillStyle = PALETTE.K;
        ctx.fillRect(0, CLUB_HALL_ROWS * TILE - cam.y, viewW, viewH);
      } else if (!game.run.gi && !dressing) {
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
      const you: Figure = figureAt(ctx, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - 12 - cam.y, walker.box.y + 8 - cam.y);
      const figures: Record<string, Figure | undefined> = {};
      const walkingFigure = (w: Walker) => figureAt(ctx, w.box.x + w.box.w / 2 - cam.x, w.box.y - 12 - cam.y, w.box.y + 8 - cam.y);
      const person = (char: string, id: Exclude<PersonId, "examiner">, standing: "down" | "side", gear: typeof FULL_GEAR, colors?: Record<string, string>) => {
        const spot = findTiles(rows, char)[0];
        const x = spot.col * TILE - cam.x;
        const y = spot.row * TILE - 4 - cam.y;
        figures[char] = figureAt(ctx, x + 8, y, y + 20);
        // Whoever you're talking to looks at you. Sora's asleep.
        const turned = talkingTo === char && !(char === "V" && visitorHere(game) === "sora")
          ? facingToward({ x: x + 8, y: y + 16 }, { x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y + walker.box.h / 2 - cam.y })
          : { facing: standing, flip: false };
        const dan = personDan(id);
        const near = rankTagShown({ x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y - cam.y }, { x: x + 8, y: y + 16 });
        if (near) tags.push(() => drawRankTag(ctx, opponentById(id).rival, x + 8, y - 8, presenceOf(dan) > 0));
        return {
          y: spot.row * TILE,
          draw: () => {
            drawPresence(ctx, x + 8, y + 20, tick, presenceOf(dan), game.reducedMotion);
            drawKendoka(ctx, x, y, turned.facing, 0, gear, { colors, flip: turned.flip });
          },
        };
      };
      const greeterSpot = findTiles(rows, "Z")[0];
      const greeterX = greeterSpot.col * TILE - cam.x;
      const greeterY = greeterSpot.row * TILE - 4 - cam.y;
      figures.Z = figureAt(ctx, greeterX + 8, greeterY, greeterY + 20);
      if (rankTagShown({ x: walker.box.x + walker.box.w / 2 - cam.x, y: walker.box.y - cam.y }, { x: greeterX + 8, y: greeterY + 16 })) tags.push(() => drawRankTag(ctx, "Nao", greeterX + 8, greeterY - 8, false));
      const people = [
        { y: greeterSpot.row * TILE, draw: () => drawKendoka(ctx, greeterX, greeterY, "down", 0, { ...FULL_GEAR, men: false }, { colors: TEAM_COLORS.pinecone! }) },
        ...(escort
          ? [{ y: escort.momo.box.y - 8, draw: () => drawWalker(ctx, escort!.momo, cam, { ...FULL_GEAR, men: false }, MOMO_COLORS) }]
          : [person("M", "momo", "down", { ...FULL_GEAR, men: false }, MOMO_COLORS)]),
        person("X", "sensei", "down", { ...FULL_GEAR, men: false }, SENIOR_COLORS),
        person("A", "aki", "side", FULL_GEAR, AKI_COLORS),
        person("B", "bo", "down", { ...FULL_GEAR, men: false }, BO_COLORS),
        person("Y", "yui", "side", FULL_GEAR, YUI_COLORS),
        ...crowdDrawings(ctx, rows, cam, tick, game.reducedMotion, () => TEAM_COLORS.pinecone!, seed, (draw) => tags.push(draw)),
        { y: walker.box.y - 8, draw: () => {
          if (!dressing) {
            drawWalker(ctx, walker, cam, walkingGear(game.run), playerColors(game.run));
            return;
          }
          // Spinning round in a flurry of cloth, in the old clothes until suddenly they aren't.
          const frame = dressingAt(dressing.tick, game.reducedMotion);
          const look = frame.changed ? dressing.after : dressing.before;
          const shown: Walker = { ...walker, facing: frame.facing, flip: frame.flip, moving: false, box: { ...walker.box, y: walker.box.y - frame.hop } };
          drawWalker(ctx, shown, cam, look.gear, playerColors({ ...game.run, gi: look.gi }));
          const middleX = walker.box.x + walker.box.w / 2 - cam.x;
          if (frame.held && dressing.held) drawSprite(ctx, TILE_GRIDS[dressing.held], Math.round(middleX - TILE / 2), Math.round(walker.box.y - 12 - cam.y - TILE + 2));
          if (frame.puffs) drawClothPuffs(ctx, middleX, walker.box.y - 2 - cam.y, dressing.tick);
        } },
      ];
      if (escort) figures.M = walkingFigure(escort.momo);
      const visitor = visitorHere(game);
      if (visit) {
        const { walker: comer } = visit;
        figures.V = walkingFigure(comer);
        people.push({ y: comer.box.y - 8, draw: () => drawWalker(ctx, comer, cam, { ...FULL_GEAR, men: false }, DOJOS.radish.colors) });
      } else if (visitor) people.push(person("V", visitor === "ren" ? "renVisit" : "raccoon", "down", { ...FULL_GEAR, men: false }, visitor === "ren" ? DOJOS.radish.colors : DOJOS.raccoon.colors));
      people.sort((a, b) => a.y - b.y).forEach((p) => p.draw());
      if (!game.reducedMotion) {
        // The senpai standing near each other talk, too.
        const over = (char: string) => {
          const spot = findTiles(rows, char)[0];
          return { x: spot.col * TILE - cam.x + 8, y: spot.row * TILE - 12 - cam.y };
        };
        tags.push(() => drawNamedChat(ctx, seed, 2, tick, [over("A"), over("B")]));
        if (!escort) tags.push(() => drawNamedChat(ctx, seed, 4, tick, [over("M"), over("Y")]));
      }
      if (!dialogue.active && !menu.active) tags.forEach((tag) => tag());
      if (visitor === "sora" && !game.reducedMotion) {
        const spot = findTiles(rows, "V")[0];
        drawLabelAt(ctx, "z", spot.col * TILE - cam.x + 14 + Math.floor(tick / 30) % 3, spot.row * TILE - cam.y - 2 - Math.floor(tick / 30) % 3, PALETTE.W);
      }

      drawTopBar(ctx, "Pinecone Dojo", game.run);
      if (!dialogue.active && !menu.active) {
        drawObjective(ctx, currentObjective(game.run));
        const label = interactionLabel(personAhead(walker, rows, CLUB_SOLID, PEOPLE)?.char ?? tileInFront(walker, rows), "home");
        if (label) drawInteractPrompt(ctx, label, walker.box.x + walker.box.w / 2 - cam.x, walker.box.y - cam.y, keyLabel(game.input, "confirm", "e"));
      }
      dialogue.render(ctx, speakersIn(figures, SPEAKERS, you, talkingTo));
      menu.render(ctx);
      shop.render(ctx, game);
    },
  };
}
