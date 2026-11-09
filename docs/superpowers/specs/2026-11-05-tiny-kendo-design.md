# Tiny Kendo: design and build plan

"Tiny Kendo" is a working title. It can change at any time.

## Context

Tiny Kendo is a cute browser game that lets people experience kendo in a fun way. It's its own project and repo (owner, 2026-11-06). **It is a fun sandbox and is not meant to recruit.** Its association with the York University Kendo Club is removed for now (owner, 2026-11-07, issue #1): no club name, logo, favicon, links, Discord or email anywhere in the game, the page or the README. The previous wording and the removed files are in git history, in commit 860a2bb, for when it comes back.

**It has grown past the prototype (owner, 2026-11-05).** It's now an open-world game: a story at home, a city to roam, optional fights and optional storylines. Multiplayer and collaboration come next, so new systems should leave room for other people without building that yet.

**Who it's for:** curious newcomers, who should come away with a feel for kendo, and kendoka from any club, who should recognise it as real kendo.

**What success looks like:** someone wanders in, enjoys the first stretch, wants a rematch after losing, and keeps exploring because there's always something optional to try.

## Goals, non-goals and anti-goals

**Goals**
- An open world: a home dojo with a story, a city to roam, rival dojos, a final boss, cups at every dojo and a grand tournament.
- Fights outside the main path stay optional, and more than one route leads forward.
- Duels that are tense, learnable and true to kendo.
- Curiosity is rewarded with something hidden.

**Not in this version:** leaderboards, touch controls (a later spec), gamepad controls, music, and recruiting or sign-up content.

**Failure, even if it technically works:**
- It feels like a generic platformer with a kendo skin, or kendoka say "that isn't kendo."
- Duels can be won by mashing buttons or by holding block.
- It feels like an advert for the club.
- It copies the art, characters or world of an existing game. Hollow Knight and Pokémon inspire the structure and ideas only.

## Decisions made by the owner

- **Style:** cute 8-bit pixel characters. All art is made purely through code.
- **Journey (revised 2026-11-05):** one club with one secret, a city map with optional fights, five rival dojos with Ren as the last of them, and a tournament.
- **Views:** a top-down city map, top-down indoors, and side-on for duels and gang fights. No platforming.
- **Borrowed from Hollow Knight:** hidden places and tough, learnable opponents only. The mood stays cute.
- **Duel rules:** first to 2 points, with a 2-minute clock. One clean strike scores. Every ordinary strike starts from a visible opening (see Openings). Swinging, blocking and holding an opening drain ki, only plain guard recovers it, and low ki makes you slower and more open.
- **World:** everything is fictional, including people and dojos, with no real sensei, officers or clubs.
- **Devices:** keyboard first. Phones get a friendly "play on a computer" screen, and touch comes later if the game proves fun.
- **Link to the club:** none for now (see above).
- **End of the game:** no recruiting pitch, and no mention of any club.

## The player's journey

There's no target length any more. The first day at the club is short, and everything after it is yours to explore in your own order.

### 1. Title, and choosing who you are
Press a key to start. Controls are shown on screen. A new game opens **character select (owner, 2026-11-05)**: six fictional people (my call on names), each with their own skin, hair, armor colors and everyday clothes. Only looks differ, so the choice can't make the game harder (my call). X goes back to the title, and an existing save is only erased once you actually start.

**Your name (owner, 2026-11-06).** Picking someone asks what you're called, showing their name. Press Enter without typing and you go by it; type and yours replaces it. "Name" in the pause menu changes it later, and clearing it goes back to the character's. It's saved, up to 12 letters, digits, spaces and `.'-`, because that's what the font and the HUD have room for. Your name is on the fight HUD, the result ("Emi wins!") and the cup brackets, and people use it now and then: any line of dialogue can contain `<name>` (`fillName`), so a new mention is just text. Everyone mostly still says "you", and the game's instructions do too. Multiplayer uses your account's username instead (see Multiplayer), since a name typed here shouldn't go to strangers without someone deciding that it should.

### 2. The first day at the club (owner's order, revised 2026-11-05)
One hall plus a storage room. Learning happens in a loop: **Sensei teaches, a senpai tests, the armor is earned, and Sensei teaches the next thing.**

1. **Arrive in street clothes.** Nao welcomes you at the door, explains how to move and talk, and points you toward Momo. Momo introduces kendo and the path through practice and challenges. Then talk to Senpai Momo. After a few lines of welcome she walks you across the hall to the storage door, the player following a few steps behind. At the door she warns you it sticks, rattles it, and slides it open. The storage room only appears once it's open. She then tells you to collect the gi and change, and walks back to her spot while you take control. Backing out of the welcome means no walk, and she offers again next time (my call on the details).
2. **Borrow the spare gi** from storage.
3. **Borrow Sensei Kuma's old shinai (owner, 2026-11-06).** Sensei's heard from Momo that you're joining, and asks why. You pick: to hit people, it looked cool, fun exercise, or to be like Zoro. Nothing's wrong, Sensei has a dry word for each, and remembers it. Then Sensei notices you've no shinai and offers the old one, half worn out, to be returned once you're stronger. You can say not yet and be asked again. Until you've got it, the cracked screen just reminds you that you've nothing to hit it with.
4. **Work through the armor loop:**

| Round | Sensei teaches | Then | Earns |
|---|---|---|---|
| 1 | Suriashi, men with fumikomi, follow-through | | Tare, from Sensei |
| | | Pass any one senpai's challenge on the same drill | Do |
| 2 | Blocking a strike to your do, and the do counter | Pass any one senpai's challenge on it | Men |
| 3 | The kote counter, and the launch | Pass any one senpai's challenge on it | Kote |

5. **Beat a senpai in a real match** (first to two). Any of Aki, Bo or Yui will spar once you're fully armored. They go easier than any rival, with longer tells.
6. **The front door opens** once you've won one.

**New items (owner, 2026-11-05):** anything you earn, by any route, stops the game. The screen darkens, the item drops into the middle and bounces, and "NEW ITEM ACQUIRED" appears with its name and one line about it. The same card announces seme and cup trophies. It can't be skipped by the key you were already mashing. It waits for conversations and fades to finish, and any scene change waits for it. With reduced motion, the item simply sits still.

**Reading and readiness (owner, issue #3):** each lesson stops on its own ready card, with the relevant keys and instructions before the action starts. First-match guidance states the points needed and the strike, stomp and follow-through needed to score. Lesson cards and their in-practice reminders use framed, colored dojo notices with readable text. Kyu advances with armor earned through Sensei's drills and senpai challenges, and the final kyu step requires a senpai win; receiving the gi or shinai alone grants no rank.

**The insignia (owner, 2026-11-05):** the tare from Sensei is the only armor he gives you. Right after its card you can design the zekken, the cloth on its front: a symbol and two colors (my call: nine fixed symbols rather than free drawing, so it stays safe to show other players later). It's optional, X skips it, and the Esc menu can bring it back at any time. It shows on your armor everywhere.

**Armor rule (owner):** partners won't really hit a target until you wear the armor for it. Until then they stop short and it costs nothing. Once you wear the armor, their hit on it counts as a miss in a challenge.

**The senpai (my call on names and styles):** each runs the current drill in their own style, and only one has to be passed each round. Passing needs a set number of clean strikes before too many misses. A failed challenge costs nothing and can be retried.
- **Aki**, chatty and restless, never stands still, so the range keeps changing.
- **Bo**, a calm wall, keeps a guard up and only opens it in moments.
- **Yui**, an exacting perfectionist, starts each strike from far away and allows fewer misses.

### Line drill (owner's order, 2026-11-05)
Sensei runs it once you're fully armored. A row of senpai in bogu stand in the hall, and each offers one opening when you come into range.
- **Answer it with the whole combination:** the right strike, fumikomi, and a slide through to the next senpai. Each senpai gets one try. A wrong target, no stomp, no follow-through, waiting too long or walking past is a miss, and failing costs nothing.
- **Openings match the duel's tells** (my call): tip dips for men, hands rise for kote, arms high for do. Reading the line teaches you to read a rival.
- **Three passes unlock street fights.** The runs get harder: 4 senpai and 2.5 seconds with key prompts and a timer, then 5 and 1.8 seconds, then 5 and 1.5 seconds with no key prompts.

### Kirikaeshi (owner's order, 2026-11-06)
Sensei's stamina drill, with Bo receiving, from "Kirikaeshi" in Sensei's menu. The order is the owner's: **big men with fumikomi, 4 sayu men forward, 5 back, big men with fumikomi, 4 forward, 5 back, then a last big men with fumikomi and follow-through.** That's 3 big men and 18 sayu men. Sayu men have no kiai of their own: each one just calls men, and only the big men get a real kiai. The timing comes from a reference video (about 0.45 seconds a strike, or 27 ticks).
- **Keys (my call):** Space then J for a big men, A and D for alternating sayu men starting on A, and hold D for the follow-through. The stomp comes first, as it does everywhere else.
- **Stamina (my call):** a big men costs its usual 14 ki and a sayu men costs 5. A slip costs 6 more. No ki comes back during a chain, only in the 2-second reset before each big men. A clean set on a bar of 100 bottoms out at 12 and ends on 28, so a starting bar has room for one slip late in the set, and a bigger bar visibly has more room.
- **Failing (my call):** reaching 0 ki, more than 4 slips, or not following through. Failing costs nothing.
- **Tempo and reward (my call):** the first pass is at 34 ticks a strike, the second at 30, and the rest at the video's 27. The first three passes are worth ki +5 each, the same cap as the line drill, so a repeatable drill can't stand in for the ladder. Every pass earns the usual drill experience and pay.
- **Not unlocked by anything, and it unlocks nothing (my call).** It's practice you choose.

### What unlocks what (owner's direction, 2026-11-05; numbers are my call)
You start with the home dojo only. Ki rises and techniques are learned as you play, and each one opens more of the world. **Ren is the final boss of the dojos, so every other rival comes first.** Sensei and the objective line point at what's next, but never at a street fight, because those stay your own idea. This table is one list in `progress.ts`, so a new dojo or fight is one more row. Every lock can be opened by playing what's already open, without the secret, and a test proves it.

| Opens | Needs |
|---|---|
| The city | A win over any senpai |
| Pinecone Cup | Line drill, a win over any senpai |
| Market Street fight | Line drill passed 3 times |
| Old Gen | Line drill, ki 125 |
| Streetcar to Cherry Park | Line drill |
| Viaduct fight | Line drill, ki 135 |
| Sora at Sleepy Raccoon | Ki 145 |
| Raccoon Open | A win over Sora |
| Harbour fight | Line drill, ki 145 |
| Picnic fight | Line drill, ki 155 |
| Streetcar to the beach | A win over Sora |
| Boardwalk fight | Line drill, ki 165 |
| Hana at Angry Goose | Seme, ki 170 |
| Commuter train, and Steel Bay | A win over Hana |
| Goose Open | A win over Hana |
| Foundry fight | Line drill, ki 185 |
| Mika at Iron Heron | Ki 190 |
| Train to Misty Falls | A win over Mika |
| Heron Open | A win over Mika |
| Gorge fight | Line drill, ki 205 |
| Kenji at Soggy Otter | Ki 210 |
| Otter Open | A win over Kenji |
| Ren, the last dojo | Seme, ki 230, and wins over Sora, Hana, Mika and Kenji |
| Train to the Grand Arena | A win over Ren |
| Thunder Open | A win over Ren |

**Ki:** starts at 100. Each of the first three line passes gives +5, the first win over each senpai +5, the first win over each rival +10, each street fight and the tower +10, the tsuba +25, each dojo's cup +15 the first time you win it, and the Grand Taikai +20.

**Two routes to Ren (owner: gang fights stay optional).** Ki 230 is the same as before, but it can be reached by winning cups with no street fights at all, or by street fights with no cups, or any mix. With neither, the ki isn't there. Tests pin all three.

Every ride home is never locked. The tower has no row of its own: its path opens when the Market Street gang is beaten.

### The rivals (my call on names and styles)
Every rival follows the same rules as the player, and every attack has a visible tell.
- **Sora, Sleepy Raccoon Dojo, Cherry Park:** the first and gentlest. Barely awake, then snaps at your wrist.
- **Hana, Angry Goose Dojo, the beach:** can't wait, and loves the big swing.
- **Mika, Iron Heron Dojo, Steel Bay:** stands still for a long time, then moves all at once. More ki than usual.
- **Kenji, Soggy Otter Dojo, Misty Falls:** never stops swinging. More ki than usual.
- **Ren, Thunder Radish Dojo, downtown:** the final boss, with the most ki of any rival and a light aura that wears you down unless you hold seme against it. If you hide behind your guard, Ren holds seme against you, which leaves Ren wide open for anyone paying attention. After three losses Ren drops the aura and the pressing, on top of the usual slower tells, so anyone who keeps trying gets a fair shot. The tournament final never eases off.

### Meeting them early (owner's direction, 2026-11-05; the details are my call)
You meet the people you'll fight long before you fight them.
- **Ren, at your first tare.** Back in the hall after Sensei's first drills, Ren has been watching. They introduce themselves, used to sweep this floor, and say something about the symbol on your tare. Ren hangs around, chatting, until you earn the do.
- **Ren, at your full bogu: one point.** Once you're fully armored, Ren comes back and asks for one point. It's a scripted match: Ren walks right up, their stare folds you in a few seconds, and they take the point. It isn't on the record and costs nothing. X backs out and Ren waits in the hall, with the objective line pointing at them. Landing a hit on them gets a different reaction and the same lesson.
- **The lesson: the far-mountain gaze.** Ren explains enzan no metsuke, the real kendo idea of looking at all of your opponent at once, like a distant mountain, rather than into their eyes. It gets the same card as any other technique, at the end of the lesson, and a refresh partway through replays the lesson rather than losing it.
- **What it does (Ren only: owner, 2026-11-05).** You can see what's coming: Ren's strikes show the key prompt that answers them, which they otherwise never do, except in a tournament. That's the main help, because simulated matches showed that slowing the stare alone barely changes who wins. Standing in guard, Ren's stare takes twice as long to shake you. When Ren actively holds seme against you, it takes a third longer, and no more, because any stronger and holding block becomes a winning plan. A test pins that at the ki you'd really face Ren with. It works in every fight with Ren and against nobody else. Ren's greeting and the bow text in the final both remember it. It's optional: the road to Ren doesn't require it, and if you never took it, Ren tells you where to find them.
- **Sora, napping.** Once the front door is open, Sora is asleep on your dojo floor and can be woken for a chat, until you've beaten them.
- **The next boss at each win.** After you beat a dojo's head, whoever's next has come to watch: Hana at Sleepy Raccoon, Mika at Angry Goose, Kenji at Iron Heron, and Ren at Soggy Otter. They speak up once, right after the head has said their piece, and stay to chat until you've beaten them.

### Rank, levels and stances (owner's direction, 2026-11-05; numbers and names are my call)
- **Your rank (owner, 2026-11-05).** You start at 6th kyu. Each armor piece you earn is a step up, and beating a senpai makes you 1st kyu. That's as far as the home dojo takes you: even the Pinecone Cup doesn't make you a dan. Every rank up gets the item card, and your rank shows in the top bar, the duel HUD and the Progress page.
- **Three ways to a dan (owner, 2026-11-05).** You need any one of them, and the panel tells you about the others if it isn't ready to see you.
  - **Grading (shinsa, owner's flow, 2026-11-05).** The panel isn't at home, and every attempt costs a fee. It takes four steps:
    1. **Ask.** Talk to Sensei or a senpai, and pick "Ask about grading". If you haven't done enough, they say what's missing and tell you about the other two routes.
    2. **Be tested.** Whoever you asked wants to see that you can represent the dojo. Any senpai can vouch for 1st dan by fighting you themselves, and Sensei sends you to Yui. For 2nd dan, senpai send you to Sensei, who sends you to Momo. For 3rd dan, you fight Sensei (my call on who). Winning here isn't an exception and doesn't count as beating them.
    3. **The ticket.** Winning earns a grading ticket, with its own card: E travels straight away, and X keeps it for later. It's in the new Inventory page of the pause menu, where E uses it. It can be used anywhere you're walking around, and not mid-fight. Rising by another route retires it.
    4. **The panel.** The ride ends at the Grading Hall, which isn't on the map. The panel wants two things in order (my call): a demonstration, which is the hardest line drill with no key shown, and then one bout against another candidate. Pass both for the rank. Failing either keeps your ticket (owner), so you can walk back up and pay for another attempt, or leave and earn the fee. A refresh puts you back where you caught the train, with the ticket. The train also takes you back there.
  - **Tournament.** Win an Open away from home. Winning raises you to that cup's dan, or leaves you where you are if you're already past it.
  - **Exception.** Beat someone tough, and the panel makes an exception, skipping the grading's requirements. Sensei Kuma can be challenged from the talk menu once you've beaten a senpai. Sensei has 170 ki and a stare that never eases off, however often you lose, so it wants seme: in simulation, reading every tell without seme almost never wins, and holding seme while reading about half of them wins about half the time. It never touches the far-mountain gaze, which stays Ren-only.

| Dan | To ask, you need | Or win | Or beat | What it opens |
|---|---|---|---|---|
| 1st | Line drill, beat Sora | Raccoon Open | Sensei Kuma | Hana, Goose Open, Tetsu |
| 2nd | 1st dan, beat Hana | Goose Open | Tetsu | Mika, Kenji, Heron Open, Otter Open, Shin |
| 3rd | 2nd dan, beat Mika and Kenji | Heron or Otter Open | Shin | Ren (the Thunder Open and Grand Taikai come after Ren) |

- **Older saves** get the dan their wins already imply, so nobody is locked out of somewhere they'd reached.
- **Levels.** All practice earns experience, including repeats and losses: 30 for a win, 10 for a loss, 20 for a line drill pass, 15 for a drill, 30 for a street fight and 60 for a cup. Each level takes longer than the last and is worth 1 ki, so practice can stand in for a little of the ki the first-time rewards give, but not much: level 20 takes about 300 wins.
- **Everyone else's rank.** Named people carry a dan: Examiner Ono 8th, Sensei Kuma 6th, Ren and Shin 5th, Momo, Mika, Kenji and Tetsu 4th, Sora and Hana 3rd, senpai and dojo members 1st or 2nd. Their name floats over their head when you're close; their rank appears in the duel HUD. From 3rd dan up they carry a faint aura outside battle, a few motes and a ring on the floor, stronger with rank and still with reduced motion.
- **People practicing.** Every dojo has a group doing suburi in tandem, stepping forward on one cut and back on the next, and a pair in keiko taking turns to attack. They're scenery you walk around. I left them out of the duel background on purpose, because every tell has to stay easy to read.
- **Stances.** The same rules apply to both fighters, and every attack still has a tell.
  - **Jodan (Tetsu, 4th dan, Angry Goose, needs your 1st dan):** shinai overhead. The men is out of reach in guard, and strikes land from 10 further out than anyone else's, so the usual safe distance isn't safe. Tells are a little quicker. A men opens the wrist, a kote opens the do, and a miss leaves them hanging longer.
  - **Nito (Shin, 5th dan, Iron Heron, needs your 2nd dan):** long and short sword. The men is covered in guard, and only the do is open after a miss. Any strike opens the do, and blocks cost half the ki. Tells last longer, because do is the slowest strike you have.
  - Each explains themselves before the fight, the tips know the stance, and the key prompts point at the right target. They enter the Heron and Otter Opens. Beating one is worth ki the first time and an exception to the next dan, and they'll go again after. The player stays in chudan for now.

### Money, stalls and bets (owner's direction, 2026-11-05; names and numbers are my call)
- **Kensen.** A fictional currency, named after the tip of the shinai, with a nod to the old coin *sen*. It's only ever spent in this game.
- **Earning it.** Street rescues pay 40. Helping with training pays: "Help with training" in Sensei's menu is a beginners' line run for 15, which isn't your own practice, drills pay 5 and your own line passes pay 10. First wins pay 15 over a senpai and 50 over a rival, and repeat wins pay 5. Cups pay 60 the first time and 15 after, and the Grand Taikai pays 300. The tower pays 20.
- **Challenges** pay once each, and have their own page in the pause menu: all senpai, a perfect long line, a flawless win over a dojo head, three street rescues, three cups, Sensei, Tetsu and Shin, every hidden stash, and all five dojo heads.
- **Easter eggs.** Four stashes behind racks and plants, worth 25 each. Nothing marks them, and pressing E facing the right wall finds them.
- **Spending it.** The Bogu Shop is a new stop past Market Street, selling gear that adds ki (at most 20 between the three pieces, plus 3 from a charm at the cups) and ink armor. Every dojo has a merch table selling its colors. Every cup has a stall, opened with X on the bracket. Colors change how you look and nothing else, and go on and off from the Inventory.
- **Grading fee (owner).** Each attempt costs 50, 100 or 200 kensen by rank, paid when it starts, not refunded, and backing out before it starts costs nothing. The ticket isn't used up by attempts: it stays yours until you pass that rank.
- **Bets (owner).** Before a match you've chosen, you can put money on yourself. It's paid up front, so walking away or closing the game loses it, and a win pays it back double. Opponents only accept so much: 25 per dan, plus 25. There are no bets on tournaments, gradings, Momo's rigged fight or Ren's lesson. Each side's stake settles on its own, so a person can sit on the other side later.

### People with lives of their own (owner's direction, 2026-11-05; details are my call)
- **Routines.** Each group in a room picks an activity at random: suburi or keiko most often, or footwork, chatting or resting. It keeps it for a fixed 15 seconds, then picks again, and each visit rolls a new day. A group always moves together.
- **Talking.** While a group's chatting, one person at a time says something over their head. Named people standing near each other talk some of the time too. All of this stops with reduced motion.
- **Moods.** Each match rolls how long the opponent waits between swings (20% quicker to 25% slower) and which strike they favour. It never touches a tell, and rigged fights keep to their script. A test checks that no mood lets mashing or holding block win.

### Tournaments (owner's direction, 2026-11-05)
Tournaments are where other dojos meet. **For now every other entrant is a bot standing in for a dojo, and later they can be real people.**

- **Dojo cups:** every dojo has a notice board with its own cup: the Pinecone Cup at home, then an Open at each rival's dojo once you've beaten them. Four fighters, two matches, with people from the host dojo and a visitor from elsewhere. The host waits in the final, except at home, where it's an open draw between the senpai. Bots use the same rules and fighting styles as everyone else.
- **The Grand Taikai,** at the Grand Arena, reached by train once Ren is beaten. Eight fighters: you, all five rivals and two of the three senpai. Three matches, and Ren is always waiting in the final. Winning gives a Champion badge on the Progress page and a quiet Discord and email line.
- **In every one:** single elimination, and you can start again straight away. Opponents fight at full strength with no easing after losses, and no key prompts except in the Pinecone Cup, which is the first anyone plays (my call). Trophies get the new item card. Momo never enters, because that fight is rigged.
- **Ready for other players (my call):** a bracket is plain data, each entrant says who's controlling it, and it only ever asks who won each match. Online tournaments build on this (see Multiplayer).

### Getting around (owner's direction, 2026-11-05)
- **The streetcar now runs in two directions from Lakeshore Stop:** west to Cherry Park, east to the beach. A destinations board shows where each goes and what it still needs.
- **The commuter train, inspired by the GO Train,** leaves from Central Station, past the Harbour, to Steel Bay, Misty Falls and the Grand Arena. It's green and white with no real logo or name, and has its own Travelling screen.
- **Each new place has its own map, one more Alley Cats fight and a person in trouble.** Those fights are longer, with more sticks.

### Backing out and saving (owner's order, 2026-11-05)
- **X closes any dialogue.** If it was leading to a fight or lesson, that doesn't happen.
- **Esc opens a menu:** Resume, Progress, Forfeit (only during a fight, drill or lesson), and Restart game. Forfeiting leaves no loss on the record. Restarting asks first.
- **The Progress and Inventory pages are built to be read at a glance (owner, 2026-11-06).** Left and right switch pages, up and down pick, E or X goes back, and the keys are drawn at the bottom.
  - **Progress** has three pages. *Rank*: a big rank, level, an XP bar, a ki bar and three counts (beaten, cups, dojos). *Techniques*: all seven, learned ones in color and the rest greyed with a hint of where to find them. *Map*: the unlock ladder with a color for each kind of row (fight, dojo, cup, grading, travel, city, multiplayer), a pick-able cursor, and a card at the top showing the picked row's full checklist (ticks for what you have, crosses for what's missing). It opens on the Map, on what's next.
  - **Inventory** is a grid of the item pictures in groups: Items, Gear, Colors, Trophies. Gear and Trophies keep a "?" slot for each one not found yet, with a count in the heading. A card beside the grid shows the picked item's picture, kind, name and what it does, and for colors whether they're worn. E on the men puts it on or takes it off, and while it's off its card says "Fights only". A color you're wearing, or a men you've chosen to keep on, has a tick on its slot, and the ticket has a gold dot. Arrows move across the grid and don't wrap. The page scrolls when there are more rows than fit.
  - The rows' logic lives in `inventory-grid.ts` (layout and movement), `items.ts` (`inventoryGroups`) and `progress.ts` (`needs`, `unlockKind`, `TECHNIQUE_INFO`), and is tested; `scenes/progress-page.ts` and `scenes/inventory-page.ts` only draw.
- **Progress saves itself** to the browser as it changes. The title offers Continue or New game, and New game warns before erasing. Fights aren't saved partway: you pick up at home or wherever you'd walked to on the map. Development links neither read nor write the save.

### 3. The secret (owner's order, revised 2026-11-05)
- Once you've earned your full armor, **Senpai Momo moves to guard the cracked screen** in the storage room. The screen hides the lucky tsuba, and it can't be reached until Momo is beaten.
- **The fight is rigged until you learn seme.** Momo has twice your ki and a constant aura that makes you flinch within a second or so. Momo then strikes you while you're open. Nothing else gets through: Momo keeps a guard up and never shows an opening. Holding seme pushes back against the aura, and only then can Momo be made to flinch or drawn into a big swing that can be countered.
- **Seme is learned outside the dojo,** from Old Gen, a hermit on Ravine Trail (my call on who and where). Losing to Momo points you there. Seme isn't available before that.
- **Seme is hard to earn (owner's direction, 2026-11-05).** Old Gen won't see you until you've passed the line drill and reached ki 125. Then there are three stages, each needing two clean reps with at most three misses, against an aura as strong as Momo's: hold seme until Gen flinches, punish the flinch, then press until Gen loses patience and answer the big swing with do. Too many misses at any stage sends you away, and you start again from the first.
- Losing to Momo costs nothing. After Momo is beaten, a strike breaks the screen.

### The city map (owner's direction, 2026-11-05)
- **A top-down map of a lakeside city with a tower, using Toronto as the visual reference:** a needle tower on the waterfront, glass downtown, a stadium dome, a twin-tower city hall, a red streetcar, a green river ravine with a viaduct, a harbour, and islands in the lake. The city itself is unnamed, because the game's world is fictional. It's walked node to node with the movement keys, between Pinecone Dojo in the west and Thunder Radish Dojo in the east.
- **Gangs are optional.** They stand on map points in every district. You can walk straight past, or press E to step in and help. You can reach Ren without fighting any of them, by winning cups instead (see What unlocks what).
- **Gang fights are side-scrolling, one against many, on the same rules:** strike, stomp and full follow-through, with the skyline and tower behind them. Most bullies are unarmed and some carry sticks. Raised fists leave only the do open, and a raised stick leaves only the kote. Hits come off your health bar. Walking away sends you back to the map with the HP you have left, and losing knocks you out (see After a fight, leaving, health and talk).
- **Rewards:** each gang beaten gives +10 ki, once. Beating the Market Street gang opens the path from the streetcar stop to the tower, whose view gives +10 ki once.
- **After beating Ren** you can go back out into the city.

### The city, part two (owner's direction, 2026-11-05)
**Map quality**
- The city is darkened to a dusk tone so it sits behind everything you can use. Paths, stops, gangs and dojos stay bright. Paths are a solid bright line with a dark edge, and every place stands on a colored marker.
- Every gang shows the person in trouble and a blinking "!" bubble. Once it's dealt with, that spot shows a heart instead.

**Why you're fighting**
- The bullies are one named gang, the Alley Cats. You never attack strangers: you step in because someone is calling for help.
- Each gang has a person in trouble and very little dialogue: one line asking for help, one taunt from the gang, and one line of thanks with the reward. The person in trouble stands at the far end of the fight.
- Backing off or losing leaves the person waiting, and the fight can be tried again. Losing also knocks you out. Fights stay optional.

**The streetcar**
- A stop near the crossing has a destinations board, and each line opens as the ladder says. Press E to catch the streetcar. A short, skippable "Travelling" screen plays, showing the car on its way, then you arrive in another part of the city.
- One line goes to a neighbourhood by the beach, with its own map, one more Alley Cats fight and Angry Goose Dojo. Hana, its rival, attacks much more often than Ren and favours the big swing. The streetcar brings you back the same way.
- A place's map shows only its own district.

### 4. Rival dojo (top-down)
A small room, a few characters who hint at the rival's habits, a notice board for its cup, then a talk with the rival that starts the duel.

### 5. The duel (side-on)
See Duel design below. Losing leads straight to a rematch, with a tip based on how the player lost.

### 6. After a win
There's no win screen: see After a fight, leaving, health and talk. Winning the Grand Taikai shows no extra line (the club contact line is removed for now, see above).

### Your own shinai (owner, 2026-11-06; the details are my call)
The shinai you start with is Sensei's, and you owe it back. Nothing on the ladder depends on any of this.

- **Sensei asks.** The first time you talk to Sensei holding a dan grade, they tell you it's time you had your own, and that theirs has to come back in one piece.
- **Fumi, at the Bogu Shop.** Buying the Fine shinai gets you something good to swing, and that's all: it teaches you nothing. To learn how shinai are made and mended, you bring bamboo from Old Gen's stand on Ravine Trail. Gen hands it over whether or not you've learned seme.
- **Making it.** Fumi asks three real questions about how a shinai goes together: four slats, the string along the back, the nakayui a quarter of the way from the tip. A wrong answer gets corrected and you try again. You leave with "Your own shinai", in your hand.
- **Fixing Sensei's.** Now you know how, Fumi's bench is yours. Sensei's shinai can only be fixed by you, and only once you've learned. It has to be fully fixed before it can go back, even if you've been using your own all along.
- **Giving it back is optional, and worth doing.** Sensei remembers why you said you came, and gives you ki +10, 100 kensen, and their shinai bag, which halves the wear on whatever shinai you carry.

The story is in `scenes/shinai-story.ts`, and is tested.

### Durability (owner, 2026-11-06; the numbers are my call)
Each shinai and each piece of armor has durability out of 100, shown on its inventory card. Sensei's old shinai starts at 50, and everything else at 100. For most of the game it never changes.

- **Only special opponents wear gear down:** the jodan and nito specialists, the bosses of the Goose, Heron, Otter and Radish dojos, and the dojo senseis (`GEAR_WEAR` in `durability.ts`). Win or lose, each fight takes a fixed amount from certain pieces. Everyone else takes nothing.
- **Only the shinai in your hand wears.** You pick which from the inventory, otherwise you carry your best.
- **It costs you only when it's really worn.** At 25 or under, each piece takes 5 off your ki, and you're told when it happens. Nothing ever goes below 5, so a fight can't leave you unable to carry on. Sensei's shinai at 50 costs nothing.
- **Mending.** Fumi's bench mends armor, or a shop shinai, for 40 kensen. Once you've learned how, every shinai is free, because you're doing it yourself.

### Clearer on screen (owner, 2026-11-05; details are my call)
- **The interface is smaller than the world, and softer (owner, 2026-11-05).** Text, menus, bars and labels draw on their own layer, with pixels about half the size of the world's: 3 real pixels each in a browser on a 1080p screen, where the world's are 6. Below a world pixel of 4 the interface stops shrinking, so text stays readable in a small window. A menu's layout is written for the stage and simply comes out smaller, centered in the window, and bars stay at its edges. Labels over someone's head are placed from where that person stands in the world. The interface has its own softer colors, with slate panels instead of near-black and warm off-white text instead of bright cream. The font spaces letters by their real width. The flash when a point lands is much fainter.
- **It fills any window, at any shape (owner, 2026-11-05).** Every scene is laid out on a 256×144 stage, which is always fully on screen and centered. The view then grows along whichever side has room, so a different window shape shows more of the world, never bars. Top and bottom bars stay at the window's edges. The dojo hall gains more bays, rooms show more of the building, streets and rides run wider and the sky goes higher, and the city map carries on past the stage as a dimmed reflection, because nothing out there is a place to go. The duel court and the rules stay the same size, so a bigger window is never an advantage. The world is scaled up by the largest whole number that still shows the stage, so every game pixel covers the same real pixels and nothing blurs. Resizing works mid-fight. **F** goes fullscreen.
- **An objective line** under the top bar says what to do next, all the way through.
- **Press-E prompts** float over your head whenever something in front of you can be used, and say what it does.
- **Key caps and hints** show keys as keys. In dialogue, the speaker's name is highlighted.
- **Speech bubbles (owner, 2026-11-06).** What's said appears in a bubble next to whoever's saying it, with a tail pointing at them, just big enough for the words. It goes over their head if there's room, and otherwise wherever it doesn't cover them or you, and it's always on screen. A line with no name goes next to whoever you're talking to, or next to you. On the map it's all said where you're standing. Menus stay along the bottom, because they're yours and not anyone's speech.
- **People move like they're there (owner, 2026-11-06; details are my call).** All of it is for show, and none of it changes what anyone can do.
  - **You go to them.** Facing someone with a clear line up to 3 tiles off, the prompt shows and E walks you over. They turn to look at you while you talk, unless they're asleep.
  - **They come to you.** Ren and each dojo's next boss come in by the door and walk right up to you, say their piece, and go and stand in their spot. You wait while they do. After teaching the far-mountain gaze, Ren walks back out the door. A match doesn't move anybody: if Ren's just fought you, you're both right where you were, and Ren picks up talking from there. Until someone's come through the door, they aren't standing in the room.
  - **Coming in.** Arriving at home, a rival's dojo or the grading hall, you step in through the door. Coming back from a match, you're still standing where you were.
  - **Getting changed.** Walking onto the spare gi holds it up, spins you round in a flurry of cloth, and you come out wearing it with a little hop, and only then does its card appear. Armor you earn goes on the same way, the next chance there is at home. E cuts it short. With reduced motion you just stand there and change.
- **A Controls page** in the Esc menu lists every key. **P** also opens the menu.
- **Esc in fullscreen opens the menu with one press (issue #13).** Browsers keep Esc for leaving fullscreen, so the game never saw it. Where the browser has the Keyboard Lock API (Chromium), Esc is locked to the game while fullscreen: a tap opens the menu as usual, and holding Esc leaves fullscreen (the browser says so itself). Elsewhere, the browser taking the game out of fullscreen counts as that Esc and opens the menu; leaving with the game's own **F** doesn't. It only opens the menu, never closes it, and not where Esc couldn't have opened it either (a form or name box open, or a scene that never pauses).
- **Teaching cards (owner, 2026-11-06; which moments get one, and the wording, are my call).** Nobody gets dropped into something new and left to read the edges of the screen while being attacked. A card in the middle of the screen stops everything, with a big title, what to do, and the keys drawn as keys. It never times out, and only E, Space or Enter closes it. It ignores those for its first half second, so a Space meant for the fight can't wave it away, and the press that closes it never reaches the fight. Cards that come up together take turns.
  - **Every drill** opens with one, every time, because it's what that drill is asking for: Sensei's lessons, the senpai challenges, Old Gen's seme and the short tutorial. Going again within a drill doesn't repeat it. During the drill the prompt stays up top as a reminder, and the bottom line shows only that drill's keys, taking turns if they don't all fit.
  - **Once a save, right as it first happens:** your first match, as the fight starts after the bow; a tell's key prompt; the parry, as the first shine appears; the lock; crossing; each tip the first time it comes up after losing a point; the first kirikaeshi, line drill and street fight; and the first line drill with no key prompts. The parry, the lock and crossing are skipped for anyone who's had the waza lesson. What's been shown is kept in the save's `seen` list as `taught:` entries.
  - **Online matches never stop for one**, because the other player's game is running in lockstep. Getting there takes the tutorial or the waza lesson anyway.

### Always on screen
Nothing sits outside the canvas for now: the sticky club logo is removed with the club association (see above). The favicon, `app/icon.png`, is two crossed shinai drawn from a grid, like the rest of the game's art.

## Duel design

This is the core of the game. If it isn't fun, nothing else matters.

**Controls**
- **Move:** left and right, or A and D, sliding in and out of range in suriashi.
- **Openings:** hold W to raise the shinai, Q to open the wrist, E to drop the tip. A strike needs one.
- **Strikes:** J for men, K for kote, L for do, from any opening.
- **Fumikomi:** Space, with the strike.
- **Block:** S or down arrow, held.
- **Pause:** Esc. **Mute:** M. Other keys may be chosen by the builder.

**Ki-ken-tai-itchi and zanshin (owner's direction, 2026-11-05):** these apply in drills and all combat, to both fighters.
- **Fumikomi:** Space is the stomp. A clean hit with no stomp in the moment before it lands scores nothing and leaves the striker exposed.
- **Zanshin:** a clean hit doesn't score yet. The striker must hold forward and slide all the way past the opponent in suriashi, shown by an on-screen prompt and meter, then turn back. Stopping short cancels the point and leaves the striker exposed.
- **Footwork:** the right foot leads, the left foot stays grounded and drives, and the feet never cross. Double-tapping forward or back launches a long way, for ki.
- **Seme (owner's direction, 2026-11-05):** learned from Old Gen on Ravine Trail. Hold `I` to press the opponent with your spirit. You plant your feet, your ki drains, and a flickering power-up aura builds around you. Enough pressure makes the opponent flinch: their attack is cancelled, they lose ki and they're wide open. You're fully exposed while powering up, and can cancel straight into a strike or block. In gang fights it works on everyone nearby, who cower together. **If both hold seme, neither bar builds (owner, 2026-11-07),** kiai included: both burn ki until someone commits or backs off.
- **Kiai (owner's direction, built 2026-11-05):** stomp with Space while holding seme to shout. It pushes the pressure up sharply, costs ki, and needs a moment before the next one (my call on all three).
- **The ceremony:** each match opens with a bow with the shinai in the left hand (sageto), the shinai at the hip (taito), three steps in, the draw into sonkyo, and rising into guard. It can be skipped.

**Openings (owner, 2026-11-07).** The full design is in `docs/superpowers/specs/2026-11-07-openings-and-baiting-design.md`.
- **Every ordinary strike needs an opening, and any opening can lead to any strike.** Raising the shinai shows the do, opening the wrist shows the kote, and dropping the tip shows the men. It shows what's open and never what's coming. Only that target is exposed until the strike lands.
- **It can be bait.** Hold it as long as you like, and cancel at any moment into a block, parry or seme. A strike can only start after 10 ticks of an opening; pressed sooner, it's queued and still goes if you let go, so W, J and Space together work as a quick tap. A parry's counter and a hiki strike need no opening.
- **Bots live by this too.** A planned attack holds its opening for its old tell plus a little more, and can be bait, which turns into a parry if you bite. Answers (a punish or a meet) use the shortest opening. They go for an opening you show them. Lesson partners strike directly, because their slow windup is the drill.

**The clock (owner, 2026-11-07).** A whole match has 2 minutes of fighting. When it runs out, whoever has a point wins, and at one all whoever scored first wins. With no points, they go back to their lines for encho, and the next point wins, with no further limit. A strike in the air still lands and a zanshin finishes. The clock stops during zanshin, the walk back, a wakare and a crossing. Scripted fights and lessons have none.

**After a point (owner, 2026-11-05):** nothing stops. Both walk back to their starting lines with the tip lowered, turning to face each other as they arrive, and the next point starts as they settle (about a second, where it used to be 2.5 seconds and a jump). Ki comes back on the walk. The referee calls Hajime, Nihon-me, or Shobu at one all. Any tip after losing a point stays up a little way into the next one, since there's no pause left to read it in.

**The end of a match (owner, 2026-11-05):** only after the last point, because nobody sheathes between points. Both walk back to their lines, then go into sonkyo and sheathe while still down (osame-to): the shinai goes up and over to the left side, then the right hand lets go and rests on the right thigh, leaving the left hand at the waist just under the tsuba with the tip towards the floor behind. They rise, take small steps back, bow, turn and walk away, holding the shinai that way throughout with the right hand free. It's held at 45 degrees standing, and flatter in sonkyo, where 45 degrees would put the tip through the floor. The result panel comes up as they leave, and the whole thing can be skipped. Nobody celebrates, because in real kendo that can cost you the point.

**Parry (owner's request, built 2026-11-05; suriage in spirit):** tap S just before a strike lands (a tap works with up to 9 ticks to go). The opponent's tip shines before every strike you could parry (owner, 2026-11-06). It starts 17 ticks out, because the window's shorter than anyone can react, swells, and is at full size with extra rays from the first tick a tap would work. A short, high ting plays once as it appears. Tapping about 225 to 425ms after it appears parries, and a test holds that for every rival's every strike at full strength. Your own swing doesn't shine, a pull out of a lock doesn't because holding is its answer, and lessons without parries don't. Reduced motion keeps the shine at one size, since it's the cue. The strike is knocked aside, leaving the striker wide open for longer than a blocked one, and it costs you no ki where a block costs plenty. For a moment your next strike comes out fast. Mistiming it leaves you wide open and waiting before you can try again, so mashing doesn't work. Holding S on after the window just becomes a block. **A counter can be parried once (owner, 2026-11-07),** in its last 4 ticks, which is shorter than the counter itself, so it's a read. You get one try while stuck, and missing it adds 14 ticks. A second parry gives nobody a counter or ki, and both are back in guard, unless they're within 32, where they bind. A first parry binds from within 26. A counter drives in about 8 as it goes. Rivals parry some of the time, by luck, more often the better they are and less often once they've beaten you a few times. Scripted fights and lessons have no parries.

**Tsuba-zeriai (owner's request, built 2026-11-05):** walking right up to someone, launching into them (a body check, taiatari, which starts you ahead), striking from too close, or having a close strike blocked all lock you hilt to hilt. It's a three-way choice that the other fighter's pose gives away:
- **Push (D)** beats a held guard: fill the bar and they're shoved off balance and wide open. Pushing costs ki, and whoever has more ki wins an even push.
- **Hold (S)** beats a hiki strike: it's blocked, and they're left open.
- **Hiki strike (J, K or L)** beats a push: you visibly drop your hands and pull first, which is the tell, then spring back and cut. Someone still pushing falls forward into it. Someone standing idle gets hit too, so holding is the only real answer. Zanshin carries on backwards, the way you're already going.
- **Step out (A)** just ends it, at a distance where anyone can hit anyone.

If nothing's happened after about five seconds the referee calls Wakare, and both walk apart to fight on, as in a real match. Nobody's ki recovers while locked. Scripted fights step straight out, so a lock is no way around the seme barrier. Lessons don't lock at all.

**Crossing, ai-uchi (owner, 2026-11-05):** in real kendo, both people often strike at once, nobody gets anything, and they simply walk past each other. Here that's a crossing: no point, both carry on through, turn, and fight on from each other's sides, for as many times as it happens. It draws a match out.
- **Up close they bind instead (owner, 2026-11-06).** Within 32, there's no room to pass, so the same meeting locks you hilt to hilt, as real cuts often do. Rivals stand about 42 away, so that's a crossing unless someone's stepped in. Whatever a meeting does, nobody scores.
- It happens when both land together, when a strike on an open target lands within 3 ticks of theirs, or when a strike on a covered target lands within 14 ticks of theirs (a tick is 25ms in a duel: see Pace below). Answering a tell in good time still scores.
- Rivals also meet a swing with their own, which is why it comes up so often. Anything arriving around that quick strike gets caught up in it, whatever it was aimed at (my call: at first a kote beat it, which made always swinging kote a free way to score).
- They only meet a swing they've had time to see coming: anyone swinging within about 1.75 seconds of their last swing gets blocked and punished as usual, so this never rewards mashing. Scripted fights never do it.
- After a crossing, the keys still mean left and right on the screen, so walking toward them is now A. Every rule assumes the first fighter's on the left, so the rules carry on untouched and only the screen and the keys are mirrored.
- After a point, everyone walks back to their own original line, however many times they've crossed.

**Learning all this (owner, 2026-11-05):** Sensei's waza lesson teaches the parry, the parry and counter, the three choices in the lock, and crossing. It's required before the 1st dan grading, so everyone who reaches 1st dan knows them. It pays once, and can be repeated as practice. Anyone who already held 1st dan in an older save keeps it, and needs the lesson only for multiplayer.

**Pace (owner's direction, 2026-11-06; the numbers are my call).** Fights were too fast to follow, with a whole match in 6 to 9 seconds and your own men landing in 0.13. Now, against a player who answers everything in 250ms, a match takes 13 to 16 seconds with about 4 between exchanges, and it runs longer the more you get wrong. `game/duel/pace.test.ts` holds this.
- **Tempo.** The rules move on two of every three frames, so a tick is 25ms instead of 16.7ms. Everything keeps its proportions, and a press on a skipped frame waits for the next tick. It's inside the rules' `step`, which counts only frames, so an online match needs no changes and both players stay on the same beat. The bow and the closing keep their own timing. Kirikaeshi and street fights aren't duels: they don't run on the tempo, and keep their tighter strikes and stomp.
- **Strikes (retuned 2026-11-07 with openings).** Men takes 16 ticks (0.4s), kote 14, do 18, a quick strike 16, plus at least 10 for the opening. The stomp window is 28 ticks to fit them. Rivals' tells are a quarter longer, so answering a tell cleanly works up to about 400ms after it starts, where it was about 270ms. The quickest rivals also wait a little longer between swings.
- **Freeze.** Contact holds everything still for a moment, as a pure count of frames in the rules: 16 frames for a landed cut or a broken guard, 12 for a parry, 10 for a crossing or ai-uchi, 8 for a shove, lock or flinch, and 6 for a block. The strike stays out and the pose finishes arriving, so the held picture is the one that matters. Keys pressed during it wait.
- **After a point** there's half a second more on the line before the next one. Bo's opening at level 0 is now 2 seconds out of every 4, to fit the slower strike.
- The game's easier to read as a result, which makes it somewhat easier to win. Rivals' parries and meets are unchanged. Tuning this further is the owner's call at the next playtest.

**Telling things apart (owner's direction, 2026-11-06; the looks are my call).** Each thing that can happen has its own shape in `art/duel-fx.ts`, not just its own color, and they all move in held steps.
- A landed cut is a white starburst with the room going dark behind it. A block is a flat blue plate with chips thrown back. A parry is a gold crescent. A strike with no stomp is a small grey puff with no spark and its own dull thud. A miss is a few thin dashes. Stopping short is dots falling. Both at once is two half-bursts. A crossing is long pale streaks and afterimages. A lock is two crossed red bars, and the room stays a little dark while it lasts. A broken guard is falling red shards. A shove is chevrons. A stomp is a crack along the floor. A launch leaves lines behind. A shout is one thin violet ring, and a flinch is violet sparks round the head; violet is only ever seme. A point that counts raises gold rays behind whoever scored it.
- **What state they're in.** A strip on the floor under each fighter is colored by what they're doing. A held guard shows a blue plate in front of them. Anyone left open has a label over them and a bar for how long's left: Open, Wide open, Stunned, Stumbling, and Parrying and Counter! on the good side. In a lock it says Push, Hold or Pull! for each of them. It only says what their pose already shows, so a tell's prompt is still only given where the fight allows it.
- **Choppy but clear.** Everything in a duel animates on threes: a drawing holds for 3 frames before the next one, a strike gathers in 3 stages, and arms stay out for a third of a second. Labels last about twice as long. Reduced motion keeps every label and effect at one held frame, and drops the shake, the flash, the dark room and the afterimages. The freeze stays, because it isn't movement.

**How it moves (owner's direction, 2026-11-06).** The movement comes from watching a real match between two 7th dan frame by frame. It only changed what's drawn. A strike's last 12 ticks gather: the hands keep rising and the body drives forward, and both feet leave the floor around the cut. The arms are fully out only for a moment, then go back up over the head and stay there through zanshin and a crossing. Nobody reels from being hit: the hands stay up and the knock is 2 pixels. In a lock the hands are at the chest and the blades upright, and a pull still drops them, because that's its tell. Parting from a lock, the bodies go first and the tip comes down last. The blade comes up high on the draw, sonkyo is a slow sink and rising from it is slow too, with the legs bending in stages so they always meet the body. The men's ties and the hakama stream out at speed, and crossed tips move together. Reduced motion keeps the gathering, since it's part of the tell, and drops the hop and the rippling.

**Later, as more real waza (my suggestions, not built):** harai (sweeping their shinai aside to make an opening) and nuki (slipping a strike by stepping out of it and answering).

**A strike hits only when all three are right:**
1. **Distance:** too far and it misses. Too close and you lock shinai (tsuba-zeriai) and score nothing. In a lesson you're just pushed apart instead, so a drill stays a drill.
2. **Target:** it must hit a target that the defender's current stance leaves exposed.
3. **Timing:** it must land while that stance lasts, and openings are brief.

**What each stance exposes (the same rules apply to both fighters):**

| Stance | Exposed targets | Notes |
|---|---|---|
| Plain guard, no key held | All three | The only place ki recovers, so resting is a risk you choose |
| Blocking, key held | None | Can't move or strike. Drains ki slowly, and every absorbed strike costs more |
| Holding an opening | Only the one target it shows | Can walk and launch. Drains ki a little faster than a block |
| Striking from an opening | The same one target | Committed, with the tip's shine as the warning |
| Recovering from a failed strike | All three | The price of a bad swing, which stops mashing |
| Guard broken, ki ran out while blocking | All three | Brief stun, which stops turtling |
| Parrying, just tapped | None | A short window, and you can't move or strike during it |
| Parried, strike knocked aside | All three | Longer than recovering from a block |
| Off balance, shoved or caught leaning in a lock | All three | The price of losing the lock |
| Walking through a crossing, and turning | Nothing lands | Nobody can do anything for about half a second |

The rival's AI normally holds block when the player is in range. Its openings therefore come mainly from its own tells and recoveries, and from running its ki down. A clean strike shows the kiai as a speech bubble ("MEN!"). The three referees raise their flags 12 ticks after the hit, about as the striker gets past (owner, 2026-11-06), and the point itself only counts at the end of the slide. Stop short and the flags come back down, the way referees take a point back.

**Ki**
- Swinging, launching, holding an opening and holding a block all drain it, the last two slowly even when nothing touches you. It only recovers in plain guard, standing or walking (owner, 2026-11-07). An opening needs at least 10 to start.
- Low ki means slower steps and strikes and longer recovery.
- Ki never ends the match by itself, but running out while blocking breaks your guard, and running out in an opening drops you into plain guard.

**The rival** has about three readable habits, each with a tell that can be seen before it happens. The exact habits and numbers are tuned during playtesting. Rule: **every rival attack has a visible tell, and every loss has a learnable reason.**

**Difficulty:** the rival is at full strength on the first attempt, so a kendoka gets a real fight. After each loss, its tells last a little longer. The tuning target is that most newcomers win within about three tries.

**Losing:** the rematch screen shows one specific tip based on what scored against the player, for example "Their hands rise before they strike. Try kote." A flinch says to hold I once you know seme, and never before.

**Authenticity notes**
- No invented special moves, and health never decides a point: one clean strike still scores, whatever your HP.
- The senior's and rival's lines use real terms with a plain-language explanation.

## Art direction (my call, for owner feedback)

- **No image files for game art:** sprites are text grids in TypeScript with one shared palette, drawn to offscreen canvases at startup. The text font is also a small code-drawn bitmap font. No art pack, because none includes kendo armor and mixed styles would hurt the charm.
- **Palette:** about 20 shared colors, plus a set per character, built around the site's red `#E8192C`, dark `#1A1A1A` and cream `#FAF7F2`, plus the indigo of kendo armor and warm wood tones.
- **Scale:** 256×144 internal resolution (the owner asked for chunkier pixels), filling the window as described under Clearer on screen. The interface draws at about twice that resolution.
- **Characters:** chunky, big-headed and cute, with a small walking animation. Duel sprites are larger so the men, kote and do openings are easy to read.
- **Sound:** simple code-generated beeps and shinai hits, with mute. No music.
- **Voices:** everyone who speaks babbles as their words type out, one synthesized syllable per few letters (`game/core/babble.ts`, `say` in `game/core/audio.ts`). It's a buzz through two formants, so the letters on screen decide the vowels and a line always sounds the same. Each person's pitch, pace, wave, head size, lilt, fall, loudness and breathiness is in `game/scenes/voices.ts`. Narration and labels like "Tare: ..." stay silent, as do drill prompts and ambient bubbles, which aren't typed out. No recorded audio ships with the game.
- **Feedback rounds:** a dev-only art sheet (`/?art`) shows every sprite and animation, so the owner can react. Its cast, stages, districts and streets come from the game's own lists, so new ones appear by themselves.

## Technical approach (my calls)

- **Own lightweight Canvas 2D code, with no game engine.** The game needs only a fixed 60Hz loop, keyboard input, tile collision and sprite drawing. Phaser (latest is 4.2.1) would add a large dependency for features we won't use, and movement and duels need custom tuning anyway.
- **Its own project (owner, 2026-11-06).** A Next.js app with one page, at `/`. `app/page.tsx` is a server component. It renders a client wrapper, which lazy-loads the game with `dynamic(..., { ssr: false })`. `ssr: false` must be in a client component (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:94-95`).
- **Links to the club (owner, 2026-11-06; removed for now, owner, 2026-11-07).** There are none at the moment. The game shares no code, styles or analytics with the club's site, and is open to search engines (my call).
- **Input:** the game calls `preventDefault` on keys it uses, and sets its own dark background and `touch-action`.
- **Duel logic has no canvas or browser code.** It is a pure `step(state, inputsA, inputsB)` with both fighters driven by the same input structure and the rival's AI producing inputs. That makes it unit-testable, and it's what online matches run on (see Multiplayer).
- **Tests:** Node's built-in `node --test` on pure logic, with no new dependencies. `tsconfig.json` has `allowImportingTsExtensions`, allowed because `noEmit` is on. Node is 24.18, which runs TypeScript directly.
- **Files:** `app/` (the page and layout) and `game/`, split into `core/` (loop, input, collision), `duel/` (pure logic and AI), `scenes/` (title, club, training, line drill, map, travel, brawl, rival dojo, duel, tournament), `art/` (palette, sprites, font), `net/` (multiplayer) and `world/` (places and people).
- **Phone detection:** coarse pointers without hover get the "play on a computer" screen and a link back, and never download the game code.
- **Reduced motion:** turn off screen shake and flashes when the visitor's system asks for less motion.

**Playtesting and commits:** checkpoints run on the owner's machine with the dev server. No commits are made unless the owner asks. Hosting is covered by `docs/superpowers/specs/2026-11-06-accounts-multiplayer-design.md`.

## Build order, with owner checkpoints

Once this design is approved, it is saved to `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md` (uncommitted), and a detailed implementation plan follows these steps.

1. **Foundations and art:** `/game` page, sticky logo, phone screen, loop, input, palette, sprite and font system, and a dev-only art sheet. **Checkpoint: is the art cute enough?**
2. **Duel, tested on its own:** pure duel logic with tests, then a playable duel against the rival. **Checkpoint: the owner, and ideally a club member, plays it. Is it fun? Tune it or rethink it before anything else is built.**
3. **Your club:** top-down movement, gear pickups, sprite changes, dialogue and training.
4. **The secret:** the cracked screen, the storeroom and the tsuba's effect on ki. (A road level was built here and removed at the owner's request.)
5. **Rival dojo and full flow:** rival room, transitions, loss tips and a win screen, since removed. **Checkpoint: full playthrough.**
6. **Polish:** sound, reduced motion, pause and mute, and a final tuning pass.

## Verification

- **Duel logic (`node --test`):**
    - A strike scores only with correct distance, exposed target and timing, and each wrong case scores nothing.
    - Each stance exposes exactly the targets in the table.
    - Ki drains and recovers, low ki slows the fighter, and running out while blocking breaks the guard.
    - The match ends at 2 points.
    - In simulated matches against the rival, mashing strikes doesn't win, holding block doesn't win, and an idle player loses.
    - The rival's tells get longer after each loss.
- **Build:** `npm run build` passes with type checking.
- **Real playthrough:** use Chrome DevTools with real keyboard events to go from the title through a win over a dojo's head. Confirm gear changes the sprite, the cracked screen breaks, the secret raises ki, a loss shows a tip, and the Grand Taikai's Discord and email options work. Check that the console has no errors.
- **Sticky logo:** removed for now, along with the club association.
- **Phone:** with mobile emulation, the page shows the message and requests no game code.
- **Search engines:** the HTML has no noindex tag.
- **Screen fit:** at any window size or shape, the canvas covers the window with no bars, pixels stay square, the whole stage is on screen, and resizing mid-fight keeps the fight going.
- **Fun can't be verified by a tool:** that is what the owner's checkpoints at steps 1, 2 and 5 are for.

## Duel polish, after the first full playthrough

The owner played the duel on 2026-11-05: "definitely is fun and feels like kendo", and challenging but fun. It is good enough for now.

- **Quick-time events (built 2026-11-05, my call on when they show):** when a tell is showing, a small box over the opponent names the key that answers it, with a timer. They always show against senpai, in the line drill's first two runs, against Sora and in your first street fight. Later rivals only show them after beating you twice. Momo and the tournament never do, and Ren only does once you know the far-mountain gaze. The zanshin prompt and meter stay as they were.

## What's next

**Hosted multiplayer has its own design (owner, 2026-11-06),** in `docs/superpowers/specs/2026-11-06-accounts-multiplayer-design.md`. Club representation and a leaderboard are to follow. The leaderboard is open to every rank, not just dan holders (owner, 2026-11-05). It can show the rank and level built here, and nothing is built for it yet. Touch controls get their own later spec. Each one is a separate design.

## Every dojo is its own place

A match happens in the room you were just standing in. The room seen from above and the court seen from the side share one set of data (`art/looks.ts`): floor, walls, what's outside the windows, decorations, and the crest. A new dojo is one more row.

| Place | Floor | Walls | Outside | On the wall |
|---|---|---|---|---|
| Pinecone (home) | Honey boards | Paper screens | Bamboo | Rack and plant |
| Thunder Radish | Dark lacquer | Black and gold panels | A storm | Taiko drums |
| Angry Goose | Pale parquet | Plaster, orange bands | A pond | Footprint signs |
| Sleepy Raccoon | Tatami | Paper screens at dusk | Moon and stars | Paper lanterns |
| Iron Heron | Bolted steel | Steel plates | The foundry | Iron gears |
| Soggy Otter | Wet driftwood, with puddles | Damp slats | Rain | Life rings |
| Grand Arena | Polished maple | Plaster, crimson boards | Open sky | Pennants |
| Grading hall | Quiet boards | Plaster, green boards | A kept pine | Scrolls |
| Old Gen's hut | Packed earth | Rough logs | The ravine | A kettle, and no banner |

**Who's there (`world/courtside.ts`).** The people watching are that dojo's own people, and never the person you're fighting. The dojo's sensei sits on a gold cushion: Sensei Kuma at home, and Raiko, Kan, Nemu, Hagane and Mizu at the rival dojos. The seniors below them hold the three flags, chief first, and any left over sit on cushions in the dojo's color. Everyone else fills in along the wall in the team color. At a grading and the Grand Taikai, judges in blazers hold the flags. Nobody is at Old Gen's hut. A timekeeper is planned for later.

**Rival senseis.** Each stands under the crest in their own room with a couple of lines to say. They wear the team armor with gold trim and grey hair. You can challenge them: see Challenging other dojos' senseis.

**Team colors.** Everyone at a dojo wears its armor and its tare cloth. Named seniors stand out: at rival dojos by gold trim on the team armor, and at home by their own armor, so a home match stays readable.

**What you wear.** Everyone starts in Pinecone green, whichever character they picked. Each other dojo's table sells its own colors, the home table sells your character's own armor color, and the shop and cup stalls sell more. Colors go on when bought, and come off from the inventory, which puts you back in green. Your own tare design stays on whatever you wear.

**The men (owner, 2026-11-06).** Once you've earned it, you walk around bare-headed by default and the men goes on for fights: duels, training, the line and brawls. E on the men in the inventory keeps it on outside fights as well, and pressing it again takes it back off. This only changes what's drawn when you're out of a fight (`walkingGear`), so ranks, rewards and story checks still count it as yours. Each of the six characters has their own men (my call on the designs): grille, cords, stitching, crest and throat guard. It's drawn the same in any armor colors, so you can always tell who's under there, and it only changes how you look. Everyone else's men is unchanged.

## Getting a grading ticket (owner's rules, 2026-11-05)

Passing retires your ticket, so every new rank needs another bout. There are still other ways up: the tournaments and the exceptions.

- **You have to beat someone at the target rank or above.** At home, a senpai handles 1st dan, and past that Sensei chooses who tests you. At another dojo, you can ask a helper or the rival, and anyone too junior says so.
- **Home gets you a ticket. Anywhere else gets you a letter.** The letter has to go home to Sensei or a senpai, who has the last word.
- **Showing the letter is partly luck, and each person differs.** They take its word and give you a ticket, or want one point to see for themselves, or say no. A no tears up the letter. Losing the one point keeps it. Aki is the easiest to convince (60% yes, 30% test, 10% no), then Sensei (45/40/15), Bo (35/50/15) and Yui (20/60/20).

## More luck in general

Moods are shown as you bow, and they're always true ("Yui looks calm. Watch for kote."). Dojos have other things you might walk in on. Helping the beginners and first-time street rescues sometimes earn a tip of 5 to 25 kensen.

## Challenging other dojos' senseis

Nemu and Kan need 2nd dan, and Mizu, Hagane and Raiko need 3rd. Beating them is worth kensen, ki and bragging rights, but no rank, and there's a challenge for beating all five. They're built so that mashing never wins and it takes seme to stand up to them.

**Reading the senseis (owner, issue #4).** Their existing styles have distinct habits: Kan favors big men and charges, Nemu favors kote with a long tell, Mizu keeps a quick rhythm, Hagane waits and often parries, and Raiko mixes openings with attacks. Every rival dojo has a practice note tucked into a rack or plant that hints at a way to respond. It can be reread and shares its hiding place with any existing stash without replacing the reward. These opponents still use the normal visible openings and counterplay.

## Multiplayer (owner, 2026-11-05)

The minimum rank is 1st dan. Real matches are duels through a lobby code or invite link, on an account. `docs/multiplayer.md` has the details, and `docs/superpowers/specs/2026-11-06-accounts-multiplayer-design.md` has the design.

- **Two ways in.** Reach 1st dan in the story with the waza lesson, or take a short tutorial, which goes straight in without starting a story. Multiplayer is always on the title screen and in the story menu, and leads to the tutorial for anyone who hasn't done either.
- **Short tutorial.** One go each at openings, a strike, answering a tell, a parry, seme, pushing in a lock, a pull-back strike and a crossing. The seme step gives nobody seme in the story.
- **The offer before a match (owner, 2026-11-07).** Everyone has seme online. Anyone about to play who hasn't been shown openings or seme is told so, once, and offered a quick tutorial, which they can decline.
- **Accounts (owner, 2026-11-06).** A unique username and a password, and nothing else. An account keeps your story, your record and your match history. The story still plays without one as a guest, after a warning that progress may be lost after this session.
- **A story's money, ki and gear have no effect on a match:** everyone fights with the same ki and full armor.
- **Tournaments are practice for now.** They play stand-ins, which are ordinary rivals getting harder round by round, and don't touch an account's record. With no server configured, duels are against stand-ins too, and the screen says so.
- **A match can't be skipped** the way the ceremonies can in the story, because both players have to stay in step.

**Multiplayer appearance and rank (owner, issue #5).** Players choose a separate multiplayer character, armor colors and tare insignia even without a story, and can edit them again from the multiplayer menu. Existing story characters and insignia seed the first choice. Appearance is saved in the browser, separated by account, and is not synced between devices. Pinecone, personal and ink colors are available immediately; Bronze also permits Raccoon and Goose, Silver permits Heron and Otter, and Gold permits Radish. Bronze is the default, Silver requires at least five recorded human matches and a 50% win rate, and Gold at least ten and a 65% win rate (owner confirmed thresholds). Practice against stand-ins does not unlock ranks. The server checks the account record before sending a selected appearance to the opponent. Both screens show the same fighters, with a persistent local-player marker. The server randomizes starting order; the displayed sides rotate after every point while lockstep identities stay fixed.

## After a fight, leaving, health and talk (owner, 2026-11-06; numbers are my call)

- **After beating a dojo's head:** no results menu. You're back on their floor, standing where you were, and they talk to you. The win screen is gone. Rematches come from talking to them, and the title is in the pause menu. The quiet contact line stays on the Grand Taikai win.
- **Leaving:** doors never open by walking into them. E at a door offers "Just walk outside" and every place you've been. Picking one walks you there on the map at 1.5x speed, riding any streetcar or train on the way, and goes inside if it's a dojo, shop, hut or arena. X stops the walk where you are. Only places worth setting out for are listed, nearest first, and never anywhere you can't currently reach.
- **Health:** 100 HP, saved with the run, and shown as a bar once you're armored. A fist costs 15 and a stick 20 in a street fight. A match away from home costs 20 per point you concede, so three straight 2-0 losses take you down, and a win never knocks you out. Home sparring, lessons, cups and gradings cost nothing, because they have stakes of their own or are practice. You heal 1 HP every two seconds outside fights, and all the way on entering your home dojo.
- **Going down:** at 0 HP you wake up at Pinecone, healed, and whoever beat you keeps half your kensen. It's never gone for good: what several knockouts take adds up per person, and beating them returns all of it. The next-thing-to-do line and the holder both remind you.
- **Talking:** Talk opens What's new?, How's it going? and Any advice?. News reacts to what you've done, most pressing first, and each thing is said once. Small talk and advice go round in order, so nobody repeats themselves until they've said everything, and where they've got to is saved.

## Later, not built

- **Fighting in Jodan or Nito yourself.** Off for now. It'll unlock through a pathway later, something like reaching 4th dan or 2nd dan. 4th dan doesn't exist yet, since ranks stop at 3rd.
- **Betting on other people's matches.** This comes with hosted multiplayer, since it needs a server to hold the money. Today you can only bet on yourself, and stakes already settle per side.
- **A timekeeper at matches.**


## More places to visit

The beach, park, steel and falls maps each have a regional shop and a quiet side path. The shops sell distinctive cosmetic armor that works with the existing inventory and save. Looking around the side paths reveals one small 25-kensen discovery per district, once per run. Two optional dojos, Lantern by the beach and Bamboo by the park, have their own rooms, people and challenges. They add practice and rewards without changing the existing route to Ren; they do not host cups.

**Custom controls (owner, 2026-11-08).** The pause menu opens a controls editor with the default bindings prefilled. Every action can have one or more keyboard keys, and actions can share a key. Guests keep controls in browser storage; signed-in players keep a separate account setting that follows them to another browser. Restoring defaults changes only the controls.

## Equipment and modifications

Every dojo merch table and regional shop carries themed equipment alongside its colors. The tournament stall and Bogu Shop sell gear too. Equipment occupies one of five slots: shinai, tare, do, men, or kote. Buying a piece selects it if that slot has been earned; shopping cannot skip Sensei's armor lessons. Only the selected piece in each slot contributes ki or takes wear, and spare pieces keep their own durability. Original saves retain their purchased gear through default selections. The omamori charm remains a passive bonus.

Each shop has Browse and Modify views. A modification is fitted directly to an owned compatible piece for the displayed price. Each piece holds one mod: fitting a different one replaces it. Balanced grips add shinai ki, soft linings add armor ki, and reinforcement reduces wear per fight. Premodified gear comes with the same working modifications sold at the bench. Inventory shows the selected gear, its current mod, total effects and durability. Color outfits remain independent of equipment selection; distinct equipment details also appear on the player.

## The dungeon trial

After defeating Sensei Raiko, ask him about a cold draft, then inspect the shinai rack on Thunder Radish Dojo's north wall. The optional passage leads to Ren's secret lair. Ren catches the player in an interactive encounter ending in scripted capture. This story encounter does not affect ordinary duel records, bets, grading or knockout penalties.

The dungeon is an original side-view platforming trial with grounded jumps, pits, timed traps, ninja guards, scavenged weapons, scrap-crafted armor, checkpoints and hidden discoveries. Controls use the player's configured actions: left/right move, up jumps, down guards, men attacks and confirm interacts. Death retries locally; leaving the trial safely restores the original equipment and permits another attempt. Ren is revealed as a ninja spy before a winnable final encounter and escape.

Capture saves the entire original equipment loadout in durable escrow, including owned variants, modifications, durability, cosmetics, selected equipment and shinai story flags. Temporary dungeon gear remains separate. Saved progress resumes the trial; escape or abandonment restores the original loadout atomically. Escape grants 120 XP and 100 kensen once. General city runners and replacing existing street encounters remain future work; no specific existing game's art or level layouts are reproduced.
