import type {
  ClinicalSummary,
  PanelChoice,
  PanelRequest,
  Synthesis,
  Take,
  VoiceId,
} from "./types";

/**
 * Three complete, hand-written debates so the app is usable — and honestly
 * demonstrable — with no API key and no spend. These are the only questions
 * the demo will answer: replaying a canned panel against someone's real
 * question would be a lie about what they were reading.
 */

export interface DemoDebate {
  slug: string;
  question: string;
  about: PanelRequest["about"];
  panel: PanelChoice;
  takes: Take[];
  challenges: Array<{ voiceId: VoiceId; targetId: VoiceId; text: string }>;
  synthesis: Synthesis;
  /** The clinician-facing pass, so demo mode covers that feature too. */
  clinical: ClinicalSummary;
}

export const DEMOS: DemoDebate[] = [
  {
    slug: "cant-start",
    question:
      "I can't start tasks even when I genuinely care about them and the deadline is tomorrow. I'll sit there for four hours doing nothing and hating myself. It's been like this since school but it got much worse after I started working from home.",
    about: "me",
    panel: {
      framing:
        "Why you can sit for hours unable to begin something you care about, and why working from home made it worse.",
      seated: [
        {
          id: "clinician",
          reason: "You've described a long-standing pattern that changed recently — that shape matters.",
        },
        {
          id: "neurodivergence",
          reason: "Working from home removed a lot of structure, and that detail is doing work here.",
        },
        {
          id: "careful-skeptic",
          reason: "There is a very popular explanation for this, and it deserves pushback before you settle on it.",
        },
        {
          id: "been-there",
          reason: "The self-hatred in the four hours is the part clinical descriptions tend to skip.",
        },
      ],
      notSeated: [
        {
          id: "growing-up",
          reason: "You're describing yourself as an adult, so the developmental-range questions don't apply.",
        },
        {
          id: "relationships",
          reason: "Nothing you wrote points at a pattern between you and another person.",
        },
        {
          id: "meaning",
          reason: "Not invited — this panel only includes the faith and meaning voice when you ask for it.",
        },
      ],
    },
    takes: [
      {
        voiceId: "clinician",
        text: "The two details worth separating are \"since school\" and \"much worse after working from home\". A difficulty that has been there since childhood and then worsens when external structure disappears looks different from one that arrives fresh in adulthood — the first suggests something about how you're built that a scaffolded environment was compensating for; the second would point at what changed.\n\nSo the useful question isn't \"is this procrastination or something else\", it's whether the trouble is specifically with *starting* — initiation — or with sustaining attention once started, or with the dread that attaches to the task. Those three look identical from the outside and come apart quickly once you watch for them.\n\nWhat would make me wrong: if the four-hour paralysis only happens with a particular kind of task, or only in the last year, then \"since school\" is doing less work than it appears and I'd be over-weighting the history.",
      },
      {
        voiceId: "neurodivergence",
        text: "You changed the environment and the difficulty got worse. That's not a coincidence to explain away — it's the most informative thing in what you wrote.\n\nAn office supplies an enormous amount of borrowed executive function: someone else's start time, other people visibly working, a commute that acts as a switch, the mild social pressure of being seen. Take all of that away and a person who was managing on borrowed structure suddenly has to generate it internally, which is precisely the thing that's hard. Nothing about you got worse. The scaffolding came down.\n\nThat reframe isn't just comforting, it's testable and it changes what you'd try — you'd rebuild external structure rather than trying harder. What would make me wrong: if you were equally stuck in the office and just noticed it less, then the environment story is a smaller part of this than I'm making it.",
      },
      {
        voiceId: "careful-skeptic",
        text: "Before this becomes a diagnosis in your head: four hours of paralysis before a deadline, worse in isolation, with self-hatred attached, is also what a badly designed job produces in an ordinary nervous system. It's what burnout looks like. It's what depression looks like from the inside, where the flattening reads as laziness rather than as low mood. It's what working alone in a room does to a lot of people.\n\nI'd also gently note that \"since school\" is a memory, and memory reorganises itself around whatever explanation you currently hold. Almost everyone can find childhood evidence for whatever they've just read about.\n\nI'm not saying nothing is going on — the distress is real and you clearly aren't choosing this. I'm saying the tidy explanation is arriving fast, and the boring ones haven't been ruled out. What would settle it: whether this is present in things you enjoy and aren't obliged to do.",
      },
      {
        voiceId: "been-there",
        text: "The four hours are not empty. That's the thing people get wrong about them. You're not relaxing, you're not avoiding in any pleasant sense — you're sitting in the doorway of the task, aware of every minute, paying full emotional price for time you're getting no rest from. It's exhausting in a way that doing the work would not be.\n\nAnd then the self-hatred, which does something specific: it makes starting more expensive, because now beginning means admitting how long you sat there. So the later it gets, the harder it gets, which is the opposite of how deadlines are supposed to work.\n\nI'll say plainly that this is my experience and not a finding. But the thing that shifted it for me wasn't discipline. It was lowering the bar for what counted as starting until it was almost insultingly small — and, separately, having another person in the room, even a silent one on a video call.",
      },
    ],
    challenges: [
      {
        voiceId: "careful-skeptic",
        targetId: "neurodivergence",
        text: "The environment story is clean and I mostly buy it — but you've built it entirely from one correlation the person reported themselves, and \"it got worse when I started working from home\" is also true of a great many people who were simply lonelier and less well. You'd predict they're fine in a co-working space within a fortnight. I'd predict the flatness follows them there. That's checkable, and it's the thing I'd want checked before we go further.",
      },
      {
        voiceId: "been-there",
        targetId: "careful-skeptic",
        text: "You're right that the tidy explanation arrives too fast, and I'd concede the memory point entirely. But there's a cost to your framing you should own: \"the boring explanations haven't been ruled out\" is the exact sentence people hear for fifteen years before anyone looks properly. Both can be true. The way to tell isn't argument, it's whether the paralysis shows up on things with no deadline, no consequence, and genuine want attached — a hobby they've been meaning to start.",
      },
      {
        voiceId: "clinician",
        targetId: "been-there",
        text: "The small-bar advice is good and I'd keep it. What I'd push on is treating \"another person in the room\" as a coping tip, when it's actually the most diagnostic observation in this whole discussion. If a silent stranger on a video call reliably unlocks a task that four hours of solitary willpower cannot, that tells you something specific about initiation versus motivation — and it's worth noticing deliberately rather than just using.",
      },
    ],
    synthesis: {
      headline: "The panel agrees this is about starting, not about caring — but splits on why.",
      plainSummary:
        "Everyone here read your four hours the same way: as a problem with getting started, not a problem with motivation or effort. Nobody thought you were choosing this. Where they came apart is the cause — whether the working-from-home change is the main event (structure disappeared) or a red herring (something else got worse at the same time, and isolation just made it visible).\n\nWorth knowing before you weigh any of this: all four voices come out of the same underlying AI model. When they agree, that's much weaker evidence than four separate people agreeing — they share the same blind spots and the same training. Treat the agreements as a decent place to start looking, not as a finding.",
      agreements: [
        {
          point: "The trouble is starting, not caring",
          detail:
            "All four separated task initiation from motivation, and none of them read the four hours as avoidance in any ordinary sense.",
          voices: ["clinician", "neurodivergence", "careful-skeptic", "been-there"],
        },
        {
          point: "The self-hatred makes it worse mechanically",
          detail:
            "Not just unpleasant — it raises the cost of starting as time passes, which is why deadlines stop working the way they do for other people.",
          voices: ["been-there", "clinician"],
        },
        {
          point: "The change of setting is the most informative detail you gave",
          detail:
            "Whether or not it's the cause, it's the closest thing to a natural experiment in your account and everyone wanted to reason from it.",
          voices: ["neurodivergence", "careful-skeptic", "clinician"],
        },
      ],
      disagreements: [
        {
          topic: "Is the environment the cause, or a spotlight?",
          sideA: {
            voices: ["neurodivergence"],
            position:
              "Working from home removed borrowed structure you were quietly relying on. Nothing about you changed; the scaffolding came down.",
          },
          sideB: {
            voices: ["careful-skeptic"],
            position:
              "Isolation made an ordinary decline visible. Low mood or burnout would produce exactly this picture, and the timing would look identical.",
          },
          whatWouldSettleIt:
            "Whether structure alone fixes it. Two weeks in a library, café, or co-working space, or on silent video calls with someone. If the paralysis largely lifts, the structure account wins. If it follows you there, it doesn't.",
        },
        {
          topic: "How much weight to put on 'since school'",
          sideA: {
            voices: ["clinician"],
            position:
              "A lifelong pattern that worsens when support is removed is a recognisable shape and worth taking seriously.",
          },
          sideB: {
            voices: ["careful-skeptic"],
            position:
              "Childhood memory reorganises around whatever explanation you currently hold. Almost anyone can find school-age evidence for anything.",
          },
          whatWouldSettleIt:
            "Anything written down at the time — old school reports, a parent's account given before you had a theory. Contemporary records beat recollection here.",
        },
      ],
      waysToTellApart: [
        "Does the paralysis show up on things with no deadline and no consequence — a hobby you've been meaning to start? If yes, deadline dread isn't the mechanism.",
        "Does a silent other person in the room, or on a video call, reliably unlock a task that four hours alone will not?",
        "Is it starting specifically, or also continuing? Note whether, once you're twenty minutes in, it flows or stays effortful.",
        "Is anything else flat — food, sleep, interest in people, enjoying things you used to? That points somewhere different from initiation alone.",
      ],
      questionsToAsk: [
        "\"I get stuck before starting rather than losing focus during — is that a distinction worth exploring?\"",
        "\"This has been there a long time but got much worse when my job removed all its structure. Does that pattern mean anything?\"",
        "\"Can we rule out the ordinary physical causes of low drive — sleep, thyroid, iron — before we go further?\"",
        "\"What would an assessment actually change for me in practice?\"",
      ],
      smallSteps: [
        "Shrink the definition of starting until it's almost silly: open the file and type one line. The bar should be low enough that a tired person clears it.",
        "Try one session with another person present — silent, on a call, doing their own thing. Notice the difference rather than just hoping it helps.",
        "Write down the start time when you sit down. Not to judge it; the four hours are much easier to reason about once they're a number rather than a feeling.",
      ],
      whatThisCannotTell: [
        "Whether you have any diagnosable condition. Nothing here is an assessment, and a panel that has read four sentences is not in a position to know.",
        "What your mood has actually been doing. Low mood and initiation problems look identical from the outside and you'd need someone to ask properly.",
        "Whether anything physical is contributing — sleep, thyroid, iron and B12 all produce this picture and none of them can be sorted out from text.",
      ],
    },
    clinical: {
      reasonForContact:
        "Longstanding difficulty initiating tasks, reported as markedly worse over the past year, now affecting work output.",
      history: [
        "Reports the pattern since school; describes it as constant rather than episodic.",
        "Marked worsening reported after moving to fully remote work approximately one year ago.",
        "No prior assessment, treatment, or contact with services reported.",
      ],
      functionalImpact: [
        "Reports losing up to four hours before starting work with a deadline the following day.",
        "Describes marked self-criticism during these periods; distress appears to compound the delay.",
      ],
      triedAlready: [],
      areasToExplore: [
        {
          area: "Task initiation versus sustained attention, longstanding",
          whyRaised:
            "Patient locates the difficulty at starting rather than at continuing once underway.",
          discriminators: [
            "Whether difficulty persists once a task is underway or resolves after the first few minutes.",
            "Whether the pattern appears with low-stakes and enjoyable tasks as well as obligations.",
          ],
        },
        {
          area: "Dependence on external structure",
          whyRaised: "Reported deterioration coincides with removal of workplace structure.",
          discriminators: [
            "Whether working alongside others, in person or on video, restores function.",
            "Whether the change also reduced social contact, exercise, or routine.",
          ],
        },
        {
          area: "Mood, energy, and sleep across the same period",
          whyRaised:
            "Timing overlaps with an isolating change; not screened for anywhere in the account.",
          discriminators: [
            "Anhedonia, appetite, diurnal variation, and sleep over the last twelve months.",
          ],
        },
        {
          area: "Reliability of retrospective childhood account",
          whyRaised:
            "Panel noted that recall of school-age difficulty is shaped by a currently held explanation.",
          discriminators: [
            "Contemporaneous evidence such as school reports, or an account from a parent.",
          ],
        },
      ],
      worthExcluding: [
        "Sleep quality and duration, given the reported timing.",
        "Ferritin, B12, thyroid function, if not checked recently.",
      ],
      whatTheyreAskingFor: [
        "An explanation for a pattern they describe as lifelong.",
        "Inferred, not stated: to be taken seriously rather than advised to try harder.",
      ],
    },
  },

  {
    slug: "worry-loops",
    question:
      "My brain loops on the same worry for hours. I know it's irrational while it's happening, which somehow makes it worse. I end up googling the same thing over and over for reassurance and I feel fine for about ten minutes afterwards.",
    about: "me",
    panel: {
      framing:
        "Why a worry you already know is irrational keeps looping, and why reassurance only holds for ten minutes.",
      seated: [
        {
          id: "skills-coach",
          reason: "You've described a loop with a clear reassurance step, which is unusually easy to work with.",
        },
        {
          id: "clinician",
          reason: "The knowing-it's-irrational part narrows the possibilities considerably.",
        },
        {
          id: "acceptance-guide",
          reason: "There's a question here about what the fight with the thought is costing you.",
        },
        {
          id: "been-there",
          reason: "The ten minutes of relief is the detail someone who's lived this will recognise instantly.",
        },
      ],
      notSeated: [
        { id: "practical", reason: "Nothing you asked turns on cost or waiting lists yet." },
        {
          id: "body-doctor",
          reason: "Nothing in what you wrote points at a physical cause worth chasing first.",
        },
        { id: "beside-you", reason: "You've described this from the inside, not as someone watching it." },
      ],
    },
    takes: [
      {
        voiceId: "skills-coach",
        text: "You have handed me an unusually clean loop, so let me just name its parts. Trigger, then the spike, then the googling, then ten minutes of relief, then the spike returns — usually a little sooner and a little louder than before.\n\nThat ten minutes is the mechanism. Relief that fast and that short is the signature of a behaviour that soothes in the moment and strengthens the thing it soothed. Every search teaches the worry that it was worth having, because look, you took it seriously enough to check. The searching isn't a symptom sitting alongside the loop. It is the loop's power supply.\n\nSo the experiment isn't to stop worrying, which nobody can do on command. It's to delay one search by ten minutes and write down what the distress does. Most people expect it to climb forever and find it peaks and drops on its own. That's information you can't get by thinking about it.",
      },
      {
        voiceId: "clinician",
        text: "\"I know it's irrational while it's happening\" is doing a lot of work. It means insight is intact, which rules out a fair amount and points toward a family of difficulties where the person can see the thought clearly and still can't put it down.\n\nThe piece I'd want to separate is what the worry is *about*. Free-floating worry that roams from topic to topic behaves differently from a worry that fixes on one theme and demands certainty about it — and the difference isn't cosmetic, because the second responds to a fairly specific approach that the first doesn't.\n\nThe reassurance-seeking with a short half-life leans towards the second, but I'm reading four lines. What would make me wrong: if the worry topic changes week to week and the googling is incidental rather than compulsive, this is a different animal and I'd want to say so.",
      },
      {
        voiceId: "acceptance-guide",
        text: "Notice what the ten minutes actually buys you: not an answer, just a brief silence. You've been paying in hours to rent quiet by the minute.\n\nThe thing I'd have you look at isn't the worry, it's the fight. Knowing a thought is irrational and still arguing with it is a full-time job, and it's an unwinnable one — you cannot reason your way to certainty about something the mind will simply raise again in a slightly different form. Meanwhile the hours go somewhere, and it's usually taken out of things you actually care about.\n\nSo the question is what this is costing rather than what it means. If the loop stayed exactly as loud but stopped deciding how your evening goes, would that be enough? For a lot of people that turns out to be a better target than silence, and, unlike silence, it's reachable.",
      },
      {
        voiceId: "been-there",
        text: "Ten minutes. That's about right, and the specificity of it is what tells me you've been counting.\n\nWhat nobody warns you about is the second search. The first one is for information. The second is because the first answer wasn't phrased in quite the right way, and now you need one that addresses your exact case, and the internet will always produce one more page. Somewhere in there it stops being about the answer and becomes about the feeling of having checked — and you can tell, because finding the reassuring page doesn't satisfy you, it just resets the clock.\n\nThe part I'd push back on in my own head, back then: knowing it's irrational felt like it should be enough, and when it wasn't, that became its own evidence that something was badly wrong with me. It isn't. That gap between knowing and feeling is the ordinary shape of this thing, not a personal failure.",
      },
    ],
    challenges: [
      {
        voiceId: "acceptance-guide",
        targetId: "skills-coach",
        text: "Your loop diagram is right and the delay experiment is worth doing. What I'd question is the frame underneath it — you've made the goal \"less worry\", and for someone who has spent years trying to win against their own mind, that can quietly become one more thing to fail at. Delay the search, yes. But measure whether the evening went where they wanted it to, not whether the distress dropped. That's the difference between a tool and a new front in the same war.",
      },
      {
        voiceId: "skills-coach",
        targetId: "acceptance-guide",
        text: "Fair, and I'll take the reframe about what to measure. But I'd resist making this only about the relationship with the thought when there is a specific behaviour with a ten-minute half-life sitting right there. Reassurance-seeking is unusually responsive to being interrupted, and someone can get real relief in weeks rather than through a longer reorientation. Both, in order: interrupt the loop first, and hold the values question for what's left afterwards.",
      },
      {
        voiceId: "clinician",
        targetId: "been-there",
        text: "The second-search observation is sharper than anything in my own take, and I'd fold it in. Where I'd add a caution: you're describing this as one recognisable thing, and it may well be — but the same loop appears in several different difficulties, and the useful next step depends on which. Your own detail is the discriminator. Whether the searching is about *this specific fear* or roams with whatever's worrying them that week is the fork in the road.",
      },
    ],
    synthesis: {
      headline: "The searching isn't a symptom of the loop. It's what keeps it running.",
      plainSummary:
        "All four voices landed on the same mechanism: the ten minutes of relief you get from googling is short enough to be diagnostic. Relief that fast and that brief tends to reinforce the very thing it soothes, so each search makes the next spike a bit more likely. Knowing the worry is irrational doesn't help, and nobody here thought that meant anything was wrong with you — the gap between knowing and feeling is the ordinary shape of this.\n\nOne thing to hold in mind: these voices are all produced by the same underlying AI model. Four of them agreeing is not the same as four independent people agreeing — they can be confidently wrong in the same direction. Use the agreements as a starting point for what to notice, not as a verdict.",
      agreements: [
        {
          point: "The ten-minute relief is the key detail",
          detail:
            "Every voice treated the short half-life of reassurance as the most informative thing you described, not an aside.",
          voices: ["skills-coach", "clinician", "acceptance-guide", "been-there"],
        },
        {
          point: "Knowing it's irrational is not a failure",
          detail:
            "Insight staying intact while the feeling persists is the expected shape here, and it rules some things out rather than indicting you.",
          voices: ["clinician", "been-there"],
        },
        {
          point: "Something checkable can start this week",
          detail:
            "Delaying one search and watching what the distress actually does gives you information that thinking about it cannot.",
          voices: ["skills-coach", "acceptance-guide"],
        },
      ],
      disagreements: [
        {
          topic: "Aim at the loop, or at the fight with it?",
          sideA: {
            voices: ["skills-coach"],
            position:
              "Interrupt the reassurance behaviour first. It's specific, it responds quickly, and relief in weeks is realistic.",
          },
          sideB: {
            voices: ["acceptance-guide"],
            position:
              "Target the cost, not the volume. Making 'less worry' the goal can become one more thing to fail at for someone already fighting their own mind.",
          },
          whatWouldSettleIt:
            "Try the delay for two weeks, but measure the right thing: whether your evening went where you wanted it to, not whether the distress dropped. If the loop quietens but the evenings don't change, the second reading was right.",
        },
        {
          topic: "Is this one thing, or a shape several things share?",
          sideA: {
            voices: ["clinician"],
            position:
              "The same loop appears in more than one difficulty, and which one changes what actually helps.",
          },
          sideB: {
            voices: ["been-there"],
            position:
              "It's recognisable enough to name, and being told 'it could be several things' delays people for years.",
          },
          whatWouldSettleIt:
            "Whether the worry fixes on one theme and demands certainty about that theme, or roams to whatever's worrying you that week. Track the topic for a fortnight — it's a two-word note each day.",
        },
      ],
      waysToTellApart: [
        "Does the worry stay on one theme, or roam to whatever's live that week? Two words a day in a note is enough to see it.",
        "When you find a genuinely reassuring page, are you satisfied — or does it just reset the clock and you need a better-worded one?",
        "If you delay a search by ten minutes, does the distress keep climbing, or peak and start dropping on its own?",
        "Is the searching about certainty, or about the feeling of having checked? Notice which one stops you.",
      ],
      questionsToAsk: [
        "\"I get short-lived relief from reassurance-seeking and then it comes back stronger — is that pattern meaningful?\"",
        "\"My worry fixes on one theme and demands certainty. Does that change what approach would suit me?\"",
        "\"Is there a specific therapy for reassurance-seeking, rather than general talking therapy?\"",
      ],
      smallSteps: [
        "Delay one search by ten minutes. Once. Write down what the distress did, on a 0–10 scale, at the start and the end.",
        "Note the worry's topic each day in two words. You're looking for whether it's one theme or many.",
        "Pick one thing the loop has been taking evenings from, and do fifteen minutes of it with the worry still present rather than waiting for it to go quiet.",
      ],
      whatThisCannotTell: [
        "Which specific difficulty this is. Several produce this exact loop, and telling them apart takes someone asking you questions in both directions.",
        "How long you've been carrying it or what it's already cost you, both of which change what's worth doing next.",
        "Whether anything else is going on alongside it. Loops like this often travel with company, and four lines won't show that.",
      ],
    },
    clinical: {
      reasonForContact:
        "Repetitive worry with insight preserved, maintained by reassurance-seeking; reports hours lost per episode.",
      history: [
        "Reports looping on the same worry for hours at a time; duration of the overall pattern not stated.",
        "Describes recognising the worry as irrational while it is happening.",
        "No prior assessment or treatment reported.",
      ],
      functionalImpact: [
        "Reports hours consumed per episode.",
        "Describes repeated internet searching for reassurance, with relief lasting approximately ten minutes.",
      ],
      triedAlready: [
        "Self-directed reassurance-seeking via internet searching, described as unhelpful beyond the short term.",
      ],
      areasToExplore: [
        {
          area: "Reassurance-seeking as a maintaining behaviour",
          whyRaised:
            "Patient reports relief of roughly ten minutes followed by return of distress; panel treated the short half-life as the central feature.",
          discriminators: [
            "Whether finding a reassuring answer satisfies, or resets the search.",
            "What distress does when a search is deliberately delayed.",
          ],
        },
        {
          area: "Fixed-theme versus roaming worry content",
          whyRaised:
            "Distinguishes two patterns that respond to different approaches; not established in the account.",
          discriminators: [
            "Whether the worry fixes on one theme and demands certainty, or moves with whatever is current.",
          ],
        },
        {
          area: "Intact insight alongside persistent distress",
          whyRaised:
            "Patient explicitly reports knowing the worry is irrational, and reports this makes it worse.",
          discriminators: [
            "Whether the knowing-feeling gap is itself a source of shame the patient has not raised.",
          ],
        },
      ],
      worthExcluding: [],
      whatTheyreAskingFor: [
        "An explanation for why insight does not reduce the distress.",
        "Inferred, not stated: a specific approach rather than general talking therapy.",
      ],
    },
  },

  {
    slug: "social-exhaustion",
    question:
      "After any social thing — even a good one with people I love — I'm wiped out for a day or two. Not sad, just completely empty. Everyone says I'm outgoing and I don't think they'd believe how much it costs me.",
    about: "me",
    panel: {
      framing:
        "Why socialising you genuinely enjoy leaves you flattened for a day or two, and why nobody around you can see it.",
      seated: [
        {
          id: "neurodivergence",
          reason: "The gap between how you seem and what it costs is the centre of what you wrote.",
        },
        {
          id: "body-doctor",
          reason: "A one-to-two-day recovery is a long time, and that's worth taking literally.",
        },
        {
          id: "overlooked",
          reason: "People who present well are routinely told there's nothing to look into.",
        },
        {
          id: "acceptance-guide",
          reason: "There's a question here about what you'd change even if the cost is real and permanent.",
        },
      ],
      notSeated: [
        { id: "skills-coach", reason: "Nothing here reads as a loop to interrupt yet." },
        {
          id: "careful-skeptic",
          reason: "Seated on most panels, but the skeptical read here is mostly 'you might just be an introvert', which the others already cover.",
        },
        { id: "growing-up", reason: "You're describing yourself as an adult." },
      ],
    },
    takes: [
      {
        voiceId: "neurodivergence",
        text: "\"Everyone says I'm outgoing\" and \"they wouldn't believe how much it costs me\" are the same sentence from two sides, and the gap between them has a name in some circles: doing the performance well is exactly what stops anyone noticing the price.\n\nThe detail I'd hold onto is that it happens after good events with people you love. That rules out dislike and rules out anxiety about the people themselves. What's left is the running cost of the doing — tracking faces, managing volume and light and overlapping conversation, monitoring your own output. That work is invisible to everyone including, often, the person doing it, right up until it stops and the bill arrives.\n\nWhat would make me wrong: if the flattening also follows a long day alone at a screen, then this isn't specifically social and I'm reading the wrong variable.",
      },
      {
        voiceId: "body-doctor",
        text: "A day or two is a long recovery, and I'd rather take that literally than treat it as a figure of speech before anything else is checked.\n\nDisproportionate exhaustion after ordinary exertion, lasting more than a day, is a pattern with several dull physical causes that are cheap to rule out: iron and ferritin, B12, thyroid, vitamin D, and whether you're actually sleeping rather than just in bed for eight hours. Post-viral fatigue does this too, sometimes long after the illness is forgotten. So does sleep apnoea in people who'd never suspect it.\n\nNone of that contradicts the social explanation — you could have both, and honestly the combination is common. But it's much easier to interpret the social pattern once you know your bloods are unremarkable, and the tests are ordinary ones a GP orders without argument. A normal result isn't nothing; it moves the question along.",
      },
      {
        voiceId: "overlooked",
        text: "I want to sit with one line: you don't think they'd believe you.\n\nThat instinct is usually well-calibrated, and it's the reason people in your position wait years. Presenting well is treated as evidence that nothing is happening — you were fine at the party, you're articulate in the appointment, you managed to book it and turn up. The cost is invisible by construction, because the whole skill is making it invisible.\n\nThis gets missed most in women, in people who did well academically, and in anyone whose difficulty shows up in recovery rather than in performance. Nobody is present for the recovery.\n\nSo if you do raise it, don't describe the event. Describe the two days. \"I was fine at the dinner and then I couldn't work on Monday\" is the sentence that gets attention, because it's about function, and function is what gets taken seriously. I'd add: don't manufacture a story where there isn't one — but yours has the shape.",
      },
      {
        voiceId: "acceptance-guide",
        text: "Suppose the cost is real, and suppose it doesn't fully go away. What then?\n\nI ask because there's a version of this where you spend a year finding out why, and the practical question — how much of your life do you want to spend recovering — sits untouched the whole time. Those are separate questions and only one of them is waiting on an answer from anyone else.\n\nYou said even good events with people you love. That's worth taking seriously in both directions: the cost is real, and so is the fact that you keep choosing it. Nobody pays that twice for nothing. So the thing I'd look at is the shape of it — whether three shorter evenings cost less than one long one, whether the recovery is shorter when you go in rested, whether it's the event or the week around it.\n\nNot to optimise you. To find out whether the price is negotiable before you accept the whole bill.",
      },
    ],
    challenges: [
      {
        voiceId: "overlooked",
        targetId: "body-doctor",
        text: "I don't disagree with the bloods and I'd want them done. But I've watched \"let's rule out the physical first\" become a five-year detour, because normal results end the conversation instead of advancing it. Order them, and in the same appointment describe the two days of lost function. If you only bring the tiredness, you'll get a blood form and a follow-up that never happens. Both in one visit, or the second thing never gets said.",
      },
      {
        voiceId: "body-doctor",
        targetId: "neurodivergence",
        text: "Your account is coherent and probably part of it. My worry is that it explains the two days a little too comfortably — social load explains the emptiness on the night, but a recovery running into a second day is a lot of exertion for a good dinner. That's the bit I don't think you've accounted for. If ferritin came back low, the second day would suddenly make more sense, and both readings could still be true.",
      },
      {
        voiceId: "acceptance-guide",
        targetId: "overlooked",
        text: "The advice about describing function rather than the event is the most useful sentence on this panel, and I'd not change it. What I'd add is that being believed is not itself the goal — it's a gate to something, and it's worth knowing what. If the honest answer is that a name would change how they treat themselves on the second day, that's a real reason. But that particular change doesn't actually require anyone else's permission, and it's available now.",
      },
    ],
    synthesis: {
      headline: "The cost is probably real and probably invisible — but two days is worth checking properly.",
      plainSummary:
        "The panel converged on one thing quickly: the fact that this happens after good events with people you love rules out a lot, and points at the running cost of the doing rather than anything about the people. Where they pulled apart is whether social load alone explains a recovery that stretches into a second day, or whether something ordinary and physical is stacked underneath it.\n\nWorth knowing: all four of these voices are generated by the same underlying AI model. When they agree, that's a much weaker signal than four independent people agreeing, because they tend to share the same assumptions. Take the agreements as a place to start looking rather than as a conclusion.",
      agreements: [
        {
          point: "That it happens after good events is informative",
          detail:
            "It rules out dislike of the people and anxiety about them, which narrows things considerably.",
          voices: ["neurodivergence", "body-doctor", "acceptance-guide"],
        },
        {
          point: "Presenting well is why nobody sees it",
          detail:
            "The skill that makes the evening go smoothly is the same skill that hides what it costs — including, sometimes, from you.",
          voices: ["neurodivergence", "overlooked"],
        },
        {
          point: "Describe the lost function, not the tiredness",
          detail:
            "\"I was fine at dinner and couldn't work on Monday\" is the sentence that gets taken seriously in an appointment.",
          voices: ["overlooked", "body-doctor"],
        },
      ],
      disagreements: [
        {
          topic: "Does social load alone explain two days?",
          sideA: {
            voices: ["neurodivergence"],
            position:
              "Yes — the running cost of tracking, masking, and managing sensory load is far higher than it looks, and the bill arrives after it stops.",
          },
          sideB: {
            voices: ["body-doctor"],
            position:
              "A recovery running into a second day is a lot of exertion for a good dinner. Something physical may be stacked underneath.",
          },
          whatWouldSettleIt:
            "Whether the same flattening follows a long solitary day — a full day of screen work, or a long drive alone. If it does, this isn't specifically social. And a basic blood panel, which either narrows it or doesn't.",
        },
        {
          topic: "Rule out the physical first, or say both things at once?",
          sideA: {
            voices: ["body-doctor"],
            position:
              "Get the ordinary causes checked first. The social pattern is much easier to interpret once bloods are unremarkable.",
          },
          sideB: {
            voices: ["overlooked"],
            position:
              "'Physical first' becomes a five-year detour when normal results end the conversation instead of advancing it.",
          },
          whatWouldSettleIt:
            "Not really a factual disagreement — it's about sequencing, and you can take both: ask for the bloods and describe the two lost days in the same appointment.",
        },
      ],
      waysToTellApart: [
        "Does a long day alone — screen work, a solo drive, a day of admin — produce the same flattening? That separates social load from general fatigue.",
        "Does three short evenings cost less than one long one? If yes, duration is the variable and that's useful.",
        "Is the recovery shorter when you went in rested and well-fed? If it barely changes, that argues against simple depletion.",
        "Does it happen after quiet one-to-one time with someone you love, or only in groups and noise? Sensory load and social load come apart there.",
      ],
      questionsToAsk: [
        "\"I'm fine at the event and then lose a day or two of function afterwards. Can we look at that pattern rather than the tiredness?\"",
        "\"Can we check ferritin, B12, thyroid and vitamin D, and talk about sleep quality rather than sleep hours?\"",
        "\"I mask well and I think that's why this hasn't been looked at. Does that change what's worth exploring?\"",
      ],
      smallSteps: [
        "Keep a two-line note after each social thing: how long it lasted, how many people, and how many days until you felt normal. Three or four entries and the pattern usually shows itself.",
        "Try one deliberately shorter version of something you'd normally do at full length, and note the recovery.",
        "Book the blood test. It's the one thing on this list that doesn't depend on you being believed first.",
      ],
      whatThisCannotTell: [
        "Whether this is autistic burnout, an energy-limiting condition, ordinary introversion, or something else. Those need someone asking you questions in both directions, over time.",
        "What your bloods say. Several unremarkable physical causes produce exactly this and none of them can be sorted out from a paragraph.",
        "How much of the cost is the event and how much is the anticipation and the week around it, which you'd only see by tracking it.",
      ],
    },
    clinical: {
      reasonForContact:
        "Disproportionate post-social fatigue lasting one to two days, following events the patient reports enjoying.",
      history: [
        "Reports one to two days of recovery after any social event, including welcome ones with familiar people.",
        "Describes the state as emptiness rather than low mood.",
        "Duration of the overall pattern not stated. No prior investigation reported.",
      ],
      functionalImpact: [
        "Reports being unable to function for one to two days following social contact.",
        "Reports presenting as outgoing during events, with the cost invisible to others.",
      ],
      triedAlready: [],
      areasToExplore: [
        {
          area: "Recovery time disproportionate to exertion",
          whyRaised:
            "A one-to-two-day recovery after an ordinary social evening was the detail the panel could not account for on effort alone.",
          discriminators: [
            "Whether comparable fatigue follows a long solitary day of similar duration.",
            "Whether recovery shortens when the patient goes in rested.",
          ],
        },
        {
          area: "Effortful social performance and its delayed cost",
          whyRaised:
            "Patient reports being perceived as outgoing while describing a cost others do not see.",
          discriminators: [
            "Whether cost scales with duration, group size, or sensory load rather than with enjoyment.",
            "Whether quiet one-to-one contact produces the same recovery period.",
          ],
        },
        {
          area: "Presentation quality obscuring functional impairment",
          whyRaised:
            "Patient anticipates not being believed; panel noted this pattern is commonly missed where someone presents well.",
          discriminators: [
            "Function in the days after an event, rather than observed presentation during one.",
          ],
        },
      ],
      worthExcluding: [
        "Ferritin, B12, thyroid function, vitamin D.",
        "Sleep quality as distinct from time in bed; consider screening for sleep-disordered breathing.",
        "Post-viral fatigue, if there was an illness preceding onset.",
      ],
      whatTheyreAskingFor: [
        "For the recovery period, rather than the tiredness, to be the thing that is assessed.",
        "Inferred, not stated: to be believed despite presenting well.",
      ],
    },
  },
];

export function demoBySlug(slug: string): DemoDebate | undefined {
  return DEMOS.find((d) => d.slug === slug);
}
