# Openings and baiting: design

Status: approved by the owner and built, 2026-11-07. Uncommitted, because `AGENTS.md` says never to commit unless the owner asks. The numbers below are what's in the code, where tuning moved them.

Decisions marked **(owner)** came from the owner. Everything marked **(my call)** is Claude's suggestion, which the owner has seen in summary but can still change. Every number is a starting value, to be tuned by the simulations and by playing.

## Why

Today a bot's strike shows a tell for about 0.95 seconds, but a player's men lands in about 0.33 seconds with almost nothing to read. Neither can back out once a strike starts. Duels between two people therefore come down to speed, not reads.

The owner wants drawn-out, nuanced duels between players, where the first attack often isn't the one that scores.

**Two exchanges that must be possible (owner):**

1. A raises their shinai. B goes for the do, which is what that opening shows. A was baiting, and parries at the last moment instead of striking men. A counters, but B saw that coming and parries the counter. They end up hilt to hilt, because they're close, and one of them wins it with hiki men and zanshin.
2. A opens their wrist. B doesn't bite, and answers with seme. A presses back with seme. Someone finally attacks, and the other parries.

## Goals, non-goals and anti-goals

**Goals**
- Every ordinary strike in a duel has a visible opening before it, for players and bots alike.
- An opening can be a real attack or a bait, and the other player has to read which.
- Ki decides when you can afford to do what, so that resting is a risk you have to choose.
- It applies to the story and multiplayer, and is tested and balanced for player against player.

**Not in this work**
- Street fights, the line drill and kirikaeshi don't change (my call). They run on their own rules (`duel/brawl.ts`, `duel/kirikaeshi.ts`), not on the duel's `step`.
- The player still only fights in chudan.
- No deployment, commit or push without the owner asking.

**Failures, even if it technically works**
- Openings turn into a formality that adds a delay but no decisions.
- Baiting costs nothing and always works, so that nobody ever needs to actually strike ("purely bait mechanics", owner).
- Duels can be won by mashing, by holding block, or by running away.
- A strike can't be read, or an attack comes with no visible tell.
- It stops feeling like kendo.

## The rules

### Openings (owner, apart from the details marked)

There are three openings, each leaving one target exposed.

| Key (my call) | Opening | Target left open | Existing pose (`OPENING_POSE`) |
|---|---|---|---|
| Hold W | Raise the shinai | Do | `tellBigRaise` |
| Hold Q | Open the wrist | Kote | `tellHandsUp` |
| Hold E | Drop the tip | Men | `tellTipDip` |

- **An opening is required before a strike (owner).** J, K or L does nothing unless you're in an opening.
- **Any opening can lead to any strike (owner).** The opening shows what's open and never what's coming.
- **While held,** only the opening's target is exposed. The other two are covered, as in today's windup (my call).
- **It can be cancelled at any moment (owner).** Releasing the key returns you to guard, S goes into block or parry, and I goes into seme.
- **Holding (my call).** You stay in an opening as long as the key is down, and can walk and dash in it. Pressing a different opening key switches to it and restarts the minimum time.
- **Minimum time (my call).** `OPENING_MIN` is 10 ticks (250ms) before a strike can start from a new opening. A strike key pressed sooner is queued and starts when the time is up, even if the opening key has been let go, so W+J together works as a quick tap. S or I cancels a queued strike.
- **The strike (my call).** Windups are men 16 ticks, kote 14, do 18, up 2 from before, which is where the simulations were most even. So a men from plain guard takes about 0.65 seconds from first press to landing. Once a strike starts you're committed. The opening's target stays exposed until it lands, and the tip shines as usual, so it can still be parried. J, K and L still need Space for the stomp.
- **Starting an opening needs a little ki (my call).** At least 10, as with seme. Someone with nothing left has to rest in guard before they can attack.

**Strikes that need no opening (my call):**
- A parry's counter, because the parry came first.
- A hiki strike, because the pull is its tell.
These two keep today's `exposes` table for what they leave open. Every other strike, including the bots' `quickMen` and `bigMen`, needs an opening.

### Plain guard and ki (owner)

- **Plain guard is the only place ki recharges,** standing or walking. That's the only reason to be in it.
- **Plain guard stays fully exposed.** The usual stance when you're not tired is an opening or a block, and resting is a visible risk you take. An alert player in guard can still block in time, at the usual block cost.
- **Holding a block drains ki slowly,** even when nothing hits it. Starting value (my call): `BLOCK_DRAIN` 0.1 a tick, against `KI_RECOVERY` of 0.25.
- **Holding an opening neither drains ki nor recovers it (owner, issue #15).** It used to drain 0.2 a tick, which punished simply waiting with bait out. It still isn't plain guard, so it's no place to rest.
- **Running out (my call).** A block that reaches 0 breaks your guard, as an absorbed strike does today. An opening no longer drains, so it can't run out.
- **Dashing costs ki,** as it does today.

### Seme

Seme mostly keeps its rules: it costs ki, plants your feet and leaves you exposed, and it builds pressure on someone in guard, block or an opening. It now cancels into an opening rather than straight into a strike.

**Seme is the answer to free bait (with issue #15).** Once holding an opening stopped draining ki, the simulated reader and presser, which only ever gambled on an opening or waited for it to run out, lost to the counter-only baiter (43 to 5 and 38 to 10, with many matches never ending). The rules didn't change for it: the simulated players now play the answer a person would. The presser stops gambling on an opening held longer than 40 ticks and presses it like anything else, and the reader keeps pressing one held longer than 240 ticks (6 seconds) down to 25 ki instead of 50. Counter-only then loses 1 to 47 to the reader and 2 to 46 to the presser, and baiting against reading is 29 to 19.

**The standoff (owner).** While both fighters hold seme, neither pressure bar builds. Both burn ki until someone commits or backs off. A kiai doesn't add pressure during a standoff either (my call, following "neither builds"). Bars keep the value they had, and only start fading or climbing again once the standoff ends (my call). Check that Ren's and the senseis' pressing, and the tests about holding seme against them, still make the story's promises.

### The match clock (owner)

- **A whole match has a 2-minute limit,** covering both points.
- **When time runs out,** whoever has a point wins.
- **If both have a point,** whoever got theirs first wins.
- **If nobody has a point,** they go again until someone scores, and that point wins. There's no further limit.

The details (my call):
- **Where it applies:** every duel with a real result, online and in the story, including cups and gradings. Lessons, Momo's rigged fight and Ren's one-point lesson have no clock, because their scripts decide how they end.
- **What's counted:** rule ticks during the `fight` phase, including a lock, so it's deterministic in lockstep and part of the hash. 2 minutes is 4800 ticks at 25ms. The clock stops for the bow, zanshin, the walk back, a wakare, a crossing and the closing, as a real timekeeper would stop it for a call.
- **The last moment:** a strike already started when time runs out still lands, and a zanshin finishes. The result is decided once nothing's left in flight.
- **What's kept:** `DuelState` records who scored first, since `lastScore` only holds the latest point.
- **On screen:** a small clock in the duel HUD, and the referee calls the end of time. A go-again is labelled with the real term, encho.
- **Bets, health and records** treat a win on time like any other win. A loser who scored still counts the points they really got.

**A known risk:** someone with the first point can try running out the clock. A chaser can launch and the ring has edges, so the simulations measure this directly (see below). If it wins too often, that's for the owner to decide after seeing the numbers, since it's also a real part of competitive kendo.

### Parrying and countering (owner)

- **Only one counter-parry.** A parries, A counters, and B can parry that counter. Nothing after that can be parried, so counters never chain.
- **The window for parrying a counter is smaller.** Starting value `REPARRY_WINDOW` 5 ticks (the latest tap is 4 ticks out) (my call), against 9 for a normal tap. A counter lands in 6 ticks, which is faster than anyone can react, so this is a read of when it's coming rather than a reaction. That matches the owner's "the other player also knew it".
- **The parried fighter (my call, owner approved):** stays stuck as now, except for this one try. It ignores the parry cooldown. Tapping and missing adds `REPARRY_MISS` 14 ticks to the time they're stuck.
- **After a second parry at normal distance (my call):** nobody gets a counter. Both return to guard, and it's a fresh round of reads.
- **Parrying a counter gives no quick counter of its own,** and no ki.

### Hilt to hilt (owner)

Locking comes only from being close, never from a parry as such. It happens when both strike at once up close, when a close strike is blocked, or when a parry (first or second) happens very close. Everything inside the lock stays as it is.

Distances (my call, chosen so that the first exchange above comes up in real play):
- A first parry locks only from 26 or closer, so there's normally room for a counter.
- A counter drives forward about 8, in the way a launch moves you, so it closes the distance.
- A second parry locks from `CROSS_LOCK_WITHIN`, 32 or closer. From a usual distance of 40 to 44 the counter brings them to about 32 to 36, so stepping in slightly first is what turns it into a lock.

### Punishing a miss has to stay possible (my call)

A failed strike leaves you exposed for `RECOVERY_TICKS` 26. Answering from plain guard would now take a reaction of about 10 ticks, plus 10 for the opening and 14 for the strike, which is 34. Nobody could punish a miss unless already holding an opening. `RECOVERY_TICKS` goes to 38, so a punish from guard just fits and holding an opening gives more margin. `DEFLECT_TICKS`, `BROKEN_TICKS`, `SHAKEN_TICKS` and `STUMBLE_TICKS` get the same check in the simulations.

### Bots (my call, in the owner's direction that they use the same system)

- **Same rules as players.** Every strike goes through an opening and pays the same ki. There's no exemption for `quickMen`, punishes or meets.
- **Reactive strikes use the minimum (my call).** A punish or a meet isn't a planned attack, so it opens for `OPENING_MIN`, the same as a player's fastest, then strikes. If the bot is already holding an opening, it strikes straight away. A long tell here would mean bots could never punish a miss or meet a swing, and most crossings would disappear. `quickMen` needs no entry in `RivalConfig.tell`.
- **Planned attacks stay readable.** For a planned attack, a bot's opening phase lasts its current tell, and its strike follows at the normal windup or its `windups` override, whichever the builder finds keeps the guarantee below. The guarantee: answering a real attack from plain guard still works up to about 400ms after the opening appears, and `pace.test.ts` keeps holding that. Easing after losses still lengthens the opening.
- **Which opening a bot shows.** Its strike no longer dictates it. A style picks from its own preference, so rivals keep their character.
- **Baiting.** A new `bait` chance per style: how often an opening is a bait, which cancels into a parry or block if you bite. None for senpai and scripted fights, low for Sora, rising to the highest for Ren and the senseis. Bait never replaces every attack, so they always strike eventually.
- **Biting.** A new `bites` chance per style: how often they strike an opening you show.
- **Resting.** Bots used to hold block by default. With a draining block they now cycle through block, opening and rest, and the existing `catchingBreath` covers low ki.
- **Stances.** Jodan and nito only show openings their stance can leave open: kote or do for jodan, and do for nito, keeping `KAMAE`'s character.
- **Rigged fights keep their script.** Momo and Ren's demonstration don't drain from holding a guard and never bait, so a lock on the story can't be walked around. A new duel option covers this.
- **The story ladder** gets re-tuned so that the tests in `rival.test.ts` and `pace.test.ts` still describe the same promises: mashing and holding block lose, an idle player loses, simulated readers beat the rivals at the promised rates. Numbers in the tests may change where the rules really changed; what they promise stays.

### What's on screen (my call)

- **Poses.** Reuse `tellBigRaise`, `tellHandsUp` and `tellTipDip` as held poses, and start each strike's gather from whichever opening it came from. Each opening needs a pose in all three kamae that bots use, and a drawn difference at a glance, in reduced motion too.
- **Readable state.** The floor strip gets a color for an opening, and the existing label over a fighter names the open target, in the same way as Open and Wide open.
- **Key prompts.** Where the fight allows them, the prompt names the target's strike key. Tips and help lines get rewritten for the new rules (`duel/tips.ts`, `HELP_LINES`).
- **A strike with no opening** does nothing, and the first few times in the story it shows a hint to hold W, Q or E.

### Teaching (owner for seme, my call for the rest)

- **Story.** Sensei teaches openings in the first lesson, before the first men drill. It has its own teaching card, and every later lesson expects it.
- **Existing saves.** Anyone past that lesson gets the teaching card once, on their next duel, using the `taught:` entries in `seen`.
- **The short tutorial** gets two new steps: an opening and strike first, and a seme step (owner). The seme step doesn't set `run.seme`, so it can't unlock anything in the story.
- **Story players going online without seme (owner).** Before their first match they're told they don't know it yet, and offered a quick tutorial, which they can decline. Online gives everyone seme already (`scenes/online-duel.ts`). The same offer covers anyone who hasn't seen openings, such as someone who took the old tutorial.
- **Online matches never stop for a teaching card,** as now.

### Online (my call)

- `FighterInput` gets a held `opening` field, which needs two more bits in `encodeInput` and `decodeInput`, and `PROTOCOL_VERSION` goes to 3. The server already turns away a mismatch, so an old tab gets told to refresh.
- Everything goes through the pure `step`, so lockstep needs no other change. The hash already covers the whole state, and any new field has to be deterministic and serialisable.
- `net.test.ts` gets a match with openings, cancels and a counter-parry played through lockstep, checking that both sides agree.

## Balance testing for multiplayer (my call, approved by the owner)

A new `game/duel/balance.test.ts` plays player against player through `step` with `ONLINE_RULES` and no rival AI. Each player is a scripted style, with a 250ms reaction, plus lockstep's input delay. Seeded, and run over enough seeds to be stable.

| Style | What it does |
|---|---|
| Masher | Opens and strikes as fast as it can, whatever the other player's doing |
| Turtle | Holds block, and strikes only when forced to rest |
| Runner | Backs off to recharge whenever it can, and comes back to strike |
| Idle | Does nothing |
| Patient reader | Waits, reads, and strikes what's open or parries what's coming |
| Baiter | Shows openings, cancels into a parry often and strikes sometimes |
| Pressurer | Uses seme on anyone resting or blocking |

**What the tests hold**
- No style beats every other style.
- Masher, turtle and idle each lose to the patient reader at least 65% of the time. The runner wins no more than half against the reader, and loses at least 65% of the time to a masher, turtle or baiter.
- Baiter against patient reader stays between 30% and 70% each way.
- A counter-only baiter, which never starts a strike and scores only from counters, wins no more than 60% against the patient reader, and less than half against a baiter or a presser, so baiting alone is never the best plan (my call).
- The clock's three endings each come out right: one point, both with a point, and nobody with a point going to encho.
- Anyone willing to strike always gets a result. Two players who never start a strike can sit in encho for ever, which follows from the owner's rule that they go again until someone scores.
- Fewer than 25% of matches between even styles reach the clock at all, so that it's a backstop rather than how matches usually end.
- A runner holding the first point keeps its lead until time runs out less than 50% of the time against the patient reader. The test prints the real figure (4 of 16 when built), for the owner to judge.
- Between even styles, a match's average length is at least 12 seconds. Scripted styles decide far quicker than people do, so this only shows the rules aren't ending things instantly. Real length is for the playtest.
- Scripted players notice a strike in 225 to 450ms, half the time from its opening, and parry 45% of the strikes they notice. These are guesses at people, and the results move a lot with them.
- Both exchanges from the top of this document can actually be played, as scripted tests with exact inputs.

**What simulation can't tell us:** how it feels, and how real lag affects the reads. That needs the owner and another person on real devices. Testing on the real game is the owner's rule, so once this is built and the owner has asked for it to be deployed, that playtest is the last step. Numbers change after it.

## Docs to keep true

`docs/superpowers/specs/2026-11-05-tiny-kendo-design.md` needs its Duel rules, Controls, Duel design, stance table, Parry, Seme, Ki, Pace and Multiplayer sections updated to match, along with `docs/multiplayer.md`, the Controls page and the help lines.

## What's left to the builder

- The final numbers, within the failures listed above.
- How to structure the new stance and fields in `rules.ts`, and how the input is buffered in `createPlayerControl`.
- Exactly how each style's `bait`, `bites` and preferred openings are set.
- The pixel design of the poses, as long as the three openings read differently at a glance.
- The wording of cards, tips and hints.
- The order of the work, though the rules and the balance simulation should come before the art, so that the numbers settle first.

## The baseline

Before this work, `pnpm test` passes 1411 of 1411. Many duel tests assume strikes start from plain guard, so they'll need rewriting as the rules change. Rewriting a test has to keep what it promises unless this document changes that promise.
