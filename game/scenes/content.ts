import type { Gear } from "../art/kendoka.ts";

export const DIALOGUE_WIDTH = 228;
export const DIALOGUE_LINES = 3;

export const GEAR_LINES: Record<keyof Gear, string> = {
  tare: "Tare: guards the waist and hips. It goes on first.",
  do: "Do: the chest armor. The strike to its side is also called do.",
  men: "Men: the helmet and face grille. Also the top-of-head target.",
  kote: "Kote: padded gloves for hands and wrists.",
  shinai: "Shinai: four bamboo slats tied together, on loan from Sensei. Never step over one!",
};

export const GI_LINE = "A spare gi and hakama. A little big, a little musty, and yours to borrow.";
export const DOOR_WELCOME = [
  "Nao: Welcome to Pinecone Dojo, <name>! I am Nao. This is where we practice kendo together.",
  "Nao: Walk with the movement keys and press E near someone to talk. You can explore, practice and challenge other dojos as you grow.",
  "Nao: Look for Momo on the left side of the hall. Her name appears when you get close. She will help you get started!",
];
export const MOMO_WELCOME = [
  "Senpai Momo: Welcome to Pinecone Dojo! You must be <name>, the new one. I'm Momo. I've been here longer than the paint.",
  "Senpai Momo: Kendo is bamboo sword practice. We learn posture, footwork and timing.",
  "Senpai Momo: We treat our partners with respect, too. A bow starts and ends every practice.",
  "Senpai Momo: Practice with Sensei, earn your armor, and challenge people here and beyond the dojo.",
  "Senpai Momo: Take it one step at a time.",
  "Senpai Momo: First practice? Lovely. Kendo starts with manners, and that means the right clothes. Not those ones.",
  "Senpai Momo: Sensei likes everyone in a proper gi. Even the beginners. Especially the beginners.",
  "Senpai Momo: We keep a spare in storage. It's a little big and a little musty, but it's clean enough. Come on, I'll show you.",
];
export const MOMO_AT_DOOR = [
  "Senpai Momo: Here we are. This is the storage room.",
  "Senpai Momo: The door sticks, so stand back a little. It likes to be asked nicely.",
];
export const MOMO_STORAGE_OPEN = [
  "Senpai Momo: There! The spare gi is just inside. Go and collect it.",
  "Senpai Momo: Then change into it and come and find Sensei. Bow when you do. Always bow.",
];
export const GI_REMINDER = ["Senpai Momo: The spare gi is in storage, through the door in the back wall."];
export const MOMO_GOT_GI = ["Senpai Momo: Looking sharp, <name>! Now go and greet Sensei. Bow first."];
export const SHINAI_WAITING = ["Senpai Momo: Sensei lent you the old shinai? You must be lucky. Don't step over it, and don't lose it!"];
export const MOMO_PRACTICE = ["Senpai Momo: Aki, Bo and Yui will each test you in their own way. You only need to pass one of them."];
export const MOMO_AFTER = ["Senpai Momo: You pushed me right back, <name>! Go on, the screen's all yours. And say hello to Ren for me."];
export const MOMO_GUARD = [
  "Senpai Momo: Full bogu already? Then you've found me out. Sensei's keepsake is behind this screen.",
  "Senpai Momo: Nobody gets to it without beating me. Show me that spirit of yours!",
];
export const MOMO_GUARD_SEME = [
  "Senpai Momo: You smell of ravine mud. So Old Gen taught you seme.",
  "Senpai Momo: Good. Push back when I press you, and mind my temper. Rei!",
];
export const MOMO_CRUSHED = [
  "Senpai Momo: Your spirit folds the moment I look at you. You can't beat me like this.",
  "Senpai Momo: Old Gen lives on Ravine Trail, and doesn't teach just anyone. Earn your seme, then come back.",
];
export const MOMO_KEEP_TRYING = ["Senpai Momo: Better! Hold your seme, and watch for my big swing when I run out of patience."];
export const MOMO_BEATEN = ["Senpai Momo: Ha! I felt that one, <name>. The screen's all yours."];
export const MOMO_LOSE_NO_SEME = "Your spirit folds under Momo's aura.";
export const MOMO_LOSE_SEME = "Hold I to push back. Answer the big swing.";
export const GEN_LINES = [
  "Old Gen: A visitor! Fine armor, but where's your spirit? Come into my hut.",
  "Old Gen: Seme is pressing with your ki until the other one flinches. Flinch too often, and we start over.",
];
export const GEN_FAIL = "Old Gen: You flinched, or you flailed. Go and eat something. Then we start again from the top.";
export const GEN_DONE = ["Old Gen: That's it, <name>. That's seme, and now it's yours."];
export const GEN_DONE_AFTER = [
  "Old Gen: Holding it costs ki and leaves you open, so let go when they move.",
  "Old Gen: And while you hold it, stomp with Space and shout. That's kiai. It pushes hard, but it costs you.",
];
export const GEN_AFTER = ["Old Gen: Press with your ki. Let go when they move. That's all I know, and it took me fifty years."];
export const SENSEI_NO_GI = "Sensei Kuma: Not in those clothes. Go and see Momo first.";
export const SENSEI_WHY = ["Sensei Kuma: So you're <name>. Momo says you're joining us. Why kendo?"];
export const WHY_OPTIONS = [
  { id: "hit", label: "I want to hit people" },
  { id: "cool", label: "It looked cool" },
  { id: "fun", label: "Seems like fun exercise" },
  { id: "zoro", label: "I want to be like Zoro" },
];
export const WHY_REPLY: Record<string, string> = {
  hit: "Sensei Kuma: Honest, at least. You'll be hit back, and you'll bow afterward.",
  cool: "Sensei Kuma: It does look cool. It looks less cool at six in the morning.",
  fun: "Sensei Kuma: Fun. Ask me again once your feet have blisters.",
  zoro: "Sensei Kuma: Three swords? Let's see what you do with one.",
};
export const SENSEI_OFFER = [
  "Sensei Kuma: No shinai yet, I see. I can lend you my old one. It's half worn out.",
  "Sensei Kuma: It comes back to me once you're stronger. Deal?",
];
export const OFFER_OPTIONS = [
  { id: "yes", label: "Deal. I'll bring it back" },
  { id: "no", label: "Not yet" },
];
export const SENSEI_NOT_YET = ["Sensei Kuma: It's not going anywhere. Neither are you, without it."];
export const SENSEI_SHINAI = ["Sensei Kuma: Good. It's a loan, so don't get attached."];
export const SENSEI_WANTS_IT_BACK = [
  "Sensei Kuma: A dan grade, and still carrying my old shinai. It's time you had your own, <name>.",
  "Sensei Kuma: Ask at the Bogu Shop. And mine comes back in one piece, so you'd better learn how to fix it.",
];
export const SENSEI_STILL_WAITING = "Sensei Kuma: Still owe me a shinai. Ask at the Bogu Shop.";
export const SENSEI_MINE_STILL_CRACKED = "Sensei Kuma: Mine's still cracked. Fix it at Fumi's bench, then bring it back.";
const RETURN_REASON: Record<string, string> = {
  hit: "Sensei Kuma: You came here to hit people, and here you are mending bamboo. Good as new. Let me look at you.",
  cool: "Sensei Kuma: You said it looked cool. There's nothing cool about fixing an old shinai, and you did it anyway.",
  fun: "Sensei Kuma: Fun exercise, you said. Good as new, this. I hope it's still fun.",
  zoro: "Sensei Kuma: Still after three swords? You've looked after one properly. That's a start.",
};
const RETURN_PLAIN = "Sensei Kuma: Good as new. I didn't think I'd see this one looking like that again.";
export const returnLines = (why: string): string[] => [
  RETURN_REASON[why] ?? RETURN_PLAIN,
  "Sensei Kuma: It goes back on the rack, for the next beginner.",
  "Sensei Kuma: Take this bag, and this for your trouble. Your spirit grows: ki +10, and 100 kensen.",
];
export const FUMI_OFFER = [
  "Fumi: Your first shinai of your own? There's a fine one on my shelf. It's good to swing, and it won't teach you a thing.",
  "Fumi: To fix your Sensei's, you have to know how they're made. Bring me bamboo from Ravine Trail, and I'll show you.",
];
export const FUMI_WAITING = "Fumi: The fine one's on the shelf. Bring me bamboo from Ravine Trail, and I'll teach you to make and mend your own.";
export const GEN_BAMBOO = [
  "Old Gen: Fumi sent you for bamboo? Hm. Not that one. Not that one. Four winters old, no younger.",
  "Old Gen: This one. Cut it clean, and don't thank me. Thank the bamboo.",
];
export const FUMI_BUILD_START = ["Fumi: That's good bamboo. Gen must like you. Split it, shave it, and we'll put it together. I'll ask, you answer."];
export const SHINAI_STEPS: { question: string; options: { id: string; label: string }[]; right: string; wrong: string }[] = [
  {
    question: "Fumi: First. How many slats make a shinai?",
    options: [{ id: "two", label: "Two" }, { id: "four", label: "Four" }, { id: "eight", label: "Eight" }],
    right: "four",
    wrong: "Fumi: Count the ones on my shelf. Four. Try again.",
  },
  {
    question: "Fumi: Next, the string that holds them under tension. Which side does it run along?",
    options: [{ id: "back", label: "The back, away from the strike" }, { id: "front", label: "The striking edge" }, { id: "spiral", label: "Wound around it all" }],
    right: "back",
    wrong: "Fumi: The string marks the back. You hit with the other side. Try again.",
  },
  {
    question: "Fumi: Last, the little leather tie, the nakayui. Where does it sit?",
    options: [{ id: "quarter", label: "A quarter of the way from the tip" }, { id: "grip", label: "Up by the grip" }, { id: "tip", label: "Right on the tip" }],
    right: "quarter",
    wrong: "Fumi: Too far off. It goes a quarter of the way down from the tip. Try again.",
  },
];
export const FUMI_BUILD_DONE = [
  "Fumi: There. It's not pretty, but it's yours.",
  "Fumi: Now you know how, your Sensei's old one needs the same care. My bench is yours. Fix it before you take it back.",
];
export const BENCH_BROWSE = "See the shelves";
export const benchLabel = (name: string, left: number, cost: number) => `${name}: ${left}/100, ${cost ? `${cost} kensen` : "free"}`;
export const BENCH_TOO_DEAR = "Fumi: That's more kensen than you've got on you. It'll keep.";
export const BENCH_FIXED_SELF = (name: string) => `You split, shave and retie it at Fumi's bench. ${name} is as good as new.`;
export const BENCH_FIXED_FUMI = (name: string) => `Fumi: Leave it with me. ...There. ${name} is as good as new.`;
export const wornOutLine = (name: string) => `${name} is wearing thin, and it's costing you ki. Fumi's bench at the Bogu Shop can sort that out.`;
export const SHINAI_BAG_LINE = "A shinai carried in it wears half as fast.";
export const ITEM_IN_HAND = "In hand";
export const ITEM_PUT_AWAY = "Put away";
export const HINT_WIELD = "Use this";
export const DURABILITY_LABEL = "Durability";
export const BAMBOO_LINE = "Four winters old, from Old Gen's stand. Fumi at the Bogu Shop is waiting for it.";
export const OWN_SHINAI_LINE = "You split, shaved and tied this one yourself. Never step over it.";
export const SENSEI_SHINAI_AFTER = ["Sensei Kuma: Armor is earned. Show me some drills."];
export const SENSEI_AGAIN = ["Sensei Kuma: From the top, then."];
export const SENSEI_ALL_OPEN = "Sensei Kuma: There's nothing left I can point you at. Keep your back straight.";
export const KOTE_DONE = "Sensei Kuma: Full bogu! Before that door opens, beat a senpai in a real match. Aki, Bo or Yui will spar.";
export const DOOR_NEEDS_SPAR = "Sensei's rule: nobody goes out until they can beat a senpai. Aki, Bo or Yui will spar with you.";
export const SPAR_DOOR_OPEN = "Sensei Kuma: I saw that. You can hold your own now. The front door is open.";
export const SPAR_KI = "Your spirit grows: ki +5.";
export const LINE_FIRST = "Sensei Kuma: Each senpai in the line shows one opening. Strike it, stomp, and slide through to the next.";
export const LINE_AGAIN = "Sensei Kuma: Again, and quicker this time.";
export const LINE_NO_KEYS = "Sensei Kuma: This time, no key prompts. Tip dips: men. Hands rise: kote. Arms high: do.";
export const LINE_READY = "Sensei Kuma: Ready? E to line up, X to leave.";
export const LINE_LEFT = "Sensei Kuma: Stepping out? The line will still be here.";
export const LINE_STREETS_OPEN = "Sensei Kuma: That's three good runs. You're ready for the streets. Your spirit grows: ki +5.";
export const lineRunDone = (cleans: number, count: number, run: number, needed: number) =>
  `Sensei Kuma: ${cleans} of ${count} clean. That's good run ${run} of ${needed}. Your spirit grows: ki +5.`;
export const lineExtraRun = (cleans: number, count: number) => `Sensei Kuma: ${cleans} of ${count} clean. Your feet are starting to know the way.`;
export const lineFailed = (cleans: number, count: number) => `Sensei Kuma: ${cleans} of ${count} clean. Read their hands, and go again when you're ready.`;
export const KIRIKAESHI_FIRST = [
  "Sensei Kuma: Kirikaeshi builds stamina, and Bo will receive. Big men with a stomp, four sayu men forward, five back.",
  "Sensei Kuma: The same again, then one last big men, all the way through. Call every men, and watch your breath.",
];
export const KIRIKAESHI_BIG_KEYS = "Space + J";
export const KIRIKAESHI_AGAIN = "Sensei Kuma: Kirikaeshi again, and closer to full speed. Call every men, and spend your breath carefully.";
export const KIRIKAESHI_READY = "Sensei Kuma: Ready? E to begin, X to leave.";
export const KIRIKAESHI_LEFT = "Sensei Kuma: Catch your breath. Bo isn't going anywhere.";
export const kirikaeshiGrew = (misses: number) => `Sensei Kuma: All the way through. Slips: ${misses}. Your spirit grows: ki +5.`;
export const kirikaeshiDone = (misses: number) => `Sensei Kuma: All the way through. Slips: ${misses}. Your breath is getting steadier.`;
export const KIRIKAESHI_WINDED = "Sensei Kuma: Out of breath. Slips cost ki, and none comes back until the chain is done. Go again when you're ready.";
export const KIRIKAESHI_LOST = "Sensei Kuma: You lost the rhythm. Left, right, left, right. Keep your hands going and your feet will follow.";
export const KIRIKAESHI_NO_FOLLOW = "Sensei Kuma: You stopped at the end. The last men goes through Bo, hands up, all the way past.";
export const KIRIKAESHI_TITLE = "Kirikaeshi";
export const KIRIKAESHI_HELP = "Space + J big men  A D sayu men  Hold D follow through";
export const KIRIKAESHI_EARLY = "Too soon!";
export const KIRIKAESHI_WRONG = "Other side!";
export const KIRIKAESHI_LATE = "Too late!";
export const KIRIKAESHI_NOW = "NOW";
export const KIRIKAESHI_LOW = "Low ki!";
export const SAYU_CALL = "Men!";
export const MENU_KIRIKAESHI = "Kirikaeshi";
export const LINE_TITLE = "Line drill";
export const LINE_WRONG = "Wrong opening!";
export const LINE_SLOW = "Too slow!";
export const LINE_PASSED_BY = "Walked past!";
export const LINE_HELP = "J men  K kote  L do  Space stomp";
export const SENSEI_ROUND_DONE = [
  "Sensei Kuma: Now practise with a senpai: Aki, Bo or Yui. Pass one of their challenges and you'll earn a do.",
  "Sensei Kuma: Take that to a senpai. Pass one of their challenges and you'll earn a men.",
  "Sensei Kuma: Back to a senpai one last time. Pass one of their challenges and the kote is yours.",
];
export const SENSEI_WAITING = [
  "Sensei Kuma: Go on, pick a senpai: Aki, Bo or Yui. Pass a challenge and you'll earn your do.",
  "Sensei Kuma: Go on, pick a senpai. Pass a challenge and you'll earn your men.",
  "Sensei Kuma: Go on, pick a senpai. Pass a challenge and you'll earn your kote.",
];
export const SENSEI_NEXT = [
  "",
  "Sensei Kuma: A do! People can hit it now, so let's learn what that means.",
  "Sensei Kuma: A men! Now your head's fair game too. Time for the kote, and for a long launch.",
];
export const STORAGE_LOCKED = "Locked. Senpai Momo looks after the key.";

export const DRILL_PRAISE: Partial<Record<keyof Gear, string>> = {
  tare: "Sensei Kuma: Feet, strike and follow-through. That's a start. Your first armor.",
};

export const LESSON_PROMPTS = {
  parry: "Sensei: Watch my tip. When it shines, tap S. Holding it is only a block. Parry me twice.",
  parryCounter: "Sensei: A parry leaves me open, and your next strike comes out fast. Parry, then J and Space, then hold D.",
  lockPush: "Sensei: Hilts together: tsuba-zeriai. I'm only holding my guard, so push through it. Hold D. A steps out.",
  lockHiki: "Sensei: Now I'm leaning on you. J and Space: you'll draw back, then cut. Then hold A to carry on backwards.",
  lockHold: "Sensei: When my hands drop, I'm about to pull back and cut. Hold S as soon as you see it.",
  cross: "Sensei: Go for men just as I do: J and Space. Neither lands, and we pass. That's ai-uchi. It happens a lot.",
  crossTurn: "Sensei: Again, then keep going. You'll be on my other side, so walk in with A, strike, and hold A to finish.",
  opening: "Sensei: Every strike starts from an opening. Hold W to raise your shinai, Q to open your wrist, E to drop your tip.",
  quickOpening: "Coach: Every strike starts from an opening. Hold W, Q and E in turn. What's showing is what's open.",
  quickSeme: "Coach: Hold I to press me until I flinch. Space shouts, for a harder push. You're open while you do it.",
  quickStrike: "Coach: Slide in with D. Hold W, then J and Space together for men, and hold D to slide through. No slide, no point.",
  quickTell: "Coach: My hands are rising, so my wrist is open. Hold an opening of your own, K and Space for kote, then hold D.",
  quickParry: "Coach: When my tip shines, tap S, and the strike's knocked aside for free. Holding S is only a block.",
  quickPush: "Coach: Hilts locked: tsuba-zeriai. Pushing beats a held guard. Hold D until I'm off balance.",
  quickHiki: "Coach: A held guard beats a pull, and a pull beats a push. I'm pushing, so J and Space, then hold A.",
  quickCross: "Coach: Swing as I do: J and Space. Nobody scores, you pass, and you fight on from there.",
  suriashi: "Sensei: Footwork first. Slide in with D until it says In range, back out with A, then slide in again.",
  fumikomi: "Sensei: Strike and foot as one. Hold W, then press J and Space together: men with fumikomi!",
  zanshin: "Sensei: Now finish it. Open up, J and Space, then hold D to slide through. That's zanshin.",
  block: "Sensei: You wear a do now, so I can really hit it. See my tip dip? Hold S to block!",
  do: "Sensei: Hands up high leaves my side open. I'll stop short of your head. L and Space, then slide through!",
  kote: "Sensei: See my hands rising? My wrist is open. K and Space, then slide through!",
  launch: "Sensei: From far, tap D twice to launch. No opening needed: J and Space as you land, then slide through!",
  semeHold: "Old Gen: Hold I, or my spirit folds yours. Press until I flinch. Space shouts, for a harder push.",
  semePunish: "Old Gen: A flinch is an opening. Press until I flinch, then J and Space, and slide through.",
  semeRead: "Old Gen: Press me, and I'll lose patience. When my arms go up, let go! L and Space, and slide through.",
};
const NEEDS_FOLLOW = "Then slide through!";
/** Each senpai's way of being, and their own take on each level's drill. */
export const SENPAI_LINES = {
  aki: {
    intro: "Aki: Practice? Yes! I talk a lot and I never stand still, so keep up!",
    chat: [
      "Aki: I forgot my tenugui once. My men smelled of regret for a week.",
      "Aki: There's an old bamboo screen in storage. I've always wondered what's behind it.",
    ],
    seeSensei: "Aki: You've earned that! Go and see what Sensei has for you next.",
    prompts: [
      `Aki: Catch me! Stay in range, J and Space. ${NEEDS_FOLLOW}`,
      `Aki: Hands high? L and Space. I can hit your do now, so hold S! ${NEEDS_FOLLOW}`,
      `Aki: Hands rising? K and Space. I can hit your men and do, so hold S! ${NEEDS_FOLLOW}`,
    ],
    spar: "Aki: A real match? Yes! First to two, and I won't slow down. E to start, X to leave.",
    sparWin: "Aki: You got me! I'm telling everyone. Everyone!",
    sparAgain: "Aki: Any time! I'll be here. Or there. Somewhere.",
    pass: "Aki: Whew, you kept up! Here, this one's yours.",
    fail: "Aki: Too many misses! Come back and try again, any time. I'll be here. Or there. Somewhere.",
  },
  bo: {
    intro: "Bo: Mm. I'm a wall. Walls open up eventually. You just have to notice.",
    chat: ["Bo: Kendo means the way of the sword.", "Bo: Mostly it means washing your gi a lot."],
    seeSensei: "Bo: Mm. Good. Sensei next.",
    prompts: [
      `Bo: Wait for my guard to drop, then J and Space. Don't hit the wall. ${NEEDS_FOLLOW}`,
      `Bo: Hands high? L and Space. I can hit your do now, so hold S! ${NEEDS_FOLLOW}`,
      `Bo: Hands rising? K and Space. I can hit your men and do, so hold S! ${NEEDS_FOLLOW}`,
    ],
    spar: "Bo: Mm. A real match. First to two. I rarely swing. E to start, X to leave.",
    sparWin: "Bo: Mm. The wall came down.",
    sparAgain: "Bo: Mm. Rest first.",
    pass: "Bo: Mm. You noticed. This is yours.",
    fail: "Bo: Mm. You hit the wall a lot. Rest, then come back.",
  },
  yui: {
    intro: "Yui: I count every stomp. Every strike starts from far away, and I only allow one mistake.",
    chat: ["Yui: Your left foot was late. Oh, you haven't started yet? Well, it will be."],
    seeSensei: "Yui: Acceptable. Sensei will want you now.",
    prompts: [
      `Yui: Slide into range, hold E, then J and Space, exactly. ${NEEDS_FOLLOW}`,
      `Yui: Hands high? L and Space. I can hit your do now, so hold S! ${NEEDS_FOLLOW}`,
      `Yui: Hands rising? K and Space. I can hit your men and do, so hold S! ${NEEDS_FOLLOW}`,
    ],
    spar: "Yui: A real match, first to two. I'm after your wrists. E to start, X to leave.",
    sparWin: "Yui: That was correct. I'll allow it.",
    sparAgain: "Yui: We'll begin again when you're ready.",
    pass: "Yui: Clean. I have nothing to correct. This is yours.",
    fail: "Yui: That's two mistakes. We'll begin again when you're ready.",
  },
};
export const LESSON_GOOD = "Good!";
export const ZANSHIN_PROMPT = "Zanshin! Hold";
export const KIAI_SHOUT = "YAAAH!";
export const FLINCH = "Flinch!";
export const COWER = "They cower!";
export const NO_STOMP = "No fumikomi!";
export const NO_ZANSHIN = "No zanshin!";
export const LESSON_WRONG = "Clean hit, but that's not the one I asked for. Again!";
export const STOPPED_SHORT = "Stopped short";
export const GOT_YOU = "Got you!";
export const TSUBA_FOUND = "Hidden all this time! Your ki will last longer.";
export const SEME_ITEM_LINE = "Hold I in any fight to press with your spirit. Space shouts.";
export const CUP_ENTER = "E to enter. One loss and you're out.";
export const cupNotice = (name: string, prize: boolean) => `Notice board: ${name}. Four fighters, from all over the city.${prize ? " First win: ki +15." : ""}`;
export const CUP_WON_BEFORE = "You've won this one. Your name's already up there.";
export const cupLeft = (name: string) => `You bow out of the ${name}. The bracket will wait.`;
export const OBJECTIVES = {
  meetMomo: "Talk to Senpai Momo",
  getGi: "Get the spare gi from storage",
  greetSensei: "Greet Sensei Kuma",
  shinaiSeeSensei: "See Sensei Kuma at home",
  shinaiAskShop: "Ask at the Bogu Shop about a shinai",
  shinaiChoose: "Learn to fix a shinai: get bamboo on Ravine Trail",
  shinaiFix: "Fix Sensei's shinai at Fumi's bench",
  shinaiBamboo: "Take the bamboo to Fumi at the Bogu Shop",
  shinaiReturn: "Return Sensei's old shinai",
  firstDrill: "Finish Sensei's first drill",
  senpaiChallenge: "Pass any one senpai's challenge",
  nextLesson: "See Sensei for your next lesson",
  renPoint: "Ren wants one point from you",
  grading: (rank: string) => `Ask at home to grade for ${rank}`,
  useTicket: "Use your ticket: Esc, Inventory",
  showLetter: "Show your letter to Sensei at home",
  feeShort: (fee: number, money: number) => `Grading fee: ${fee} kensen. You have ${money}`,
  grandTaikai: "Win the Grand Taikai",
};
export const CONTROLS_TITLE = "Controls";
export const CONTROL_ROWS: { keys: string; does: string; needsSeme?: boolean }[] = [
  { keys: "Arrows WASD", does: "Move" },
  { keys: "E Space", does: "Talk, choose" },
  { keys: "X", does: "Back out" },
  { keys: "Hold W Q E", does: "Show do, kote, men" },
  { keys: "J K L", does: "Men, kote, do, from one" },
  { keys: "Space", does: "Stomp with a strike" },
  { keys: "S", does: "Block. Tap it: parry" },
  { keys: "Tap D D", does: "Launch. Strike off it" },
  { keys: "I", does: "Hold for seme", needsSeme: true },
  { keys: "Esc P", does: "Menu" },
  { keys: "M F", does: "Mute, fullscreen" },
];
export const CHARACTER_TITLE = "Who are you?";
export const INSIGNIA_TITLE = "Your tare";
export const INSIGNIA_NOTE = "Design the cloth on its front. Optional.";
export const INSIGNIA_ROWS = ["Symbol", "Cloth", "Mark"];
export const SCREEN_LOOK = "An old bamboo screen, cracked right down the middle.";
export const SCREEN_NO_SHINAI = "You've got nothing to hit it with anyway. Sensei hasn't let you near a shinai yet.";
export const SCREEN_NEEDS_TRAINING = "Better not swing at the furniture on your first day. Not yet, anyway.";
export const SCREEN_HINT = "It's only cracked. A good strike might do it. J, K or L.";
export const ARRIVAL = ["Thunder Radish Dojo. The whole place smells of pickles."];
export type GangStory = {
  /** Who's in trouble. Every line of theirs opens with this name. */
  person: string;
  /** Why you're stepping in: their cry for help, then the gang's answer. */
  help: string[];
  thanks: string;
  after: string;
};
export const GANG_STORIES: Record<string, GangStory> = {
  market: {
    person: "Auntie Bea",
    help: [
      "Auntie Bea: Help! The Alley Cats are taking my fruit stall apart!",
      "Alley Cat: Protection money, granny. Who's going to stop us? Shorty with the stick?",
    ],
    thanks: "Auntie Bea: My stall! Bless you. Have a plum. Your spirit grows: ki +10.",
    after: "Auntie Bea: No more trouble here, dear. Plums are on the house.",
  },
  bridge: {
    person: "Little Tomo",
    help: [
      "Little Tomo: They took my shinai! They won't let me cross without paying!",
      "Alley Cat: This is Alley Cat road now. Toll's ten coins, bamboo-for-brains.",
    ],
    thanks: "Little Tomo: My shinai! I'll never step over it, I promise. Your spirit grows: ki +10.",
    after: "Little Tomo: I've been practising my men cuts! Watch!",
  },
  wharf: {
    person: "Old Finn",
    help: [
      "Old Finn: They're cutting my nets and scaring everyone off the pier!",
      "Alley Cat: These docks are Alley Cat turf. Beat it, or go for a swim.",
    ],
    thanks: "Old Finn: They're gone, and my nets are safe! Your spirit grows: ki +10.",
    after: "Old Finn: The fish are biting again. The cats aren't.",
  },
  picnic: {
    person: "Nana Pim",
    help: [
      "Nana Pim: They're taking everyone's picnic baskets, and my pie!",
      "Alley Cat: Pie tax, Nana. Alley Cat rules. Who's going to argue?",
    ],
    thanks: "Nana Pim: My pie! Have the first slice. Your spirit grows: ki +10.",
    after: "Nana Pim: Peace and quiet, and cherry pie. Sit down, dear.",
  },
  foundry: {
    person: "Big Lou",
    help: [
      "Big Lou: They've chained the gate, and the night shift can't get home!",
      "Alley Cat: Pay up, or it's a very long shift. Alley Cats run this town too.",
    ],
    thanks: "Big Lou: The gate's open! Everybody home! Your spirit grows: ki +10.",
    after: "Big Lou: Mill's running fine. Mind the sparks.",
  },
  gorge: {
    person: "Dot",
    help: [
      "Dot: They're charging people money to look at the waterfall! The waterfall!",
      "Alley Cat: Alley Cat waterfall now. That'll be ten coins for each eye.",
    ],
    thanks: "Dot: You did it! Everyone can look for free! Your spirit grows: ki +10.",
    after: "Dot: Isn't it something? Mind the mist.",
  },
  boardwalk: {
    person: "Mo",
    help: [
      "Mo: The Alley Cats stole my ice cream cart, and the kids are crying!",
      "Alley Cat: Finders keepers! Want a cone? Come and get it.",
    ],
    thanks: "Mo: You got my cart back! Free cones for life. Your spirit grows: ki +10.",
    after: "Mo: Nice and quiet now. One scoop or two?",
  },
};
export const GANG_FLED = "You back off for now. They're still at it. Come back when you're ready.";
export const SAFE_BUBBLE = "Thank you!";
export const HELP_BUBBLE = "Help!";
export const TOWER_FIRST = "You ride to the top. The whole city spreads out below, and a calm settles over you: ki +10.";
export const TOWER_AGAIN = "Still a great view. You've already taken it all in.";
export const MAP_HELP: Record<string, string> = {
  dojo: "Arrows or WASD walk   E go inside",
  gang: "Arrows or WASD walk   E help out",
  gangDone: "Arrows or WASD walk   E say hello",
  stop: "Arrows or WASD walk   E catch streetcar",
  station: "Arrows or WASD walk   E catch train",
  tournament: "Arrows or WASD walk   E go inside",
  master: "Arrows or WASD walk   E visit the hut",
  tower: "Arrows or WASD walk   E ride to the top",
  path: "Arrows or WASD walk",
  store: "Arrows or WASD walk   E go inside",
};
export const BRAWL_HELP = "Walk back past the start to leave";
export const KEI_LINES = [
  "Kei: Ren's shinai tells a story before it moves. Watch it, not the feet.",
  "Kei: Hide behind your guard and Ren leans in with that stare. It leaves Ren wide open.",
];
export const DAI_LINES = ["Dai: Even Ren runs out of breath. And mind that stare. Stand under it too long and your spirit folds."];
export const IDA_LINES = ["Ida: Hana hates waiting. Stand your ground, and the swings will come to you."];
export const PIP_LINES = ["Pip: Hana loves the big swing. Both arms way up high. That's a long time to be up there."];
export const GOOSE_ARRIVAL = ["Angry Goose Dojo. A very large goose watches you from the roof."];
export const HANA_LINES = [
  "Hana: Pinecone, huh? Our goose bit the last visitor.",
  "Hana: First to two points. Rei, and then we honk. I mean begin.",
];
export const HANA_WIN_LINES = ["Rei. Hana bows, and the goose looks away."];
export const TRAVELLING = "Travelling";
export const NEXT_STOP = "Next stop:";
export const REN_LINES = [
  "Ren: So you're <name>, the one going around beating everybody. I've been expecting you.",
  "Ren: First to two points. Mind my stare, and press back. Rei, and then we begin.",
];
/** Ren's first visit, while you're still in your first bits of armor. The line about your tare goes after the first. */
export const REN_FIRST = [
  "Someone you don't know has been watching your drills from across the hall. Now they've walked over.",
  "Ren: Don't stop on my account. I'm Ren, from Thunder Radish. I used to sweep this floor.",
  "Ren: Go on, a senpai's waiting to test you. Maybe I'll still be around when you've earned the rest.",
];
export const renNoticesTare = (symbol: string): string =>
  symbol === "plain" ? "Ren: A blank tare. Nothing to live up to yet. Lucky you." : `Ren: A ${symbol} on your tare. Now you've got something to live up to.`;
export const REN_TEA = "Ren: Go on. I'm only here for the tea.";
export const REN_BOGU = [
  "Ren's back, and this time they haven't come for the tea.",
  "Ren: Full bogu already. It doesn't fit yet. It will.",
  "Ren: Sensei says I can have one point from you. Just one. Let's see what you do when someone really looks at you.",
];
export const REN_LATER = "Ren: Another time, then. I'll be here.";
export const REN_READY = "Ren: Ready to give me that one point?";
export const REN_POINT_LOST = "Ren: There. You'd folded before I even moved.";
export const REN_POINT_WON = "Ren: ...Huh. Nobody's done that in a while. You still flinched first, though.";
export const REN_POINT_LESSON = [
  "Ren: You looked me in the eyes. Everyone does, and that's all my stare needs.",
  "Ren: So don't. Look at all of me at once, like a mountain a long way off.",
  "Ren: Enzan no metsuke, the far-mountain gaze. It took me years. You've got it for free.",
];
export const REN_POINT_LESSON_AFTER = ["Ren: Take that with you. You'll want it at Thunder Radish, the last door in the city. I'll be waiting."];
export const REN_FINAL_GAZE = [
  "Ren: There you are, <name>. Are you still looking at that far mountain?",
  "Ren: First to two points, and no favours this time. Rei, and then we begin.",
];
export const GAZE_ITEM_LINE = "You can see Ren's strikes coming, and their stare takes longer to shake you.";
export const REN_POINT_TIP = "You flinched, and Ren barely moved.";
export const REN_POINT_NEXT = "Ren lowers their shinai.";
export const REN_BOW_GAZE = "Rei. Look at all of Ren at once.";
export const SORA_NAP = ["Sora: Zzz... Mmf? I came to borrow Sensei's kettle, and then there was this nice patch of floor.", "Sora: Sleepy Raccoon's mine. Come and try me. Not before noon."];
export const VISITOR_LINES: Record<"goose" | "heron" | "otter", string[]> = {
  goose: ["Hana: You beat Sora? Sora was asleep. Come and try someone who's awake.", "Hana: Angry Goose, out past the beach. Mind the goose."],
  heron: ["Mika: I came to watch you and Hana. It took me a while to get here. I don't mind.", "Mika: Iron Heron, up the train line. I can wait for you too."],
  otter: ["Kenji: You outlasted Mika! Nobody outlasts Mika! I could never stand that still!", "Kenji: Soggy Otter, out at the falls! Bring a towel! Or don't!"],
};
export const REN_AT_OTTER_LESSON = ["Ren: Four dojos. And I hear you stopped looking people in the eyes. Good.", "Ren: There's only my door left. Come when you're ready."];
export const REN_AT_OTTER_NO_LESSON = ["Ren: Four dojos, and you never did give me that one point.", "Ren: You'll want what I was going to show you. I still drop by Pinecone. Come and find me there first."];
export const RACCOON_ARRIVAL = ["Sleepy Raccoon Dojo. Nobody's awake, and someone has been through the bins."];
export const NIKO_LINES = ["Niko: Sora hardly seems to be awake. Then, snap! Watch those hands."];
export const RIO_LINES = ["Rio: Sora goes for the same small target again and again. It's almost rude."];
export const SORA_LINES = [
  "Sora: Mmf? A visitor. Is it morning?",
  "Sora: First to two points. Rei, and then I can go back to sleep.",
];
export const SORA_WIN_LINES = ["Rei. Sora yawns, bows, and falls asleep."];
export const HERON_ARRIVAL = ["Iron Heron Dojo. The whole building hums with the mill next door."];
export const TEO_LINES = ["Teo: Mika can stand still longer than you can. Try not to get bored."];
export const UMA_LINES = ["Uma: When Mika finally moves, it's all at once. Be ready for it."];
export const MIKA_LINES = [
  "Mika: You came a long way by train. Stand still a moment.",
  "Mika: First to two points. Rei. I can wait.",
];
export const MIKA_WIN_LINES = ["Rei. Mika nods once, very slowly."];
export const OTTER_ARRIVAL = ["Soggy Otter Dojo. Everything's damp, and everyone's delighted about it."];
export const VAL_LINES = ["Val: Kenji doesn't stop. Not to breathe, not to think. Let it come to you."];
export const WES_LINES = ["Wes: All that swinging costs Kenji plenty. Outlast it, and it opens up."];
export const KENJI_LINES = [
  "Kenji: A visitor! Great! You're dry! We can fix that!",
  "Kenji: First to two points! Rei! Let's go, let's go, let's go!",
];
export const KENJI_WIN_LINES = ["Rei. Kenji shakes off like a wet dog."];
export const TAIKAI_STEP_UP = "E step up   Esc to withdraw";
export const TAIKAI_OUT = "E go again   X leave";
export const TAIKAI_CHAMPION = "Champion!";
export const TAIKAI_CHAMPION_LINE = "Every dojo in the land bows to you.";
export const TAIKAI_CHAMPION_AGAIN = "E carry on";
export const cupWonLine = (name: string) => `You took the ${name}.`;
export const TAIKAI_LOST = "Rei. The crowd applauds anyway.";
export const TAIKAI_WITHDRAW = "Withdraw";
export const CHOOSE_TITLE = "Where to?";
export const CHOOSE_HELP = "E go   X stay";
export const WIN_LINES = ["Rei. Ren bows back, and almost smiles."];
export const TITLE_CONTINUE = "Continue";
export const TITLE_NEW = "New game";
export const TITLE_ERASE = "This erases your saved game. E: erase  X: keep it";
export const PAUSE_TITLE = "Paused";
export const PAUSE_HELP = "Arrows choose   E select   M mute";
export const PAUSE_CONFIRM = "Erase your saved game and start over?";
export const PAUSE_NO = "No, keep playing";
export const PAUSE_YES = "Yes, start over";
export const PAUSE_BACK = "E back";
export const PAUSE_INSIGNIA = "Tare insignia";
export const PAUSE_CONTROLS = "Controls";
export const PROGRESS_OPEN = "Open";
export const PROGRESS_NONE = "Nothing yet";
export const PROGRESS_CHAMPION = "Champion";
export const FORFEIT_MATCH = "Forfeit match";
export const FORFEIT_GANG = "Back off";
export const FORFEIT_TRAINING = "Stop training";
export const FORFEIT_LINE = "Stop the drill";
export const DOOR_LOCKED = "You only just got here! Have a word with Senpai Momo.";

export function allContentLines(): string[] {
  return [
    ...Object.values(GEAR_LINES),
    GI_LINE,
    ...MOMO_WELCOME,
    ...MOMO_AT_DOOR,
    ...MOMO_STORAGE_OPEN,
    ...GI_REMINDER,
    ...MOMO_GOT_GI,
    ...SHINAI_WAITING,
    ...MOMO_AFTER,
    SENSEI_NO_GI,
    ...SENSEI_SHINAI,
    ...SENSEI_WHY,
    ...WHY_OPTIONS.map((option) => option.label),
    ...Object.values(WHY_REPLY),
    ...SENSEI_OFFER,
    ...OFFER_OPTIONS.map((option) => option.label),
    ...SENSEI_NOT_YET,
    SENSEI_MINE_STILL_CRACKED,
    ...Object.keys(RETURN_REASON).flatMap(returnLines),
    ...returnLines(""),
    BENCH_BROWSE,
    benchLabel("Sensei's old shinai", 50, 0),
    benchLabel("Your men", 20, 40),
    BENCH_TOO_DEAR,
    BENCH_FIXED_SELF("Sensei's old shinai"),
    BENCH_FIXED_FUMI("Sensei's old shinai"),
    wornOutLine("Sensei's old shinai"),
    SHINAI_BAG_LINE,
    ITEM_IN_HAND,
    ITEM_PUT_AWAY,
    HINT_WIELD,
    DURABILITY_LABEL,
    SCREEN_NO_SHINAI,
    ...SENSEI_WANTS_IT_BACK,
    SENSEI_STILL_WAITING,
    ...FUMI_OFFER,
    FUMI_WAITING,
    ...GEN_BAMBOO,
    ...FUMI_BUILD_START,
    ...SHINAI_STEPS.flatMap((step) => [step.question, step.wrong, ...step.options.map((option) => option.label)]),
    ...FUMI_BUILD_DONE,
    BAMBOO_LINE,
    OWN_SHINAI_LINE,
    ...SENSEI_SHINAI_AFTER,
    ...SENSEI_AGAIN,
    SENSEI_ALL_OPEN,
    KOTE_DONE,
    DOOR_NEEDS_SPAR,
    SPAR_DOOR_OPEN,
    SPAR_KI,
    LINE_FIRST,
    LINE_AGAIN,
    LINE_NO_KEYS,
    LINE_READY,
    LINE_LEFT,
    LINE_STREETS_OPEN,
    ...KIRIKAESHI_FIRST,
    KIRIKAESHI_BIG_KEYS,
    KIRIKAESHI_AGAIN,
    KIRIKAESHI_READY,
    KIRIKAESHI_LEFT,
    kirikaeshiGrew(4),
    kirikaeshiDone(4),
    KIRIKAESHI_WINDED,
    KIRIKAESHI_LOST,
    KIRIKAESHI_NO_FOLLOW,
    KIRIKAESHI_TITLE,
    KIRIKAESHI_HELP,
    KIRIKAESHI_EARLY,
    KIRIKAESHI_WRONG,
    KIRIKAESHI_LATE,
    KIRIKAESHI_NOW,
    KIRIKAESHI_LOW,
    SAYU_CALL,
    MENU_KIRIKAESHI,
    LINE_TITLE,
    LINE_WRONG,
    LINE_SLOW,
    LINE_PASSED_BY,
    LINE_HELP,
    ...SENSEI_ROUND_DONE,
    ...SENSEI_WAITING,
    ...SENSEI_NEXT.filter(Boolean),
    STORAGE_LOCKED,
    ...Object.values(DRILL_PRAISE),
    ...Object.values(LESSON_PROMPTS),
    ...Object.values(SENPAI_LINES).flatMap((s) => [s.intro, ...s.chat, s.seeSensei, ...s.prompts, s.spar, s.sparWin, s.sparAgain, s.pass, s.fail]),
    ...MOMO_PRACTICE,
    ...MOMO_GUARD,
    ...MOMO_GUARD_SEME,
    ...MOMO_CRUSHED,
    ...MOMO_KEEP_TRYING,
    ...MOMO_BEATEN,
    MOMO_LOSE_NO_SEME,
    MOMO_LOSE_SEME,
    ...GEN_LINES,
    ...GEN_DONE,
    ...GEN_DONE_AFTER,
    ...SENSEI_RAIKO_LINES,
    ...NEMU_INTRO, ...NEMU_AGAIN, ...NEMU_WIN, ...KAN_INTRO, ...KAN_AGAIN, ...KAN_WIN, ...MIZU_INTRO, ...MIZU_AGAIN, ...MIZU_WIN, ...HAGANE_INTRO, ...HAGANE_AGAIN, ...HAGANE_WIN, ...RAIKO_INTRO, ...RAIKO_AGAIN, ...RAIKO_WIN,
    ...RADISH_ARRIVALS, ...GOOSE_ARRIVALS, ...RACCOON_ARRIVALS, ...HERON_ARRIVALS, ...OTTER_ARRIVALS,
    tipLine(25),
    awayOffer("Sensei Hagane"), awayTooJunior("Sensei Hagane", "3rd dan"), awayWon("Sensei Hagane"), awayLost("Sensei Hagane"), LETTER_HELD, LETTER_LINE,
    ...["sensei", "aki", "bo", "yui"].flatMap((asker) => [letterYes(asker, "Hana"), letterTest(asker, "Hana"), letterNo(asker, "Hana")]),
    ...VERIFY_WON, ...VERIFY_LOST, VERIFY_WALKED,
    ...SENSEI_KAN_LINES,
    ...SENSEI_NEMU_LINES,
    ...SENSEI_HAGANE_LINES,
    ...SENSEI_MIZU_LINES,
    ...REN_POINT_LESSON_AFTER,
    GEN_FAIL,
    ...GEN_AFTER,
    STOPPED_SHORT,
    GOT_YOU,
    LESSON_GOOD,
    LESSON_WRONG,
    ZANSHIN_PROMPT,
    KIAI_SHOUT,
    FLINCH,
    COWER,
    NO_STOMP,
    NO_ZANSHIN,
    TSUBA_FOUND,
    SCREEN_LOOK,
    SCREEN_NEEDS_TRAINING,
    SCREEN_HINT,
    ...ARRIVAL,
    ...KEI_LINES,
    ...DAI_LINES,
    ...REN_LINES,
    ...WIN_LINES,
    ...Object.values(GANG_STORIES).flatMap((story) => [...story.help, story.thanks, story.after]),
    GANG_FLED,
    SAFE_BUBBLE,
    HELP_BUBBLE,
    ...IDA_LINES,
    ...PIP_LINES,
    ...GOOSE_ARRIVAL,
    ...HANA_LINES,
    ...HANA_WIN_LINES,
    ...RACCOON_ARRIVAL, ...NIKO_LINES, ...RIO_LINES, ...SORA_LINES, ...SORA_WIN_LINES,
    ...HERON_ARRIVAL, ...TEO_LINES, ...UMA_LINES, ...MIKA_LINES, ...MIKA_WIN_LINES,
    ...OTTER_ARRIVAL, ...VAL_LINES, ...WES_LINES, ...KENJI_LINES, ...KENJI_WIN_LINES,
    TAIKAI_STEP_UP, TAIKAI_OUT, TAIKAI_CHAMPION, TAIKAI_CHAMPION_LINE, TAIKAI_CHAMPION_AGAIN, TAIKAI_LOST, TAIKAI_WITHDRAW, SEME_ITEM_LINE, CUP_ENTER, CUP_WON_BEFORE, cupNotice("Thunder Open", true), cupLeft("Grand Taikai"), cupWonLine("Thunder Open"), CHARACTER_TITLE, INSIGNIA_TITLE, INSIGNIA_NOTE, CHOOSE_TITLE, CHOOSE_HELP,
    TRAVELLING,
    NEXT_STOP,
    TOWER_FIRST,
    TOWER_AGAIN,
    ...Object.values(MAP_HELP),
    BRAWL_HELP,
    DOOR_LOCKED,
    TITLE_CONTINUE,
    TITLE_NEW,
    TITLE_ERASE,
    PAUSE_TITLE,
    PAUSE_HELP,
    PAUSE_CONFIRM,
    PAUSE_NO,
    PAUSE_YES,
    PAUSE_BACK,
    PROGRESS_OPEN,
    PROGRESS_NONE,
    PROGRESS_CHAMPION,
    HINT_MOVE, HINT_PAGE, HINT_PICK, HINT_BACK, HINT_USE, HINT_WEAR, HINT_TAKE_OFF, ITEM_WORN, ITEM_NOT_WORN, ITEM_FIGHTS_ONLY, NAME_TITLE, HINT_KEEP_NAME, HINT_NAME_BACK, ITEM_READY, RANK_LEVEL, RANK_XP_LEFT, ...RANK_STATS, MAP_NEXT, MAP_OPEN, MAP_LOCKED, MAP_NOTHING_NEEDED, TECHNIQUES_TITLE,
    FORFEIT_MATCH,
    FORFEIT_GANG,
    FORFEIT_TRAINING,
    FORFEIT_LINE,
  ];
}

/** Getting sent for a grading: you ask at home, someone tests you, and you ride out to the panel with your ticket. */
export const gradingNotYet = (rank: string) => `You want to grade for ${rank}? You can't be sent yet.`;
export const GRADING_ROUTES: Record<number, string> = {
  1: "Or win the Raccoon Open. Or beat Sensei Kuma, and the panel could make an exception.",
  2: "Or win the Goose Open. Or beat Tetsu at Angry Goose, and the panel could make an exception.",
  3: "Or win the Heron or Otter Open. Or beat Shin at Iron Heron, and the panel could make an exception.",
};
const RECOMMEND_BY: Record<string, string> = {
  yui: "Yui will see if you're good enough.",
  momo: "Beat Momo, and I'll sign for you.",
  sensei: "Then you answer to me. Bow.",
};
export const recommendOffer = (asker: string, tester: string): string[] =>
  asker === "Sensei Kuma" ? [`Sensei Kuma: You'd stand before that panel in this dojo's name. ${RECOMMEND_BY[tester]}`] : [`${asker}: You'd be carrying this dojo's name. Beat me first, and I'll vouch for you.`];
export const recommendRedirect = (asker: string) => `${asker}: That's above me. Only Sensei can vouch for you at that level.`;
/** The heads of the other dojos, who've seen it all and will tell you about it. */
export const SENSEI_RAIKO_LINES = [
  "Sensei Raiko: Ren was the loudest child I ever taught. Now they hardly say a word, and it's much worse.",
  "Sensei Raiko: Thunder comes after the flash. Learn to watch for the flash.",
];
export const SENSEI_KAN_LINES = [
  "Sensei Kan: Who let you in? Wipe your feet. ...Fine. You can stay.",
  "Sensei Kan: I told Hana to stop apologizing for hitting people. They stopped apologizing, and kept hitting.",
];
export const SENSEI_NEMU_LINES = [
  "Sensei Nemu: Mm? Oh. Is it morning already?",
  "Sensei Nemu: Sora looks asleep, but Sora isn't asleep. I'm the one who's asleep.",
];
export const SENSEI_HAGANE_LINES = [
  "Sensei Hagane: Iron doesn't hurry. Mika learned that here, standing very still for a very long time.",
  "Sensei Hagane: You can wait for someone to move, or you can make them. Mika will wait.",
];
export const SENSEI_MIZU_LINES = [
  "Sensei Mizu: Mind the puddle. No, the other one. We gave up on the roof years ago.",
  "Sensei Mizu: Kenji never stops coming, like the rain. You can't stop rain. You step out of it.",
];
export const NEMU_INTRO = ["Sensei Nemu: A match? Now? ...Mm. Fine. Wake me if you score.", "Sensei Nemu: I wouldn't relax, if I were you. Nobody here is as asleep as they look."];
export const NEMU_AGAIN = ["Sensei Nemu: You again. I was having such a nice dream about you losing."];
export const NEMU_WIN = ["Sensei Nemu: ...Oh. Did I lose? How refreshing. I'll sleep well on that."];
export const KAN_INTRO = ["Sensei Kan: You've got some nerve, walking in here with that rank. Good. I'll knock it out of you."];
export const KAN_AGAIN = ["Sensei Kan: Back for more? Wipe your feet first."];
export const KAN_WIN = ["Sensei Kan: Hmph. Don't tell the goose."];
export const MIZU_INTRO = ["Sensei Mizu: Rain doesn't get tired, and neither do I. Let's see how long you stay dry."];
export const MIZU_AGAIN = ["Sensei Mizu: Still dripping from last time? Come on in, then."];
export const MIZU_WIN = ["Sensei Mizu: Well, now. You stepped right out of it. I may finally have to fix that roof."];
export const HAGANE_INTRO = ["Sensei Hagane: Iron waits. I've waited for better than you. Whenever you're ready."];
export const HAGANE_AGAIN = ["Sensei Hagane: You've come back. Iron doesn't mind."];
export const HAGANE_WIN = ["Sensei Hagane: You bent iron. It doesn't happen twice in one lifetime."];
export const RAIKO_INTRO = ["Sensei Raiko: Ren speaks well of you, which is to say, not at all. Bow. Watch for the flash."];
export const RAIKO_AGAIN = ["Sensei Raiko: Still standing? The storm's only just started."];
export const RAIKO_WIN = ["Sensei Raiko: So that's what it's like, to hear the thunder first. Tell nobody. Tell everybody."];
/** How the head of the place greets you some days, and how the place itself feels. */
export const RADISH_ARRIVALS = ["Thunder Radish Dojo. Far off, something rumbles. It might be the weather.", "Thunder Radish Dojo. Everyone stops talking as you walk in. Then they start again, more quietly."];
export const GOOSE_ARRIVALS = ["Angry Goose Dojo. There's a feather on the floor. Nobody dares move it.", "Angry Goose Dojo. Something honks on the roof, and everybody stands a little straighter."];
export const RACCOON_ARRIVALS = ["Sleepy Raccoon Dojo. Someone's snoring in the back. It may be the senior student.", "Sleepy Raccoon Dojo. The lanterns are lit, though it's the middle of the day."];
export const HERON_ARRIVALS = ["Iron Heron Dojo. Today the mill has stopped, and the quiet is somehow worse.", "Iron Heron Dojo. Nobody looks up. A few of them may not have moved since yesterday."];
export const OTTER_ARRIVALS = ["Soggy Otter Dojo. A bucket's filling up somewhere. Someone cheers when it overflows.", "Soggy Otter Dojo. It's stopped raining, and everyone seems a little disappointed."];
const PACE: Record<"quick" | "calm" | "slow", string> = { quick: "is restless", calm: "looks calm", slow: "is unhurried" };
const FAVOURITE: Record<string, string> = { men: "men", kote: "kote", do: "do", bigMen: "big men", quickMen: "quick men" };
/** What you can tell about someone just from looking at them across the court. It's always true. */
export const moodLine = (name: string, pace: "quick" | "calm" | "slow", favourite: string) => `${name.replace("Sensei ", "")} ${PACE[pace]}. Watch for ${FAVOURITE[favourite] ?? favourite}.`;
export const tipLine = (amount: number) => `Someone presses ${amount} kensen on you as you leave. "For your trouble."`;
/** Getting a ticket from somewhere else: you beat someone at another dojo, and bring a letter home. */
export const awayOffer = (name: string) => `${name}: Beat me, and I'll write you a letter for the panel. Your own dojo still gets the last word.`;
export const awayTooJunior = (name: string, rank: string) => `${name}: I can't vouch for ${rank}. You'd have to beat someone who's at least that.`;
export const awayWon = (name: string) => `${name}: Fair enough. Here's your letter. Take it home, and see what your own people make of it.`;
export const awayLost = (name: string) => `${name}: Not today. Come back when you can beat me.`;
export const LETTER_HELD = "You've got a letter already. Take it home to Sensei or a senpai.";
export const LETTER_LINE = "Another dojo says you're ready. Your own has the last word.";
const LETTER_YES: Record<string, (from: string) => string> = {
  sensei: (from) => `Sensei Kuma: ${from} wrote this? Then I'll take their word for it. Here's your ticket.`,
  aki: (from) => `Aki: ${from} said that? About you? Amazing! Here, take your ticket! I'll tell Sensei!`,
  bo: (from) => `Bo: Mm. ${from}. Good enough. Here's your ticket.`,
  yui: (from) => `Yui: I checked ${from}'s handwriting, the date and the seal. All correct. Here's your ticket.`,
};
const LETTER_TEST: Record<string, (from: string) => string> = {
  sensei: (from) => `Sensei Kuma: ${from}'s word is one thing. I'd like to see it for myself. One point, right here.`,
  aki: (from) => `Aki: ${from} really said that? Show me! One point, right now, come on!`,
  bo: (from) => `Bo: Mm. ${from} writes a nice letter. One point, and I'll believe it.`,
  yui: (from) => `Yui: ${from} left out the details. I'd like to count them myself. One point.`,
};
const LETTER_NO: Record<string, (from: string) => string> = {
  sensei: (from) => `Sensei Kuma: A letter from ${from}? No. This dojo doesn't send people on someone else's word. Earn it again.`,
  aki: (from) => `Aki: Oh. ${from} wrote this? I've heard stories. Sorry! It's no good. Try someone else?`,
  bo: (from) => `Bo: No. I don't know ${from}, and neither do you. Burn it.`,
  yui: (from) => `Yui: ${from} spelled your name wrong. This isn't valid. Start again.`,
};
export const letterYes = (asker: string, from: string) => LETTER_YES[asker](from);
export const letterTest = (asker: string, from: string) => LETTER_TEST[asker](from);
export const letterNo = (asker: string, from: string) => LETTER_NO[asker](from);
export const VERIFY_WON = ["So the letter was true. Here's your ticket. Don't embarrass us."];
export const VERIFY_LOST = ["Not like that. Keep the letter, and ask again when you're steadier."];
export const VERIFY_WALKED = "Keep the letter, then. It'll still say the same thing tomorrow.";
export const VERIFY_BOW = "One point. Prove the letter true";
export const MENU_NEWS = "What's new?";
export const MENU_CHAT = "How's it going?";
export const MENU_ADVICE = "Any advice?";
export const EXIT_WALK = "Just walk outside";
export const exitOption = (place: string) => `Go to ${place}`;
export const AUTO_WALK = (place: string) => `Heading to ${place}   X stop`;
export const AUTO_LOST = "You can't get there from here right now.";
export const REST_NOTICE = "Rested: HP full";
export const HP_LABEL = "HP";
export const hpLost = (lost: number, left: number) => `HP -${lost}, now ${left}`;
export const CANT_GO_ON = "You can't go on.";
export const reclaimed = (amount: number, name: string) => `${name} hands back your ${amount} kensen.`;
export const reclaimedFromGang = (amount: number) => `The Alley Cats drop your ${amount} kensen as they run. You scoop it up.`;
export const MENU_LETTER = "Show your letter";
export const MENU_TALK = "Talk";
export const MENU_CHALLENGE_THEM = "Challenge";
export const RECOMMEND_WON = ["Here's your grading ticket. You represent this dojo now, so don't embarrass us."];
export const RECOMMEND_LOST = ["Not yet. You aren't ready to represent the dojo. Ask again when you are."];
export const RECOMMEND_WALKED = "Not today, then. Ask again when you're ready.";
export const RECOMMEND_BOW = "Show them you can represent the dojo";
export const TICKET_HELD = "You've got your ticket already. Press Esc, open Inventory and use it.";
export const TICKET_LINE = "Your dojo vouches for you. Use it to ride out to the grading hall.";
export const TICKET_NOT_NOW = "Finish what you're doing first";
export const CARD_TRAVEL = "Travel now";
export const CARD_KEEP = "Keep it";
export const CHOICE_HINT = "E choose   X back";
export const MENU_LINE = "Line drill";
export const MENU_GRADE = "Ask about grading";
export const MENU_CHALLENGE = "Challenge Sensei";
export const MENU_SPAR = "Spar";
export const MENU_LEAVE = "Never mind";
export const INVENTORY_EMPTY = "Nothing yet.";
export const INVENTORY_USE = "E use   X back";
export const INVENTORY_WEAR = "E wear or take off   X back";
export const PROGRESS_OPEN_DONE = "Done";
export const HINT_MOVE = "Move";
export const HINT_PAGE = "Page";
export const HINT_PICK = "Pick";
export const HINT_BACK = "Back";
export const HINT_USE = "Use";
export const HINT_WEAR = "Wear";
export const HINT_TAKE_OFF = "Take off";
export const ITEM_WORN = "Worn";
export const ITEM_NOT_WORN = "Not worn";
export const ITEM_FIGHTS_ONLY = "Fights only";
/** Where your name goes in anything someone says. */
export const NAME_TOKEN = "<name>";
export const fillName = (line: string, name: string): string => line.replaceAll(NAME_TOKEN, name);
export const NAME_TITLE = "What's your name?";
export const nameNote = (fallback: string) => `Type your own, or just go by ${fallback}.`;
export const nameMenuLabel = (name: string) => `Name: ${name}`;
export const HINT_KEEP_NAME = "Keep";
export const HINT_NAME_BACK = "Back";
export const ITEM_READY = "Ready to use";
export const RANK_LEVEL = "Level";
export const RANK_XP_LEFT = "xp to next level";
export const RANK_STATS = ["Beaten", "Cups", "Dojos"];
export const MAP_NEXT = "Next";
export const MAP_OPEN = "Open";
export const MAP_LOCKED = "Locked";
export const MAP_NOTHING_NEEDED = "Nothing needed";
export const TECHNIQUES_TITLE = "Techniques";

export const GRADING_HALL_NAME = "Grading Hall";
export const HEADING_BACK = "Heading back";
export const HALL_OBJECTIVE = "Show the panel what you can do";
export const HALL_ARRIVAL = ["The Grading Hall. Candidates warm up along the wall. At the far end, three examiners wait."];
export const PANEL_NO_TICKET = ["Examiner Ono: You've no business at this table today. The door's behind you."];
export const panelNoFee = (fee: number, money: number) => `Examiner Ono: Each attempt is ${fee} kensen, and you have ${money}. Your ticket's still good, so come back with the fee.`;
export const panelOffer = (rank: string, fee: number) => [
  `Examiner Ono: You're here for ${rank}. Each attempt costs ${fee} kensen, pass or fail. X backs out for free.`,
  "Examiner Ono: Two parts. First your basics: clean strikes down the line, and no hints.",
  "Examiner Ono: We aren't watching the score. We're watching your feet, your strike and your follow-through.",
];
export const KIHON_PASSED = ["Examiner Ono: Your feet and your hands arrived together. Good."];
export const KIHON_FAILED = ["Examiner Ono: Not clean enough. Your ticket's still good, so come back up when you're ready."];
export const KIHON_LEFT = "Examiner Ono: You stepped out. Your ticket's still good.";
export const KIHON_TITLE = "Demonstration";
export const TACHIAI_READY = ["Examiner Ono: Now one bout, against another candidate. Win it cleanly."];
export const GRADING_FAILED = ["Examiner Ono: Not today. There's no shame in that, and most people fail a few. Your ticket's still good."];
export const gradingPassed = (rank: string) => [`Examiner Ono: You've shown us enough, <name>. You're ${rank}. Your ride home is at the door.`];
export const GRADING_DONE = ["Three dan is as far as anyone here can send you. Above that, you'd need a bigger table."];
export const GRADING_WALKED = "Examiner Ono: You stepped out. Your ticket's still good.";
export const GRADING_BOW = "Grading. The panel is watching";
export const RANK_LINE = "It's on your record, and the whole dojo knows.";

/** People who fight unlike anyone else, and only fight people of a certain rank. */
export const challengerNotYet = (name: string, rank: string) => `${name}: Come back at ${rank}. Till then, keep watching from over there.`;
export const exceptionLine = (rank: string) => `Word reaches the panel, and they make an exception. You're ${rank}.`;
export const SENSEI_INTRO = [
  "Sensei Kuma: You want to skip ahead? Fine. Win a bout against me, and the panel can make an exception.",
  "Sensei Kuma: I won't go easy, and my stare doesn't wait. If you don't know seme yet, you'll feel it.",
];
export const SENSEI_REMATCH = ["Sensei Kuma: Again? Good. Bow."];
export const SENSEI_WIN = ["Sensei Kuma: Well. I'll have to tell them I taught you that."];
export const CHALLENGER_WALKED = "They nod. Plenty of people step out of that one.";
export const TETSU_INTRO = [
  "Tetsu: Jodan. Shinai overhead, one hand, and I can hit you from where you think you're safe.",
  "Tetsu: My men's out of your reach, so don't bother. Step inside. When my hands pull back, take my wrist.",
];
export const TETSU_AGAIN = ["Tetsu: Again? Come inside my reach, if you dare."];
export const TETSU_WIN = ["Tetsu: You came inside. Hardly anyone's that brave twice."];
export const SHIN_INTRO = [
  "Shin: Nito. Two swords. The short one covers my head, and it'll eat your strikes all day.",
  "Shin: But when the long one rises, whatever it's going for, my do is open. That's the only door I've got.",
];
export const SHIN_AGAIN = ["Shin: Find the door again, then."];
export const SHIN_WIN = ["Shin: Through the only door. I'll cover it better next time."];

/** Coins tucked away where nobody says to look. The key is where, and which tile you were facing. */
export const EGG_LINES: Record<string, string[]> = {
  "pinecone|r": ["Behind the shinai rack: a few forgotten kensen. Nobody's cleaned back here in years."],
  "goose|p": ["There's something in the plant pot. Kensen, and a very large feather. You keep the kensen."],
  "radish|r": ["Tucked behind the rack, next to a jar of pickles: kensen. You leave the pickles."],
  "raccoon|p": ["Someone's been hiding snacks in this plant. And kensen. You take the kensen."],
};

/** What people say to each other when they think you aren't listening. They have to fit over someone's head. */
export const CHAT_LINES = ["Nice men!", "Again?", "My wrist...", "Water?", "One more!", "Did you eat?", "Sensei saw.", "Too slow!", "Feet first.", "Good one.", "Who's next?", "So tired.", "Rematch?", "Shh. Focus.", "Your kote!", "Heard that?"];

export const MENU_HELP = "Help with training";
export const HELP_OFFER = ["Sensei Kuma: The beginners could use someone to follow. Show them a clean line, and there's a little something in it for you."];
export const HELP_TITLE = "Helping out";
export const helpPaid = (amount: number) => `Sensei Kuma: That helps. Here's ${amount} kensen for your trouble.`;
export const HELP_FAILED = "Sensei Kuma: They learned what not to do, at least. Try again when you like.";
export const MENU_MERCH = "Merch";
export const SHOP_TITLES: Record<string, string> = { store: "Bogu Shop", beachShop: "Shell Market", parkShop: "Blossom Shop", steelShop: "Forge Shop", fallsShop: "Falls Outfitters", lantern: "Lantern merch", bamboo: "Bamboo merch", cup: "Tournament stall", pinecone: "Pinecone merch", raccoon: "Raccoon merch", goose: "Goose merch", heron: "Heron merch", otter: "Otter merch", radish: "Radish merch" };
export const SHOP_HELP = "E buy or wear   X leave";
export const SHOP_OWNED = "Owned";
export const SHOP_WORN = "Worn";
export const TAIKAI_STALL = "X stall";
export const BET_NONE = "No bet";
export const betLabel = (stake: number) => `Bet ${stake} kensen`;
export const betHud = (stake: number) => `Bet ${stake}`;
export const betWon = (amount: number) => `Bet won: +${amount} kensen`;
export const betLost = (amount: number) => `Bet lost: -${amount} kensen`;
export const CHALLENGES_TITLE = "Challenges";
export const CHALLENGE_DONE = "Challenge:";

// What the referee calls, and what shows in a fight.
export const CROSSED = "Ai-uchi!";
export const CALL_HAJIME = "Hajime!";
export const CALL_NIHONME = "Nihon-me!";
export const CALL_SHOBU = "Shobu!";
export const CALL_WAKARE = "Wakare!";
export const CALL_TIME = "Time!";
export const CALL_ENCHO = "Encho!";
export const NEEDS_OPENING = "Hold W, Q or E first";
export const STATUS_SHOWS_MEN = "Men open";
export const STATUS_SHOWS_KOTE = "Kote open";
export const STATUS_SHOWS_DO = "Do open";
export const LOCK_CALL = "Tsuba-zeriai!";
export const TSUBA_LABEL = "Tsuba-zeriai";
export const PARRIED = "Parry!";
export const STATUS_OPEN = "Open";
export const STATUS_WIDE_OPEN = "Wide open";
export const STATUS_STUNNED = "Stunned";
export const STATUS_STUMBLING = "Stumbling";
export const STATUS_PARRYING = "Parrying";
export const STATUS_COUNTER = "Counter!";
export const STATUS_PUSH = "Push";
export const STATUS_HOLD = "Hold";
export const STATUS_PULL = "Pull!";
export const SHOVED = "Off balance!";
export const CLOSING_LINE = "Sonkyo. Sheathe, step back, and bow";

export const MENU_WAZA = "Teach me more waza";
export const MENU_WAZA_AGAIN = "Waza practice";
export const WAZA_OFFER = ["Sensei Kuma: Strikes aren't everything. Before anyone sends you for 1st dan, you should know what happens when strikes don't land."];
export const WAZA_DONE = ["Sensei Kuma: Good. That's most of what a real match is: all the moments when nobody scores.", "Sensei Kuma: You won't get far without those. And nobody at 1st dan is allowed not to know them."];
export const WAZA_AGAIN_DONE = ["Sensei Kuma: Still sharp. Good."];
export const COACH_NAME = "Coach";
export const QUICK_DONE = ["Coach: That's the lot. Double-tap toward them to launch, and hold I for seme. You'll pick up the rest by losing."];

export const TITLE_MULTIPLAYER = "Multiplayer";
export const TITLE_START = "Start";
export const ONLINE_TITLE = "Multiplayer";
export const ONLINE_DUEL = "Duel";
export const ONLINE_TOURNAMENT = "Tournament";
export const ONLINE_TUTORIAL = "Short tutorial (about two minutes)";
export const ONLINE_PRIMER_YES = "Show me (under a minute)";
export const ONLINE_PRIMER_NO = "Not now, go on";
export const onlinePrimerNote = (needs: readonly string[]): string => {
  const missing = needs.map((n) => (n === "opening" ? "openings" : "seme")).join(" or ");
  return `You don't know ${missing} yet, and the other player will use them. Want a quick tutorial first?`;
};
export const ONLINE_TUTORIAL_AGAIN = "Short tutorial again";
export const ONLINE_BACK = "Back";
export const ONLINE_GATE = "Multiplayer is for 1st dan and up. Earn it in the story, with Sensei's waza lesson, or take the short tutorial and go straight in.";
export const ONLINE_PRACTICE = "Nobody's online yet: you'll play stand-ins, over the same connection a real match would use.";
export const ONLINE_LIVE = "Connected to the server.";
export const ONLINE_RECORD = (wins: number, losses: number): string => `${wins} won ${losses} lost`;
export const ONLINE_SEARCHING = "Looking for an opponent...";
export const ONLINE_CANCEL = "X: stop looking";
export const ONLINE_WAITING = "Waiting for the other player...";
export const ONLINE_BOW = "Rei. Bow, step in, and draw";
export const ONLINE_FORFEIT = "Concede the match";
export const ONLINE_WITHDRAW = "Withdraw";
export const ONLINE_WON = "You win!";
export const ONLINE_LOST = "You lost";
export const ONLINE_LEFT = (name: string): string => `${name} left, so it's yours`;
export const ONLINE_OUT_OF_STEP = "The match fell out of step. It won't count.";
export const ONLINE_CONTINUE = "E or Space: continue";
export const ONLINE_NEXT = "E or Space: on to your next match";
export const ONLINE_CHAMPION = "Champion!";
export const ONLINE_OUT = "You're out. Well fought.";
export const ONLINE_DRAW_WAIT = "Waiting for the draw...";
export const YOU = "You";
export const PARRY_NOW = "S now!";
