import { raikoOffersRen, renMissing } from "../dungeon-story.ts";
import { HP_LOW } from "../health.ts";
import type { RunState } from "../run-state.ts";
import {
  DAI_LINES, DAI_REN_MISSING, IDA_LINES, KEI_LINES, KEI_REN_MISSING, RAIKO_REN_NEWS, NIKO_LINES, PIP_LINES, RIO_LINES, SENSEI_HAGANE_LINES, SENSEI_KAN_LINES, SENSEI_MIZU_LINES, SENSEI_NEMU_LINES, SENSEI_RAIKO_LINES, TEO_LINES, UMA_LINES, VAL_LINES, WES_LINES,
} from "./content.ts";

/** Something someone says once, the first time it's true. The earlier in the list, the more it's on their mind. */
export type Reaction = { id: string; when: (run: RunState) => boolean; line: string };
export type Person = {
  /** What they're called when they've got your money. */
  name: string;
  /** What's on their mind about what you've been up to. */
  news: Reaction[];
  /** Just talking. It goes round in order, so you hear all of it before any of it comes back. */
  small: string[];
  advice: string[];
};

const beat = (...ids: string[]) => (run: RunState) => ids.every((id) => (run.beaten as string[]).includes(id));
const lostTo = (id: string) => (run: RunState) => ((run.losses as Record<string, number>)[id] ?? 0) > 0;
const lostOften = (id: string) => (run: RunState) => ((run.losses as Record<string, number>)[id] ?? 0) >= 3;
const hurtNow = (run: RunState) => run.hp < HP_LOW;
const danAt = (dan: number) => (run: RunState) => run.dan >= dan;
const hasSeme = (run: RunState) => run.seme;
const hasGaze = (run: RunState) => run.gaze;
const champion = (run: RunState) => run.champion;
const cupsWon = (count: number) => (run: RunState) => run.cups.length >= count;
const streets = (count: number) => (run: RunState) => run.cleared.length >= count;
const rich = (run: RunState) => run.money >= 300;
const broke = (run: RunState) => run.money < 10;
const foundTsuba = (run: RunState) => run.hasTsuba;
const sawTheCity = (run: RunState) => run.blessed;
const shopped = (run: RunState) => run.owned.length > 0;
const owesMoney = (run: RunState) => Object.values(run.held).some((amount) => amount > 0);
const flawless = (run: RunState) => run.seen.includes("feat:flawless");
const cleanLine = (run: RunState) => run.seen.includes("feat:perfectLine");
const heads = beat("raccoon", "goose", "heron", "otter", "radish");
/** Beaten this one, and not yet the next: what's on a head's mind between the two. */
const beatButNot = (done: string, next: string) => (run: RunState) => beat(done)(run) && !beat(next)(run);
/** A count that's somewhere in this range, so a line about one cup never plays once you've got three. */
const cupsBetween = (low: number, high: number) => (run: RunState) => run.cups.length >= low && run.cups.length <= high;
/** Somebody's carried you in through the door at least once. */
const knockedOut = (run: RunState) => (run.talked.wake ?? 0) > 0;
const kirikaeshiDone = (run: RunState) => run.kirikaeshiPasses > 0;
const rescued = (gang: string) => (run: RunState) => run.cleared.includes(gang);
const hasRank = (run: RunState) => run.gear.tare;
const beatASenpai = (run: RunState) => run.beaten.some((id) => id === "aki" || id === "bo" || id === "yui");
type Piece = "do" | "men" | "kote";
const PIECES: Piece[] = ["do", "men", "kote"];
/** A senpai remembering the piece of armor they gave you. Only one of these can ever be true for each of them. */
const gavePiece = (senpai: string, line: (piece: Piece) => string): Reaction[] =>
  PIECES.map((piece) => ({ id: `gave-${piece}`, when: (run: RunState) => run.armorFrom[piece] === senpai, line: line(piece) }));

export const PEOPLE: Record<string, Person> = {
  lantern: {
    name: "Kiri",
    news: [{ id: "won", when: beat("lantern"), line: "Kiri: You caught me on the turn of the tide. I'm still annoyed. In a good way." }],
    small: ["Kiri: The light moves all day. We practice anyway.", "Kiri: The breeze has stolen three of our towels."],
    advice: ["Kiri: Watch my feet, not the lanterns."],
  },
  mina: {
    name: "Mina",
    news: [{ id: "won", when: beat("lantern"), line: "Mina: Kiri's been polishing the same lantern since your match. That's how Kiri sulks." }],
    small: ["Mina: Kiri never seems to tire.", "Mina: I keep the lanterns polished."],
    advice: ["Mina: Kiri likes to move before you settle."],
  },
  yori: {
    name: "Yori",
    news: [{ id: "won", when: beat("lantern"), line: "Yori: You beat Kiri on the outgoing tide. We'll hear about it until the next one." }],
    small: ["Yori: The tide tells us when to take a break.", "Yori: Our floor is always a little sandy."],
    advice: ["Yori: Wait for Kiri to commit before you move."],
  },
  tama: {
    name: "Sensei Tama",
    news: [{ id: "won", when: beat("lantern"), line: "Sensei Tama: You let Kiri come to you, and Kiri came. I'll pretend I taught you that." }],
    small: ["Sensei Tama: There is time enough for tea and practice.", "Sensei Tama: We tie the lanterns down on windy days."],
    advice: ["Sensei Tama: The tide comes back. So can you."],
  },
  bamboo: {
    name: "Nori",
    news: [{ id: "won", when: beat("bamboo"), line: "Nori: You noticed. Most people don't. Now I need something new to wait for." }],
    small: ["Nori: The grove is quiet in the morning.", "Nori: Fuwa keeps the path swept. Mostly."],
    advice: ["Nori: You can learn a lot by waiting."],
  },
  taro: {
    name: "Taro",
    news: [{ id: "won", when: beat("bamboo"), line: "Taro: Nori's been sitting in the grove since your match. Smiling. It's unsettling." }],
    small: ["Taro: The grove makes its own music.", "Taro: Nori has the patience of a stone."],
    advice: ["Taro: Nori waits for you to rush."],
  },
  fuwa: {
    name: "Fuwa",
    news: [{ id: "won", when: beat("bamboo"), line: "Fuwa: Nori lost? I swept the path twice to take it in." }],
    small: ["Fuwa: I sweep the path after every wind.", "Fuwa: The bamboo always wins that game."],
    advice: ["Fuwa: Watch for a pause before you attack."],
  },
  hoshi: {
    name: "Sensei Hoshi",
    news: [{ id: "won", when: beat("bamboo"), line: "Sensei Hoshi: You bent and didn't break. Nori says the same, in fewer words." }],
    small: ["Sensei Hoshi: The grove grows a little each day.", "Sensei Hoshi: We practice slowly before we practice fast."],
    advice: ["Sensei Hoshi: A firm stance lets you change direction."],
  },
  // At home.
  nao: {
    name: "Nao",
    news: [
      { id: "champion", when: champion, line: "Nao: Champion! Sensei says it's a normal day. Sensei has swept that same spot four times." },
      { id: "carried", when: knockedOut, line: "Nao: You walked in on your own feet this time! Last time you came in over somebody's shoulder." },
      { id: "dan", when: danAt(1), line: "Nao: A dan! Momo told the whole hall. Then she told them again, louder." },
      { id: "cup", when: cupsWon(1), line: "Nao: You won a cup! Aki's been describing it to everyone. It gets bigger every time." },
      { id: "streets", when: streets(1), line: "Nao: Word got back that you ran off some Alley Cats. Sensei said hm. It was a good hm." },
      { id: "door", when: (run) => beatASenpai(run) && !run.cleared.length && !beat("raccoon")(run), line: "Nao: The front door's open for you now! Mind the step on the way out. Everyone trips on the step." },
      { id: "rank", when: (run) => hasRank(run) && !run.trained, line: "Nao: A tare, and a rank to go with it! I tied mine on backwards my first week." },
    ],
    small: [
      "Nao: I'm on door duty. Shoes in the rack, bow at the line. I say it a lot.",
      "Nao: Momo started out on the door too. She says it builds character. It builds sore feet.",
      "Nao: Sensei knows who's come in from the creak of the floor. I'm practising. Hi, Aki. Oh. Hi.",
    ],
    advice: ["Nao: Bow at the door, coming and going. Nobody checks. Everybody notices."],
  },
  momo: {
    name: "Senpai Momo",
    news: [
      { id: "hurt", when: hurtNow, line: "Senpai Momo: You look awful! Sit down. No, on the bench, not on my shinai bag." },
      { id: "owes", when: owesMoney, line: "Senpai Momo: I heard someone's walking around with your kensen. We don't let that stand. Go and get it." },
      { id: "champion", when: champion, line: "Senpai Momo: Grand Taikai champion. I taught you to tie your himo. I'm telling everyone that." },
      { id: "heads", when: heads, line: "Senpai Momo: All five dojo heads. And I remember you asking which end of the shinai to hold." },
      { id: "ren", when: beat("radish"), line: "Senpai Momo: You beat Ren! I told you to say hello, not to do that. Though I'm glad you did." },
      { id: "tsuba", when: foundTsuba, line: "Senpai Momo: So you found Sensei's old tsuba. Look after it. It's seen more than either of us." },
      { id: "gaze", when: hasGaze, line: "Senpai Momo: Ren showed you the far-mountain gaze? They used to sweep this floor, you know. Badly." },
      { id: "dan", when: danAt(1), line: "Senpai Momo: A real dan. Look at you! You're still washing the floor on Tuesdays, though." },
      { id: "cup", when: cupsBetween(1, 2), line: "Senpai Momo: A cup! Put it where Sensei can see it. Sensei will pretend not to look. Sensei will look." },
      { id: "streets", when: streets(1), line: "Senpai Momo: Alley Cats, on your own? Next time take Aki. Aki won't help, but they'll run from the noise." },
    ],
    small: [
      "Senpai Momo: I've been here so long my feet know every splinter in this floor. I've named a few.",
      "Senpai Momo: Check your shinai before practice. Run your hand along it. A loose splinter ruins everyone's day.",
      "Senpai Momo: Aki borrowed my tenugui again. I'm not getting that one back. I don't want it back.",
      "Senpai Momo: My temper? I have no idea what you mean. Ask Aki. Aki knows what I mean.",
      "Senpai Momo: Sensei pretends not to watch the beginners. Sensei has never once missed anything.",
    ],
    advice: [
      "Senpai Momo: Rest before you go back out. You only lose health in fights away from home, and coming back here heals you.",
      "Senpai Momo: Don't rush a rematch while you're hurt. Three bad losses in a row and you'll wake up on the floor by my door.",
      "Senpai Momo: If you can't see the opening, stop swinging. Nobody ever lost a point by watching.",
    ],
  },
  sensei: {
    name: "Sensei Kuma",
    news: [
      { id: "hurt", when: hurtNow, line: "Sensei Kuma: You're limping. Sit. Nobody ever got better by getting hit tired." },
      { id: "owes", when: owesMoney, line: "Sensei Kuma: You lost a fight and your purse with it. A debt like that doesn't settle itself. Go and win it back." },
      { id: "champion", when: champion, line: "Sensei Kuma: Champion. Good. Tomorrow you do suburi like everybody else." },
      { id: "beat", when: beat("sensei"), line: "Sensei Kuma: You beat me, and I won't be saying that twice. Keep your back straight anyway." },
      { id: "cups", when: cupsWon(3), line: "Sensei Kuma: Three cups. They'll remember the cups. I'd rather they remembered your footwork." },
      { id: "line", when: cleanLine, line: "Sensei Kuma: A long line with no misses. I saw. I'm not saying anything else about it." },
      { id: "seme", when: hasSeme, line: "Sensei Kuma: So Gen taught you. Fifty years, and that old fool still lives in a hut. Did you eat something?" },
      { id: "dan", when: danAt(1), line: "Sensei Kuma: A dan. Now you've got something to lose. Practise as if you hadn't." },
      { id: "cup", when: cupsBetween(1, 2), line: "Sensei Kuma: A cup. Good. It goes on the shelf, and you don't look at it during practice." },
      { id: "plums", when: rescued("market"), line: "Sensei Kuma: A woman came by with plums for whoever ran off the Alley Cats. They're in the back. Eat one." },
      { id: "carried", when: knockedOut, line: "Sensei Kuma: Momo carried you in, that time. She'll say she didn't. Thank her anyway." },
      { id: "kirikaeshi", when: kirikaeshiDone, line: "Sensei Kuma: Bo says your kirikaeshi is coming along. Bo said it in one word, but I knew which one." },
    ],
    small: [
      "Sensei Kuma: A shinai is bamboo. Treat it like a sword anyway. That's most of the lesson.",
      "Sensei Kuma: I've been doing this for forty years. I'm nearly getting the hang of it.",
      "Sensei Kuma: Ren used to sweep this floor. Terribly. Sometimes I still find the places they missed.",
      "Sensei Kuma: You bowed on the way in. Good. Half of them think it's about being polite.",
    ],
    advice: [
      "Sensei Kuma: Spirit, sword and body, all at once. If one's late, it isn't a strike. It's just a noise.",
      "Sensei Kuma: Winning doesn't heal you, and neither does stubbornness. Come home when you're hurt.",
      "Sensei Kuma: When both of you strike and nobody scores, don't sulk. Turn around. It's still a match.",
    ],
  },
  aki: {
    name: "Aki",
    news: [
      { id: "hurt", when: hurtNow, line: "Aki: Whoa! You look terrible! Are you okay? Who did that? Was it good? Tell me everything!" },
      { id: "owes", when: owesMoney, line: "Aki: Somebody took your money?! Go and get it! I'll come with you! No, I've got practice. Go and get it!" },
      { id: "champion", when: champion, line: "Aki: <name>! CHAMPION! I told everyone! Then I told them again! I told a bus driver!" },
      { id: "ren", when: beat("radish"), line: "Aki: You beat Ren?! Ren! I once saw Ren make a pigeon apologize!" },
      { id: "beat", when: beat("aki"), line: "Aki: You beat me, and I told everyone! Everyone knows now! You're welcome!" },
      { id: "streets", when: streets(1), line: "Aki: I heard you chased off the Alley Cats! Auntie Bea told my mom! She said you were taller!" },
      { id: "tower", when: sawTheCity, line: "Aki: You went up the Tower? Could you see my house? I waved! I wave every day, just in case!" },
      { id: "shop", when: shopped, line: "Aki: New gear? Let me see! Let me hold it! Oh, I'd better not. I broke the last one." },
      { id: "dan", when: danAt(1), line: "Aki: A dan! You! I knew it! I didn't know it. But I hoped it really loudly!" },
      { id: "cup", when: cupsWon(1), line: "Aki: You won a cup! Can I hold it? I won't drop it. I might drop it. Can I hold it?" },
      { id: "carried", when: knockedOut, line: "Aki: Somebody carried you in, and I missed it! I always miss the good stuff!" },
      ...gavePiece("aki", (piece) => `Aki: That ${piece} I gave you still looks great on you! I keep checking. From over here. Constantly.`),
    ],
    small: [
      "Aki: I'm trying a new thing where I don't talk during kakari-geiko. It's going badly!",
      "Aki: Did you know Yui counts how many times I blink? It's a lot! Yui told me!",
      "Aki: My left heel hurts from all the stomping. It's great! Well, it's bad. But it's great!",
      "Aki: I ate three rice balls before practice. I regret two of them. One was fine.",
      "Aki: Bo said four words to me yesterday. FOUR. I think we're best friends now.",
    ],
    advice: [
      "Aki: Keep moving! If you stand still, somebody hits you! Also if you move! But less!",
      "Aki: When someone gets hilt to hilt with you, push! Or pull! Or wait! It depends! You'll see!",
      "Aki: Double-tap toward them for a long launch! It feels amazing! Then you get hit sometimes!",
    ],
  },
  bo: {
    name: "Bo",
    news: [
      { id: "hurt", when: hurtNow, line: "Bo: Mm. You're hurt. Sit." },
      { id: "owes", when: owesMoney, line: "Bo: Mm. They've got your money. Go and get it." },
      { id: "champion", when: champion, line: "Bo: Mm. Champion. Your gi still needs washing." },
      { id: "beat", when: beat("bo"), line: "Bo: Mm. You took down the wall. It's back up now." },
      { id: "heads", when: heads, line: "Bo: Mm. All five. Not bad." },
      { id: "broke", when: broke, line: "Bo: Mm. Empty purse. Sensei pays for helping out." },
      { id: "dan", when: danAt(1), line: "Bo: Mm. A dan. Now people hit harder." },
      { id: "kirikaeshi", when: kirikaeshiDone, line: "Bo: Mm. Your kirikaeshi. The left side's late. Less late." },
      { id: "cup", when: cupsWon(1), line: "Bo: Mm. A cup. Polish it once. Then practise." },
      { id: "carried", when: knockedOut, line: "Bo: Mm. You came in carried. Walk in next time." },
      ...gavePiece("bo", (piece) => `Bo: Mm. The ${piece} I gave you. It looks after you. Look after it.`),
    ],
    small: [
      "Bo: Mm. Indigo runs. Wash your gi alone.",
      "Bo: Mm. My feet are blue. They've been blue since last spring.",
      "Bo: Mm. Aki is talking again. I can hear it from here.",
      "Bo: Mm. It's a good floor.",
    ],
    advice: [
      "Bo: Mm. Everyone opens up eventually. Wait.",
      "Bo: Mm. A held guard costs ki. Don't hold it forever.",
      "Bo: Mm. Hurt? Don't fight. Rest.",
    ],
  },
  yui: {
    name: "Yui",
    news: [
      { id: "hurt", when: hurtNow, line: "Yui: Your health is well below a third. I wouldn't fight in that state. I counted, and you shouldn't." },
      { id: "owes", when: owesMoney, line: "Yui: Someone is holding your kensen. The amount is on record. I expect it returned, with interest in the form of a point." },
      { id: "line", when: cleanLine, line: "Yui: No misses on a long line. I checked it twice. It was correct." },
      { id: "flawless", when: flawless, line: "Yui: You beat a dojo head without giving up a point. Your left foot was still late." },
      { id: "beat", when: beat("yui"), line: "Yui: You beat me fairly. I've gone over it nine times. Your second strike was the good one." },
      { id: "rich", when: rich, line: "Yui: You're carrying a lot of kensen. Keep your wits about you. If you get knocked out, half of it stays behind." },
      { id: "champion", when: champion, line: "Yui: Grand Taikai champion. I've checked the results three times. They're correct." },
      { id: "dan", when: danAt(1), line: "Yui: A dan. I read the panel's notes. They were generous about your left foot." },
      { id: "cup", when: cupsWon(1), line: "Yui: You won a cup. I went through the bracket afterwards. You earned it, mostly." },
      { id: "streets", when: streets(1), line: "Yui: I heard about the Alley Cats. The stories don't agree on how many. Well done, either way." },
      { id: "carried", when: knockedOut, line: "Yui: You were carried in. I've started a list. Keep it short." },
      ...gavePiece("yui", (piece) => `Yui: The ${piece} I gave you is tied correctly today. I check whenever you walk past.`),
    ],
    small: [
      "Yui: I've done 1,000 suburi today. Nine of them were correct.",
      "Yui: Aki blinked 412 times during practice. It's improving.",
      "Yui: Tie your men himo the same way every time. Then you'll notice when something's wrong.",
      "Yui: You've come to talk 3 times this week. I keep a note of these things. Don't worry about why.",
    ],
    advice: [
      "Yui: Strike and stomp must land together. Not nearly together. Together.",
      "Yui: Tap S just as a strike arrives. Too early and it's a block, which costs ki. Tap it. Don't hold it.",
      "Yui: A strike without zanshin doesn't count. Finish the slide. I will be watching your feet.",
    ],
  },

  // Thunder Radish.
  radish: {
    name: "Ren",
    news: [
      { id: "owes", when: owesMoney, line: "Ren: You left in a hurry last time. Some people came away lighter." },
      { id: "often", when: lostOften("radish"), line: "Ren: You keep coming back. I did that too, once. That's how I ended up like this." },
      { id: "lost", when: lostTo("radish"), line: "Ren: You looked at my eyes again. Everyone does." },
      { id: "champion", when: champion, line: "Ren: Champion. It's quiet up there, isn't it?" },
      { id: "beat", when: beat("radish"), line: "Ren: Nobody's beaten me in here for a while. I'm still deciding how I feel about it." },
    ],
    small: [
      "Ren: I used to sweep Sensei Kuma's floor. Tell them I still think about the corners.",
      "Ren: People say I don't talk much. I used to be the loud one. Ask Raiko.",
      "Ren: The pickles aren't a joke. We really do make them. They help.",
    ],
    advice: ["Ren: Don't look at me. Look at all of me.", "Ren: If you're waiting for me to move, you've already moved."],
  },
  kei: {
    name: "Kei",
    news: [
      { id: "renMissing", when: renMissing, line: KEI_REN_MISSING },
      { id: "hurt", when: hurtNow, line: "Kei: That's a nasty limp. Our pickle jar's got more colour than you do. Go home and rest." },
      { id: "lost", when: lostTo("radish"), line: "Kei: I watched that. Did you see what Ren's shinai did just before? No, I know. Nobody does the first time." },
      { id: "beat", when: beat("radish"), line: "Kei: You beat Ren! I've been telling people for years it could be done. I didn't believe it either." },
      { id: "raiko", when: beat("raiko"), line: "Kei: You beat Sensei Raiko? The rumbling stopped for a whole minute. We all noticed." },
    ],
    small: [
      "Kei: We're on pickle duty this week. The whole dojo smells like it. You get used to it. You don't, actually.",
      "Kei: Ren doesn't talk at dinner either. We've started guessing what Ren wants passed.",
      "Kei: That rumble's the train, mostly. Mostly.",
    ],
    advice: [...KEI_LINES, "Kei: If you're losing to someone, leave and come back. You won't fight any better while you're hurt."],
  },
  dai: {
    name: "Dai",
    news: [
      { id: "renMissing", when: renMissing, line: DAI_REN_MISSING },
      { id: "hurt", when: hurtNow, line: "Dai: You're breathing like I do after kakari-geiko. Get some rest before you try anything." },
      { id: "lost", when: lostTo("radish"), line: "Dai: Don't feel bad. Ren did that to me on my first day. And my second. It's been three years." },
      { id: "beat", when: beat("radish"), line: "Dai: Ren was smiling after you left. A little. Nobody knows what to do about it." },
      { id: "gaze", when: hasGaze, line: "Dai: You stopped looking Ren in the eyes. Good. I've been trying that. I keep looking at the eyes." },
    ],
    small: [
      "Dai: I've been at Thunder Radish three years. I can nearly lift the pickle barrel.",
      "Dai: I asked Ren how to get better once. Ren looked at me for ten minutes. I think that was the answer.",
      "Dai: Sensei Raiko's first rule is no running in the dojo. The second rule is run faster.",
    ],
    advice: [...DAI_LINES, "Dai: Breathe out when you strike. I forgot once and fell over."],
  },
  raiko: {
    name: "Sensei Raiko",
    news: [
      { id: "renMissing", when: (run) => raikoOffersRen(run) && renMissing(run), line: RAIKO_REN_NEWS },
      { id: "lost", when: lostTo("raiko"), line: "Sensei Raiko: You heard the thunder and then you looked for the flash. Next time, the other way round." },
      { id: "ren", when: beat("radish"), line: "Sensei Raiko: You beat Ren in my own dojo. I raised that child to be unbeatable, and I'm oddly pleased." },
      { id: "beat", when: beat("raiko"), line: "Sensei Raiko: The storm passes. It always comes back. Come and see it again some time." },
    ],
    small: [...SENSEI_RAIKO_LINES, "Sensei Raiko: A dojo should be loud. Loud is honest. Quiet is when someone's about to hit you."],
    advice: ["Sensei Raiko: Your kiai comes from your belly, not your throat. You'll know the difference tomorrow, by your voice."],
  },

  // Angry Goose.
  goose: {
    name: "Hana",
    news: [
      { id: "owes", when: owesMoney, line: "Hana: Sorry. No, I'm not sorry. Sensei says I have to stop saying that. You want your money? Come and get it." },
      { id: "often", when: lostOften("goose"), line: "Hana: You again? I'd feel bad, but I've been told not to. The goose has started saving you a seat." },
      { id: "lost", when: lostTo("goose"), line: "Hana: Sor- no. Good match. That's what I'm meant to say. Good match." },
      { id: "beat", when: beat("goose"), line: "Hana: You beat me, and the goose saw it. I have to walk past that goose every day now." },
      { id: "sora", when: beatButNot("raccoon", "goose"), line: "Hana: Sora says you're good. Then Sora fell asleep saying it. So how good?" },
      { id: "mika", when: beatButNot("goose", "heron"), line: "Hana: Mika came all this way to watch us, and never blinked. Not once. Good luck with that." },
      { id: "mikaDown", when: beat("heron"), line: "Hana: You outwaited Mika? I can't even outwait a kettle." },
    ],
    small: [
      "Hana: I can't wait. I've tried. I lasted nine seconds once, and it was the worst nine seconds of my life.",
      "Hana: Our goose isn't a pet. Our goose isn't anything. It just arrived one day and nobody's been brave enough to discuss it.",
      "Hana: I hit a kid at a tournament once and said sorry eleven times. Sensei Kan made me run laps. So I run a lot.",
    ],
    advice: ["Hana: You stand around too long. Stand around with me and I'll hit you. That's the advice.", "Hana: Why am I telling you this? Stop asking me things. Honk."],
  },
  ida: {
    name: "Ida",
    news: [
      { id: "hurt", when: hurtNow, line: "Ida: You're bleeding ki all over the place. Go and lie down. Not there. The goose sleeps there." },
      { id: "lost", when: lostTo("goose"), line: "Ida: Hana got you with the big one, didn't they? Everyone sees it coming. Then it arrives anyway." },
      { id: "beat", when: beat("goose"), line: "Ida: You beat Hana! Don't look up. The goose took it personally." },
      { id: "tetsu", when: beat("tetsu"), line: "Ida: You walked inside Tetsu's reach and lived. I've seen people faint just thinking about that." },
    ],
    small: [
      "Ida: Nobody here has ever seen that goose eat. Nobody's ever seen it sleep, either. I've stopped checking.",
      "Ida: We used to have a cat. I don't want to talk about it.",
      "Ida: Sensei Kan makes everyone wipe their feet. The goose doesn't. Nobody's mentioned it.",
    ],
    advice: [...IDA_LINES, "Ida: Your ki runs out faster than you think, when you swing at everything. Mine does."],
  },
  pip: {
    name: "Pip",
    news: [
      { id: "hurt", when: hurtNow, line: "Pip: Yikes. I've seen people look better after meeting the goose. Please rest." },
      { id: "lost", when: lostTo("goose"), line: "Pip: Both arms way up high, right? I did say. It's not my fault nobody listens to me. Nobody ever does." },
      { id: "beat", when: beat("goose"), line: "Pip: Hana's been running laps since you left. I don't think Sensei Kan even told them to." },
      { id: "rich", when: rich, line: "Pip: Are those coins I hear? Don't jingle around here. The goose likes shiny things. I made that up. Maybe." },
    ],
    small: [
      "Pip: I'm the smallest one here, so I get the big bogu. It's a tradition. It's a bad tradition.",
      "Pip: One day I'll say something to the goose. Not today. But it'll be something good.",
      "Pip: Hana said sorry to a door the other day. I'm not allowed to bring it up.",
    ],
    advice: [...PIP_LINES, "Pip: If they're faster than you, don't race them. I'm always slower, and I've still got all my teeth."],
  },
  kan: {
    name: "Sensei Kan",
    news: [
      { id: "feet", when: () => true, line: "Sensei Kan: Your feet aren't wiped. I'm not saying anything. I'm just looking at them." },
      { id: "lost", when: lostTo("kan"), line: "Sensei Kan: Back on your feet already? Fine. Wipe them." },
      { id: "hana", when: beat("goose"), line: "Sensei Kan: You beat Hana. They've stopped apologizing, at least. I'll give you that." },
      { id: "beat", when: beat("kan"), line: "Sensei Kan: We've agreed that didn't happen. I've told the goose." },
    ],
    small: [...SENSEI_KAN_LINES, "Sensei Kan: I don't like visitors. I don't like the goose either. Nobody's asked me about the goose."],
    advice: ["Sensei Kan: Stop thinking about the last point. It's over. You lost it. Wipe your feet."],
  },
  tetsu: {
    name: "Tetsu",
    news: [
      { id: "lost", when: lostTo("tetsu"), line: "Tetsu: You stayed where you thought you were safe. Nobody's safe out there. That's what jodan means." },
      { id: "beat", when: beat("tetsu"), line: "Tetsu: You came inside once. I've been thinking about it ever since. Don't expect it to be as easy." },
      { id: "dan", when: danAt(2), line: "Tetsu: You've got the rank now. Whether you've got the nerve is another question." },
    ],
    small: [
      "Tetsu: Most people here think jodan's about being tall. It's about being sure.",
      "Tetsu: I switched to one hand years ago. My left arm's now noticeably bigger. I've stopped wearing short sleeves.",
    ],
    advice: ["Tetsu: You can't fight jodan from where you're comfortable. That's the whole trick."],
  },

  // Sleepy Raccoon.
  raccoon: {
    name: "Sora",
    news: [
      { id: "owes", when: owesMoney, line: "Sora: Mm? Oh, your money. I put it somewhere. Beat me and I'll try to remember." },
      { id: "lost", when: lostTo("raccoon"), line: "Sora: Did we already fight? ...Did I win? Nice. Wake me up next time." },
      { id: "beat", when: beat("raccoon"), line: "Sora: You beat me? Huh. I thought I'd dreamed that. It was a pretty good dream." },
      { id: "hana", when: beat("goose"), line: "Sora: You beat Hana too? I heard the honking from here. Or I dreamed it. Either way, nice." },
    ],
    small: [
      "Sora: The trick to napping standing up is your knees. Nobody teaches that part.",
      "Sora: I came to practice this morning. Or I never left. One of those.",
      "Sora: Someone's been through the bins again. I'm sure it's not a raccoon. Mm, it's a raccoon.",
    ],
    advice: ["Sora: Mm... the same small target, over and over. Who'd do that? Zzz.", "Sora: Don't go all out. Going all out is so tiring."],
  },
  niko: {
    name: "Niko",
    news: [
      { id: "hurt", when: hurtNow, line: "Niko: You should take a nap. I'm not saying that because of how you look. I'm always saying that." },
      { id: "lost", when: lostTo("raccoon"), line: "Niko: Sora got you? Don't feel bad. Sora might not even remember doing it." },
      { id: "beat", when: beat("raccoon"), line: "Niko: You beat Sora! We've all gone quiet about it. Well, we were quiet before." },
    ],
    small: [
      "Niko: Morning practice starts at noon here. There's a petition to move it to one.",
      "Niko: I've found three good spots to sleep in this dojo. I'm not telling you where. There's a waiting list.",
      "Niko: The lanterns stay lit so nobody has to get up and light them.",
    ],
    advice: [...NIKO_LINES, "Niko: If you're tired, stop. Nobody ever slept too much. I've checked."],
  },
  rio: {
    name: "Rio",
    news: [
      { id: "hurt", when: hurtNow, line: "Rio: Here, have a snack. It's from the plant. Don't worry about it. You look like you need it." },
      { id: "lost", when: lostTo("raccoon"), line: "Rio: Your wrist okay? Sora's very rude to wrists." },
      { id: "egg", when: (run) => run.seen.some((key) => key === "egg:raccoon|p"), line: "Rio: Someone's been in my plant. The kensen's gone. The snacks are still there. So I know it wasn't Niko." },
      { id: "nemu", when: beat("nemu"), line: "Rio: You beat Sensei Nemu? We tried to tell them. They'll wake up eventually." },
    ],
    small: [
      "Rio: I keep snacks in the plant pot. Everyone here hides something somewhere. It's the only exercise we get.",
      "Rio: Sora and Sensei Nemu had a match last year. We think. They were both lying down at the end.",
      "Rio: You bow very crisply. It's a bit much for this time of day.",
    ],
    advice: [...RIO_LINES, "Rio: Watch your wrist. It's so small and so far from the rest of you."],
  },
  nemu: {
    name: "Sensei Nemu",
    news: [
      { id: "lost", when: lostTo("nemu"), line: "Sensei Nemu: Mm? You lost? To who? ...Me? Oh, well done, me." },
      { id: "sora", when: beat("raccoon"), line: "Sensei Nemu: You beat Sora. They told me all about it, and then fell asleep halfway through." },
      { id: "beat", when: beat("nemu"), line: "Sensei Nemu: You woke me up. Nobody's done that in years. It was quite unpleasant. Thank you." },
    ],
    small: [...SENSEI_NEMU_LINES, "Sensei Nemu: I teach by example. I've been teaching since breakfast."],
    advice: ["Sensei Nemu: Relax your shoulders. No, more. No, more. There. That's how you stay awake in a fight, oddly."],
  },

  // Iron Heron.
  heron: {
    name: "Mika",
    news: [
      { id: "owes", when: owesMoney, line: "Mika: You've left some kensen here. I'm in no hurry. It'll wait for you." },
      { id: "lost", when: lostTo("heron"), line: "Mika: You moved first. It's all right. Everybody does." },
      { id: "beat", when: beat("heron"), line: "Mika: You waited longer than I did. I've been standing here thinking about that since you left." },
      { id: "hana", when: beatButNot("goose", "heron"), line: "Mika: I watched you and Hana. You let Hana come to you. I won't come." },
      { id: "kenji", when: beatButNot("heron", "otter"), line: "Mika: Kenji won't wait for you at the falls. Kenji has never waited for anything." },
    ],
    small: [
      "Mika: There was a moth on my men for all of last practice. We got along well.",
      "Mika: I started standing still when I was six. I've never really found a reason to stop.",
      "Mika: The mill stopped on Thursday. Nobody else noticed for an hour. I'd noticed before it stopped.",
    ],
    advice: ["Mika: You're in a hurry. I can see that from here.", "Mika: When you don't know what to do, do nothing. Do it carefully."],
  },
  teo: {
    name: "Teo",
    news: [
      { id: "hurt", when: hurtNow, line: "Teo: You're swaying a little. Around here, people notice that. Go and rest." },
      { id: "lost", when: lostTo("heron"), line: "Teo: Mika got bored of you, or you got bored of Mika? It's usually the second one." },
      { id: "beat", when: beat("heron"), line: "Teo: Mika moved their eyebrow after you left. People came from the other side of the mill to look." },
    ],
    small: [
      "Teo: I've been standing in this spot since before lunch. Which lunch? Good question.",
      "Teo: You learn to feel the mill through your feet here. Mine say it's nearly Friday.",
      "Teo: Sensei Hagane gave me a compliment in my third year. I still think about it. It was 'hm'.",
    ],
    advice: [...TEO_LINES, "Teo: Your ki comes back while you stand calm. So stand calm. It's the only free thing here."],
  },
  uma: {
    name: "Uma",
    news: [
      { id: "hurt", when: hurtNow, line: "Uma: You came all this way on the train to look like that? Go home. The train's still there." },
      { id: "lost", when: lostTo("heron"), line: "Uma: You saw how fast that was, after all that waiting? I've been here eight years and I still jump." },
      { id: "shin", when: beat("shin"), line: "Uma: You found Shin's door. They've been practising covering it all week, and they won't say why." },
    ],
    small: [
      "Uma: Everyone thinks it's boring here. It is. That's what it's for.",
      "Uma: I've got a spot on the floor with my feet worn into it. I'm very proud of it.",
      "Uma: Shin carries two swords and complains about having one lunch.",
    ],
    advice: [...UMA_LINES, "Uma: Don't look for the moment. Be standing there when it shows up."],
  },
  hagane: {
    name: "Sensei Hagane",
    news: [
      { id: "lost", when: lostTo("hagane"), line: "Sensei Hagane: You were hammered. Iron gets hammered too. Then it's stronger, or it's scrap." },
      { id: "mika", when: beat("heron"), line: "Sensei Hagane: You outlasted Mika. I've watched that happen twice now. I've been here sixty years." },
      { id: "beat", when: beat("hagane"), line: "Sensei Hagane: I'm still bent, a little. It doesn't show. I can tell." },
    ],
    small: [...SENSEI_HAGANE_LINES, "Sensei Hagane: You came by train. I walked here once. It took a while. I don't mind."],
    advice: ["Sensei Hagane: Make them move. Lean on them with your spirit, and wait for it to matter."],
  },
  shin: {
    name: "Shin",
    news: [
      { id: "lost", when: lostTo("shin"), line: "Shin: You spent all that time hitting the short sword. It really doesn't mind." },
      { id: "beat", when: beat("shin"), line: "Shin: One door, and you found it. I've been moving my elbow. It doesn't help." },
      { id: "dan", when: danAt(3), line: "Shin: Third dan. Now you've got the rank to lose to me properly." },
    ],
    small: [
      "Shin: I carry two swords. Yes, it's heavy. No, you can't hold one. Yes, I've heard that joke.",
      "Shin: People ask which sword I like best. It's like asking which of my arms I like best. It's the left.",
    ],
    advice: ["Shin: Two swords, one door. The rest is me keeping you busy."],
  },

  // Soggy Otter.
  otter: {
    name: "Kenji",
    news: [
      { id: "owes", when: owesMoney, line: "Kenji: Your money's here! It's a bit damp! Come and get it! Let's go!" },
      { id: "often", when: lostOften("otter"), line: "Kenji: You keep coming back! I love that! Everyone else stays away! Again, again!" },
      { id: "lost", when: lostTo("otter"), line: "Kenji: That was so much fun! Are you all right? You look all right! Let's go again!" },
      { id: "beat", when: beat("otter"), line: "Kenji: You beat me! Nobody ever outlasts me! I'm going to go and stand in the rain and think about it!" },
      { id: "mika", when: beatButNot("heron", "otter"), line: "Kenji: You outlasted Mika! I tried once! I lasted four seconds! Longest four seconds ever!" },
      { id: "watcher", when: beatButNot("otter", "radish"), line: "Kenji: Someone from Thunder Radish came all the way here to watch you, and didn't even get wet! Who does that?" },
    ],
    small: [
      "Kenji: I did a thousand suburi this morning! In the rain! Then it stopped, so I went looking for more rain!",
      "Kenji: Sensei Mizu says I should breathe sometimes! I'm looking into it!",
      "Kenji: Everything I own is wet! I own two things! Isn't it great?",
    ],
    advice: ["Kenji: Don't stop! Why would you stop? I've never stopped!", "Kenji: Bring a towel! I never do, but you could!"],
  },
  val: {
    name: "Val",
    news: [
      { id: "hurt", when: hurtNow, line: "Val: You look like a wet sock. Which is fine here, but a wet sock can't fight. Go and dry out." },
      { id: "lost", when: lostTo("otter"), line: "Val: Kenji's like the weather. You don't win. You wait for it to clear, and then you hit it." },
      { id: "beat", when: beat("otter"), line: "Val: You beat Kenji, and Kenji's thrilled! Nobody's ever been that happy about losing. We're all a little worried." },
    ],
    small: [
      "Val: The roof's been leaking since before I got here. We've named the buckets. That one's Gerald.",
      "Val: Everyone's bogu grows something, out here. Mine's mostly moss. I've stopped fighting it.",
      "Val: We mop the floor before practice. Then it rains. It's a very spiritual kind of mopping.",
    ],
    advice: [...VAL_LINES, "Val: A wet floor means short steps. Good habit anywhere. Take it home with you."],
  },
  wes: {
    name: "Wes",
    news: [
      { id: "hurt", when: hurtNow, line: "Wes: You're pale. Even for someone who's been standing out here. Take a break before you fall in something." },
      { id: "lost", when: lostTo("otter"), line: "Wes: Did you try outlasting Kenji? I know. It's like outlasting a river. Still, that's the plan." },
      { id: "mizu", when: beat("mizu"), line: "Wes: Sensei Mizu's actually up on the roof, with a hammer. You did that. It's raining on them. They're very happy." },
    ],
    small: [
      "Wes: The towel in the corner's been damp for nine years. Nobody's ever seen it dry. It's kind of a mascot.",
      "Wes: I came out here for the waterfall. I've been meaning to go and see it. It's been raining.",
      "Wes: Bring dry socks, they said. So I did. Where are they now? No one knows.",
    ],
    advice: [...WES_LINES, "Wes: Keep your strength for later. Kenji does the opposite, and you can use that."],
  },
  mizu: {
    name: "Sensei Mizu",
    news: [
      { id: "lost", when: lostTo("mizu"), line: "Sensei Mizu: Soaked already? Dry off and come back. The rain'll wait. It's got nothing else on." },
      { id: "kenji", when: beat("otter"), line: "Sensei Mizu: You stepped out of Kenji's rain. They've been talking about it nonstop. Which is to say, as usual." },
      { id: "beat", when: beat("mizu"), line: "Sensei Mizu: I got as far as buying the nails, for the roof. It's a start." },
    ],
    small: [...SENSEI_MIZU_LINES, "Sensei Mizu: Water doesn't get anywhere by hitting things. It gets everywhere by not stopping."],
    advice: ["Sensei Mizu: When they keep coming, step aside. They'll be so surprised, they'll stay open."],
  },

  // Out in the city.
  gen: {
    name: "Old Gen",
    news: [
      { id: "hurt", when: hurtNow, line: "Old Gen: You look worse than my hut. Did you eat something? Go and eat something." },
      { id: "momo", when: (run) => run.momoBeaten, line: "Old Gen: So you got past Momo. Good. She's the only one of Kuma's lot who ever brings me soup." },
      { id: "ren", when: beat("radish"), line: "Old Gen: You beat Kuma's old floor-sweeper? Fifty years, and I'd like to have seen that." },
      { id: "champion", when: champion, line: "Old Gen: Champion, is it? Good. I've got a leak. Hold this." },
    ],
    small: [
      "Old Gen: Press with your ki. Let go when they move. That's all I know, and it took me fifty years.",
      "Old Gen: I had a nice dojo once. Too many stairs.",
      "Old Gen: Kuma still mad about the hut? Kuma was mad about the hut before it was a hut.",
    ],
    advice: ["Old Gen: Don't hold your seme all day. A fist can't stay clenched and do anything else.", "Old Gen: Eat first. I said that to Kuma and now look at Kuma."],
  },
  market: {
    name: "Auntie Bea",
    news: [{ id: "hurt", when: hurtNow, line: "Auntie Bea: Look at you, dear! Sit down and have a plum. Have two plums." }, { id: "champion", when: champion, line: "Auntie Bea: Champion! I always knew. Didn't I say? I said it to the plums." }],
    small: ["Auntie Bea: No more trouble here, dear. Plums are on the house.", "Auntie Bea: My late husband couldn't tell a shinai from a broom. Lovely man.", "Auntie Bea: You're too thin. They don't feed you at that dojo. Take a bag."],
    advice: ["Auntie Bea: Eat, and rest when you're tired. You don't need a dojo to tell you that."],
  },
  bridge: {
    name: "Little Tomo",
    news: [{ id: "dan", when: danAt(1), line: "Little Tomo: You've got a dan now?! I've got a shinai! That's nearly the same!" }, { id: "champion", when: champion, line: "Little Tomo: You're the champion! Can I carry your bag? I've got a very good bag-carrying stance." }],
    small: ["Little Tomo: I've been practising my men cuts! Watch!", "Little Tomo: I did a hundred stomps! Mom says I can't do them indoors any more!", "Little Tomo: I didn't step over it! Not even once! I went all the way around!"],
    advice: ["Little Tomo: Your feet have to go at the same time as your arms! I learned that! Am I doing it right?"],
  },
  wharf: {
    name: "Old Finn",
    news: [{ id: "hurt", when: hurtNow, line: "Old Finn: I've pulled healthier things out of the harbour. Go home and put your feet up." }, { id: "otter", when: beat("otter"), line: "Old Finn: You went up to the falls? Wet place, that. Very nice fish, though." }],
    small: ["Old Finn: The fish are biting again. The cats aren't.", "Old Finn: Fifty years on this pier, and I've only fallen in six times. That I'd admit to.", "Old Finn: That's a fine stick you've got. Bit thin for a fishing rod."],
    advice: ["Old Finn: Fish don't bite when you splash about. Wait for them. There's a lesson there, I expect."],
  },
  picnic: {
    name: "Nana Pim",
    news: [{ id: "hurt", when: hurtNow, line: "Nana Pim: You poor thing. Sit down here on the blanket. Pie first, then whatever you were doing." }, { id: "raccoon", when: beat("raccoon"), line: "Nana Pim: You beat that sleepy one? They still owe me a pie dish. They think I don't know." }],
    small: ["Nana Pim: Peace and quiet, and cherry pie. Sit down, dear.", "Nana Pim: This year's cherries are the best yet. I say that every year, and I'm always right.", "Nana Pim: Those raccoons get into everything. I've started leaving them their own pie."],
    advice: ["Nana Pim: Never fight on an empty stomach, and never leave a pie unattended."],
  },
  foundry: {
    name: "Big Lou",
    news: [{ id: "heron", when: beat("heron"), line: "Big Lou: You beat that one who stands still? We've been setting our shift clock by them for years." }, { id: "hurt", when: hurtNow, line: "Big Lou: You look like you've gone through the rollers. Go home. That's an order. I'm a foreman." }],
    small: ["Big Lou: Mill's running fine. Mind the sparks.", "Big Lou: We hear those heron folks through the wall. Well, we don't. That's the thing about them.", "Big Lou: Night shift got home on time this whole week. First time since I started."],
    advice: ["Big Lou: Hot iron, you only get a moment. Miss it and you're starting over. Same with you lot, I bet."],
  },
  gorge: {
    name: "Dot",
    news: [{ id: "otter", when: beat("otter"), line: "Dot: You beat Kenji! I could hear them cheering from here. For you! They were cheering for you!" }, { id: "hurt", when: hurtNow, line: "Dot: You look exhausted. Stay and look at the waterfall for a bit. It's still free." }],
    small: ["Dot: Isn't it something? Mind the mist.", "Dot: I've been looking at it for thirty years. I'm nearly done.", "Dot: Everyone asks where the water goes. Down, mostly."],
    advice: ["Dot: If you're ever stuck, go and look at something big. It won't help with your kendo, but it's nice."],
  },
  boardwalk: {
    name: "Mo",
    news: [{ id: "goose", when: beat("goose"), line: "Mo: That goose took a cone off a kid here once. Nobody saw it leave the dojo. You beat them? Good." }, { id: "hurt", when: hurtNow, line: "Mo: Here. Ice cream. On the bruise first, then eat it." }],
    small: ["Mo: Nice and quiet now. One scoop or two?", "Mo: Free cones for life, I said. I forgot how long you lot live.", "Mo: The kids all do that stomping thing now, up and down the boardwalk. Thanks for that."],
    advice: ["Mo: Eat it before it melts. Goes for most things."],
  },
};

/** What someone says after you've just beaten them in their own dojo, the first time and any time after. */
export const AFTER_WINS: Record<string, { first: string[]; again: string[] }> = {
  lantern: { first: ["Kiri: You caught the tide just right!"], again: ["Kiri: That was quick!", "Kiri: Let's try that again sometime."] },
  bamboo: { first: ["Nori: You waited for the right moment."], again: ["Nori: A fine match.", "Nori: You saw that one coming."] },
  radish: {
    first: ["Ren: ...There it is. I've been waiting a long time for someone to do that.", "Ren: Sensei Kuma will be unbearable. Tell them I said the corners still need sweeping."],
    again: ["Ren: Again. You're making a habit of this.", "Ren: Good. Now I've got something to do on Tuesdays."],
  },
  goose: {
    first: ["Hana: Sorr- no. Good match. That's the first time anyone's made me wait for it.", "Hana: You'd better go before the goose comes down. It's seen everything."],
    again: ["Hana: Okay. Okay! Next time I'm swinging twice as hard.", "Hana: Don't look at the roof. Just don't."],
  },
  raccoon: {
    first: ["Sora: Mm... you got me. That's going to be a good story, when I wake up.", "Sora: Hana's next, out past the beach. They're awake all the time. It's exhausting."],
    again: ["Sora: You again? Mm. Well fought. Is it time for lunch?", "Sora: I let you win that one. I think. I wasn't there for most of it."],
  },
  heron: {
    first: ["Mika: ...Yes. That was it.", "Mika: I've been standing here for eleven years, waiting to see that. Thank you."],
    again: ["Mika: You waited well.", "Mika: Come back when you're ready. I'll be here. You know that."],
  },
  otter: {
    first: ["Kenji: YOU BEAT ME! That's incredible! Do you know how long that took? I do! I was there!", "Kenji: Nobody's ever outlasted me! I'm so happy! Go again? No? Tomorrow?"],
    again: ["Kenji: Again! You did it again! I love this!", "Kenji: Let's go, let's go! Whenever you like! I'll be here! Wet!"],
  },
};

/** Waking up at home after going down. */
export const WAKE_UP: string[][] = [
  ["You come round on the floor just inside Pinecone's door, with a wet tenugui on your face. Everything hurts, then less so.", "Senpai Momo: There you are! Someone carried you in and set you down by the door. You've been out for hours. Up slowly."],
  ["You come round by the door again. Someone's drawn a small goose on your hand.", "Senpai Momo: Again, <name>? We're going to put your name on this doormat. Up slowly."],
  ["The floorboards by Pinecone's door. You know these floorboards by now.", "Sensei Kuma: You went out there hurt, and you know it. Get up when you can. Then we'll talk about your feet."],
];
