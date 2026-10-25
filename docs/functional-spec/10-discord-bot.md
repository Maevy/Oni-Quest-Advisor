# Discord bot — Chiyo-Bot

Chiyo-Bot is the app's presence in the community Discord. A player pastes an army code, the bot
answers with a card describing that list, and the card carries a button that opens the same list in
the app on their phone. It exists for one reason: **so nobody has to screenshot their phone to show
a list on Discord.**

> **Built, not yet live.** Phases 1–3 are implemented and committed: the sheet, the interactions
> endpoint, the card, and the `?army=<code>` deep link. Nothing has happened on Discord's side yet —
> the two secrets, the Interactions Endpoint URL, the command registration and a first pass against
> a real server — so no player can reach it. The hosting model, the output format, the command
> surface and the cold-start behaviour are all decided (see _Architecture decisions_); what is
> genuinely undecided — above all whether the bot ever posts a rendered image — is listed under
> **Open questions** at the end.

## The shape of the feature

1. **Paste a code** — a player runs the slash command in any channel the bot can see, with an army
   code as its argument.
2. **Read the card** — the bot answers with a Discord embed: the list's faction, its format, its
   point total against the format's cap, and the units, one line per unit rather than one per copy.
3. **Open it** — the card's button deep-links into the app with the list already loaded, so a phone
   shows the real Army Builder view instead of a picture of it.
4. **Render it** — _deferred._ A picture of the card as the builder draws it. See _Deferred_.

## The player's view

### Invoking it

`/army code:<paste>`. Discord command names are lowercase and cannot carry the bot's name, so the
invocation is not `--list`-style: the bot is **Chiyo-Bot** as an application and a member, and
`/army` is the command it registers. The code is the command's single required option, which means
Discord itself enforces "you must give me a code" and the bot never has to answer a bare mention
with a usage lecture.

Replying to a mention, or noticing a code pasted with no command at all, is **not** in this
iteration — it needs the gateway and the privileged message-content intent, and therefore an
always-on process. See _Architecture decisions_.

### What comes back

One embed, in the channel the command was run in:

- **Title** — the list's faction name.
- **Colour stripe** — the faction's own accent, so two lists in one thread are distinguishable at a
  glance. `ArmyFactionConfig.color` already carries it as a hex string (each army faction's dominant
  RAL Classic colour), which is exactly the integer an embed wants — no new palette.
- **Thumbnail** — the faction's logo, from the same config's `logo`. Vite gives that as a
  root-relative, per-deploy hashed asset URL, so it is prefixed with the app's `ORIGIN` at send
  time.
- **Header line** — format (**Standard** / **Roster**) and the point total against that format's cap
  (`81/85`, `120/125`).
- **Body** — the units. Copies of the same unit are **collapsed into one line** (`3× Bonewalker`)
  because a 125-point Roster list can be thirty rows and Discord caps a description at 4096
  characters. Each line carries its per-copy cost, its mount when mounted, and the upgrades picked
  onto it by name.
- **Roster equipment pool** — for a Roster list, the shared upgrades and their quantities as their
  own block, since they belong to no single unit.
- **Footer** — Chiyo's voice, plus the roster fingerprint the code was read against.
- **Button** — _Open in Army Builder_, the deep link.

The persona, the footer text and the wording of every message the bot sends are the maintainer's to
write — they are community-facing voice, not implementation detail. They live in one module so they
can be rewritten without touching logic.

### When it goes wrong

Every failure is a _message_, never a stack trace and never silence:

- **Not a code.** `That doesn't look like an army code.` Nothing is logged beyond the fact.
- **A code from older content.** The fingerprint no longer matches, which happens on every content
  re-import. This is the message that matters most, because a whole Discord will hit it at once the
  day the units change: _"That list was built against an older roster — re-export it from the app."_
- **A list too long for one card.** Truncated at a fixed line budget with a closing
  `…and 4 more — full list ↗` pointing at the deep link. The rule is deterministic and tested, not
  an accident of whatever fit.
- **The app is cold.** Deferred, so a slow decode or a busy machine cannot time the interaction out.
  The residual case is the machine still booting when Discord calls: right after a deploy the first
  command may show _"The application did not respond"_. Warm wakes are 1–2 s and fit inside
  Discord's 3 s.

## Architecture decisions

Taken together these decide the shape of the work, and each was chosen over a concrete alternative.

- **The bot lives inside the existing app, not a new repo or a new service.** It is a route
  (`/api/discord/interactions`) plus two `lib/server` modules on the Fly app that already serves the
  game. Why: the bot's _only_ domain knowledge is the app's content shape, and a second repository
  would have to duplicate that shape and re-sync it on every content re-import. It also avoids
  standing up a new Fly app, whose first deploy on this org hits the known IP-provisioning failure.
  The module is self-contained, so lifting it into its own app later is a move, not a rewrite.
- **The app owns the content; the bot never carries a catalog.** An army code is base36 **indexes**
  into the sorted content catalogs, guarded by a 3-char fingerprint computed from every unit,
  upgrade, spellcraft and item id. A bot that shipped its own copy would silently decode into the
  wrong units the moment the two diverged. Instead the bot resolves the code in-process against the
  same content the app loaded, through the same path the app's own Army view uses
  (`decodeArmy` → `unitsForFaction` → `resolveArmyEntries` → one row per copy), so a card can never
  contradict the screen.
- **Discord's HTTP interactions endpoint, not a gateway connection.** The app runs with
  `min_machines_running = 0` and auto-stop; a websocket bot would be killed every idle period.
  Slash commands arrive as signed POSTs, and `auto_start_machines` wakes the machine to answer them.
  The cost of this choice is that mentions and free-form chat are out of reach until something is
  always-on.
- **Zero dependencies.** `npm install` is blocked on this machine, and the house pattern is already
  to hand-roll rather than depend (`domain/pdf.ts`, `domain/qr.ts`). A Discord interactions bot
  needs nothing else: Node 22's `crypto` verifies Ed25519 signatures, global `fetch` talks to
  Discord, global `FormData`/`Blob` would post an attachment. The follow-up call is authenticated by
  the **interaction token itself**, so the running server needs only the public key and the
  application id — the bot token is used once, by the registration script, and stays out of the
  request path.
- **Defer, then follow up.** Discord allows 3 s to the first response. The handler answers
  `{type:5}` immediately and posts the card to the interaction webhook, so generation time is
  unconstrained.
- **The rate limiter must exempt this one path.** `hooks.server.ts` throttles every `POST /api/**`
  at 120/min **per client IP**, and every Discord interaction arrives from Discord's IPs — one
  shared bucket would throttle the entire bot, and one busy server would starve everyone else. The
  exemption is safe because the Ed25519 signature replaces the IP check as the authentication; an
  unverified POST is refused. The 64 KB body cap stays.

### Where the pieces sit

Following the layering rules — `routes/api → server → domain`, and `domain` importing nothing:

- `src/lib/domain/armySheet.ts` — pure. Code plus an `ArmyCodeCatalog` in, a sheet or a typed error
  out (`invalid` / `roster-mismatch`). Knows nothing about Discord. Colocated `armySheet.spec.ts`.
- `src/lib/server/armyCatalog.ts` — assembles the catalog the code indexes into by awaiting the
  existing `loadArmy*()` functions in `$lib/data`. Those are plain async `import.meta.glob` loaders
  with no browser APIs, so they run server-side unchanged; the result is memoized, the content being
  static. Lives in `server`, not `domain`, because `domain` may not import `data`.
- `src/lib/server/discord.ts` — signature verification over the **raw request bytes**, the command
  definition, the embed builder, the follow-up call, and every player-facing string.
- `src/routes/api/discord/interactions/+server.ts` — the thin handler: PING, verify, defer, sheet,
  follow up.
- `scripts/registerDiscordCommand.mjs` — one-off command registration, after the `importUnits.mjs`
  precedent.
- Deep link: `?army=<code>` handled on mount in `+page.svelte` → `armyBuilderStore.importArmy(code)`
  → the builder screen. That replays every pick through the domain guards, so **a deep-linked list
  can never be invalid**, and it reuses the paste-a-code path that shipped in v0.10.0.

## Rollout

Phase 1 needed nothing from Discord, which is why it landed on its own.

1. **The sheet** — _built._ `domain/armySheet.ts` and its spec, plus `getArmyCodeCatalog()` added to
   the existing `lib/server/content.ts` rather than a new file. No secrets, no deploy, no Discord
   account. It is also the seam any future image renderer or link-unfurl route would reuse.
2. **Discord plumbing** — _built._ `lib/server/discord.ts` holds the signature verification, the
   card, the follow-up call and every player-facing string; the route answers PING and defers a
   command; `hooks.server.ts` carries the rate-limit exemption; `scripts/registerDiscordCommand.mjs`
   registers `/chiyo army code:`. **Ordering constraint:** the developer portal validates the
   Interactions Endpoint URL by sending a live PING, so the PING handler must be deployed before the
   URL can be saved.
3. **The deep link** — _built._ `?army=<code>` on the single page: it consumes the param before
   awaiting anything, loads the lazy catalogs, replays the code through `importArmy` and opens the
   builder. It **outranks the resume chain**, because a click on _Open in Army Builder_ is a more
   explicit intent than a run left open — and it leaves that run untouched in storage, so it still
   resumes on the next plain launch. A code that will not resolve offers the builder's own paste
   field rather than a dead end.
4. **Discord-side wiring** — _outstanding, and the only thing between here and a player._ The two
   secrets on the staging app, the bot invited with the `bot` + `applications.commands` scopes, a
   deploy, then the endpoint URL, then command registration with `DISCORD_GUILD_ID` set so it is
   instant rather than up to an hour.

Development points at the staging app (`oni-quest-advisor-test.fly.dev`, which runs `develop`);
the endpoint URL switches to production at release.

## Verification

- **vitest** — _done, 11 tests._ The sheet against a real minted code, both decoder refusals, the
  collapse rules (identical copies merge, a mounted copy and a differing spellcraft choice do not,
  upgrade order does not split a line), a Roster list's equipment pool, line order, and parity with
  `armyPoints` + `rosterPickPoints` so the card cannot disagree with the builder's counter.
- **vitest for the signature check** — _done, 6 tests._ A real Ed25519 keypair generated inside the
  spec signs `timestamp + body`; the check accepts it and refuses a tampered body, a signature
  carried onto another timestamp, a stale replay and malformed keys. The security-critical piece is
  covered without Discord at all.
- **vitest for the card** — _done, 10 tests._ Colour, thumbnail absolutization, the unit lines, the
  roster field, the fingerprint footer, the encoded deep link, and truncation held under Discord's
  4096-character description limit at 400 rows.
- **A throwaway Edge harness** — _done, 22 assertions_ (`~/.qwen/tmp/oni-verify/deep-link.mjs`,
  outside the project root so the dev server does not full-page-reload every browser): a valid code
  reaching the builder with all four decoded units present and the param consumed, both decode
  failures showing their own wording, both dialog exits, and the deep link outranking a seeded
  open-game resume — with a control pass proving that same seed does prompt when the param is
  absent, so the negative assertion is not vacuous.
- **A signed interaction against the running dev server** — _not yet done._ Needs a self-generated
  keypair in the environment and a stubbed webhook listener, to assert the deferred response and the
  follow-up payload end to end.
- **Real Discord** only after a staging deploy — _not yet done._
- `npm run check`, `npm run lint`, `npm run test` as usual.

## Deferred

- **The image.** Nothing in this repo can rasterize text: there is no webfont anywhere in `src` (the
  UI is Tailwind's system stack), `pdf.ts` uses viewer-side Helvetica and embeds no glyph outlines,
  the production image is `node:22-slim` with dev dependencies stripped, and the machine has 256 MB
  — no headless Chromium. There is also no URL to screenshot: the app is a single-page screen
  switcher with four route files, so an army is not addressable today. Two viable paths, both
  larger than everything above combined — (a) a browser-side canvas on a new share route, where real
  fonts are free, offering a PNG download; or (b) a hand-rolled PNG encoder beside `pdf.ts`, which
  still needs a font asset we would have to supply and license. Decided: ship the text card first and
  choose with something real in front of us.
- **Mentions and free-form chat** — needs the gateway, the message-content intent and an always-on
  process.
- **Link unfurling** — an SSR'd `/army/[code]` page with `og:` tags would make a bare URL preview
  itself in Discord with no bot involved. Cheap, and it is the same route the image path would want.

## Open questions

- **Does the bot ever post an image?** The embed answers the screenshot problem, but not the "looks
  like the app" half of it. If it should, the choice is a browser-side canvas download (a human tap,
  no server rasterizer) or a hand-rolled PNG encoder plus a font asset. Open, deliberately, until
  the text card has been in front of players.
- **What exactly goes on a line?** Cost, mount, upgrades — and whether effective stats or size
  belong there too, or make the card noise. Depends on what a list discussion on Discord actually
  needs, which is a question for the community rather than for the code.
- **The truncation budget.** Where the line limit sits, and whether a truncated card should split
  across two messages or lean on the deep link alone.
- **Faction accents.** _Resolved 2026-10-25:_ no new palette is needed. `ArmyFactionConfig` already
  carries each army faction's dominant RAL Classic colour as a hex string and its logo as an asset
  URL (`data/armyFactions.ts`), which covers both the embed's colour stripe and its thumbnail. The
  seat colours in `components/playerAccent.ts` are a different thing entirely and stay out of it.
- **Should the fingerprint be player-visible?** The card's footer would carry it, and the app's
  share UI could too, so a player can tell a stale code from a mistyped one before asking. Open.
- **Always-on or not.** If "did not respond" after each deploy proves annoying in practice, the fix
  is `min_machines_running = 1` (roughly $2/month), which would also end cold starts for online
  games. Open until the bot has real traffic.
- **A public sheet endpoint.** `/api/army-sheet/[code]` is not needed while the bot runs in-process,
  but unfurling and any external tool would want it. Whether to expose one — and with what rate
  limit, since decoding is public and unauthenticated — is open.
- **Channel scope and abuse.** Whether the bot should answer in threads, and whether a server should
  be able to lock it to one channel. Discord's own rate limits bound the second half; the first is
  a permissions question nobody has asked yet.
