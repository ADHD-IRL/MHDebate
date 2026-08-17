# MHDebate

A panel of perspectives that argues about your question in plain language, so you can think about
it more clearly. It does not diagnose, and it is not care.

You describe something you're trying to understand. Four to six voices answer **independently**,
then read each other and **push back**, then a summary shows where they agreed, where they
didn't, and what you could notice that would settle it.

```
npm install
cp .env.example .env.local     # optional — see "Running without a key"
npm run dev                    # http://localhost:3000
```

---

## What this is, and what it came from

This is a consumer translation of **Panel Room**, a clinician-facing panel-review system: sixty-three
subject-matter agents convened per case, the independent first pass hash-sealed before
cross-examination, eighteen deterministic validators gating release, and a veracity scorer applying
the survey-sampling design effect to discount correlated error between agents.

That system is built for a licensed clinician reviewing a case file. This one is built for a person
at 1am trying to work out why they can't start anything. The translation kept every property that
protects the reader and dropped everything that only makes sense inside a clinic.

| Panel Room (clinician) | MHDebate (consumer) |
|---|---|
| 63 SME agents, `.claude/agents/*.md` | 14 plain-language voices, each mapped back to the source roles |
| `/convene` writes a charter with `not_seated_notable` | "Who's in the room", including who was left out and why |
| Round 2 sealed with a SHA-256 manifest before round 3 | First takes run in parallel requests; no voice sees another |
| Dissent register; empty register fails validation | "Where they didn't agree", never collapsed to look tidy |
| `deff = 1 + (m-1)ρ`, effective sample size, veracity bands | A plain count plus one honest sentence about why agreement here is weak |
| `PROVENANCE:` blocks typed `case`/`recall`/`inference` | Voices say in passing when they're working from general knowledge |
| Preflight hook halts the run on crisis language | Four-level screen: halt, resources-then-choose, care note, or proceed |
| Supabase with RLS, run records, auth | Nothing stored. No account, no database, no server-side log |

The source roster ships at `data/registry.json`. Every voice in `lib/voices.ts` lists which of the
original sixty-three roles it stands in for, and `/voices` shows that mapping in the UI.

### The one thing the original got wrong for consumers

Panel Room's `preflight_risk.py` halts on any match against a broad regex list — `suicid`, `abuse`,
`hallucinat`, `not eating`. Its own install checklist admits the problem: *"The preflight gate halts
the run, it does not help anyone."*

For a clinician that's an acceptable routing step. For a public tool it fails in both directions: a
person in crisis gets a locked door, and a person trying to understand a relative's diagnosis gets
treated as an emergency. So `lib/safety.ts` grades instead:

- **crisis** — explicit current intent, plan, or means. Resources only, no bypass.
- **concern** — the subject is present without stated intent. Resources first, then an informed
  choice to continue.
- **sensitive** — a serious topic that earns a care note *alongside* the debate.
- **clear** — proceed.

First-person and third-person route the same way, because the reader needs help either way. The
screen runs in the browser on every keystroke and again on the server, where it can't be skipped.

---

## Running without a key

With no `ANTHROPIC_API_KEY` the app serves three debates that were written out in full, replayed at
the pace a live panel runs at. It will **not** answer your own question in this mode — putting your
words at the top of a canned panel would misrepresent what you were reading — so the form is
replaced by the three examples.

This is also how to demo it to someone without spending anything.

## Running live

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local
npm run dev
```

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Unset means demo mode. |
| `ANTHROPIC_MODEL` | `claude-opus-5` | A full debate is ~12 model calls; a smaller model is a reasonable trade for volume. |
| `MHDEBATE_RATE_LIMIT` | `12` | Debates per IP per hour, in-process. `0` disables. |

Model details: adaptive thinking with `effort: "low"` for the voice turns and `"medium"` for the
summary; structured outputs for panel selection, pairing, and synthesis; prose streamed token by
token for the takes and the cross-talk. Server-side refusal fallbacks are on by default
(`server-side-fallback-2026-07-01`) because mental-health text sits close enough to the safety
classifiers that a reader would otherwise hit an unexplained dead end; if the deployment rejects the
beta, `lib/anthropic.ts` retries without it.

---

## How a debate runs

```
question
   ↓  safety screen (client, then server — nothing reaches the model on a crisis match)
   ↓  convene       structured · picks 4–6 voices from the question, records the exclusions
   ↓  first takes   N parallel streams · separate contexts, no voice sees another
   ↓  pairing       structured · finds the real tensions between what they actually wrote
   ↓  cross-talk    parallel streams · each push-back must name something you could check
   ↓  synthesis     structured · agreements, unresolved disagreements, what to notice, what to ask
```

Everything reaches the browser over SSE as it happens (`app/api/panel/route.ts`), so the page fills
in progressively rather than blocking on the slowest voice.

Degradation is deliberate: a voice that fails is dropped with a visible notice and the panel carries
on; a failed pairing step skips cross-talk but still produces a summary; fewer than two surviving
voices aborts rather than staging a fake debate.

## Layout

```
app/            pages and the SSE route
components/     UI, all presentational except Panel/AskForm
lib/
  voices.ts     the 14 voices, their lenses, their blind spots, their source roles
  safety.ts     the four-level screen and the support directory
  engine.ts     prompts, JSON schemas, normalisation, orchestration
  anthropic.ts  the only file that talks to the model
  demo.ts       the three written examples
data/           the source 63-agent registry, kept for provenance
tests/          42 tests, no network
```

## Tests

```
npm test        # vitest — safety screen, normalisation, orchestration, examples
npm run typecheck
npm run build
```

`tests/runPanel.test.ts` stubs the model layer and asserts the properties that would otherwise fail
silently: that the first takes really do run in parallel, that a crisis question reaches no model
call at all, that one dead voice doesn't sink the run, and that four dead voices do.

**Not yet verified against the live API.** The environment this was built in had no API key, so the
model path has been typechecked against the SDK's request types and exercised through stubs, but no
real debate has been run end to end. Do that first if you pick this up.

## Deliberate limits

- No diagnosis, ever. Voices describe what a pattern can come from and what separates the
  possibilities; they are instructed never to land on a label for the reader.
- No medication talk of any kind — naming, dosing, starting, stopping.
- Nothing is stored. Close the tab and it's gone, including from the page.
- Agreement is reported as a plain count, never a confidence score. A decimal point would imply a
  precision that does not exist when every voice comes from one model.

## Licence

MIT. See `LICENSE`.
