# Army Builder

A standalone list-building tool, separate from the mission flow. The player picks a faction and
builds an army under a format's point cap, inspecting every rule a unit carries along the way.

It is reached from the main menu's **Army Builder** button (violet) and **never enters the
mission flow** — it does not set a game mode, and nothing it builds is attached to a mission yet
(that is the Mission Briefing's disabled **Upload Army** button, still unbuilt).

The builder is **in-memory only**. Leaving it discards the list; army codes and saved armies are
the only persistence. Data formats, the import pipeline and code serialization are in
[../technical-spec/05-army-data-format.md](../technical-spec/05-army-data-format.md).

## Loading gate

Army content is lazy-loaded — it is far too large to ship in the initial bundle. Pressing Army
Builder starts `contentStore.loadArmy()`, and until it resolves the screen shows only
**"Loading army builder…"**. The faction select is unreachable before that, which is what lets the
army-code import keep a synchronous contract.

## Faction select

**← Back** (top-left) returns to the main menu. Headed **Army Builder** / _"Choose your
faction."_, then the **seven** factions in a three-column grid, each button bordered and labelled
in that faction's RAL colour over its logo.

Order and colours: Helian League, Coalition of Thenion, Sand Kingdoms, Empire of Soga, Oni
Clans, Goblin Wartribes, Adventurers' Guild.

Picking a faction resets the builder (format `standard`, empty list) and opens it.

> The **Adventurers' Guild has no exclusive units** — its generated faction file is empty and its
> whole pool comes from the neutral list, so its Available Units panel shows only neutrals. That
> is correct, not a load failure.

Below the grid:

- **Or import an army code** — an input (_"Paste the army code"_) and an **Import Army** button,
  disabled while the field is blank. Errors: **"This is not a valid army code."**, **"This code
  was created with a different roster version."**, and on an unexpected failure **"Import failed —
  please reload the app and try again."** Success opens the builder directly on the Your Army
  panel.
- **Load Army** — opens the saved-army dialog.

## Formats

Two formats, switched by tabs in the builder header:

| UI label     | Internal id  | Point cap | Upgrades                            |
| ------------ | ------------ | --------- | ----------------------------------- |
| **Standard** | `standard`   | 85        | per model, through slots            |
| **Roster**   | `tournament` | 125       | a shared **equipment pool** instead |

Switching with a non-empty list asks for confirmation — _"Switch to {Standard|Roster}? The
current list will be deleted."_ (**Yes** / **No**) — and then clears the units **and** the
equipment pool. The faction is kept. An empty list switches silently.

The **points badge** reads `{points}/{cap}`, green normally and red when over. "Over" is
_strictly_ greater, so sitting exactly on the cap stays green.

> **Nothing prevents exceeding the cap.** The badge turns red and the player may keep adding. That
> is deliberate — the app is a tracker, and a table may want to see how far over they are.

## The builder screen

The app's only **full-height screen**: a pinned header, and two panels that slide horizontally,
each scrolling independently. (Why this screen alone is `h-dvh overflow-hidden` is explained in
[../technical-spec/01-visual-theme.md](../technical-spec/01-visual-theme.md#scrolling-model).)

**Header** — row 1: **← Main Menu** and the Standard/Roster tabs. Row 2: **Copy Army Code**
(turning emerald **"Copied ✓"** on success) and **Save Army**, both disabled while the army is
empty, plus the points badge at the right edge.

After a copy attempt a result panel appears under the header: **"Army code copied to clipboard
✓"**, or **"Clipboard unavailable — long-press the code below to copy it."** — in both cases the
code itself is shown, selectable. The panel clears on any change to the list. (The persistent
panel replaced a two-second label flash plus a `window.prompt` fallback, which on phones looked
exactly like the button doing nothing.)

**Panels** — **Available Units** (left) and **Your Army** (right), moved between by the fixed edge
tabs (`‹` / `›`), by swipe (a mostly-horizontal drag of ≥ 50 px), or implicitly when a code or
save loads.

### Available Units

One row per recruitable unit: a 70 px portrait button (opening the unit card), the name, chips
**"Limit {n}"** and **"{pts} pts"**, and a compact stepper. At count 0 the disabled `−` and the
`0` are hidden so only `+` shows — that frees ~75 px of row width for the name on a phone. `+`
disables at the unit's copy limit.

Order: the faction's exclusives (alphabetical), then the neutral pool. Mounts are never listed.

In **Roster** format this panel gains an **Equipment** section listing every upgrade the faction
can access, with cost and per-army limit chips and its own stepper.

### Your Army

One row per **copy** — every copy is its own entry with its own id, so a single copy can be
mounted, upgraded or removed independently of its siblings. Empty state: _"No units yet. Add some
from the unit list."_

Each row: the portrait (opening the unit card with all upgrade effects applied), one orange **+**
per free upgrade slot (**Standard only**), the name, its total **"{pts} pts"** (unit + mount +
discounted upgrades), a **mount toggle** when the unit has one, and a red **−** removing exactly
that copy. Picked upgrades render beneath as orange pills (icon + name, opening the upgrade
detail) with their cost and a **✕**.

In **Roster** format an **Equipment** section lists the pool picks instead: name, **×{qty}**,
total cost, and a **−**.

Adding a copy appends to the end of a list the player may not be looking at — the pick happens on
the other panel — so the Your Army list **auto-scrolls to its new row** when the army grows. On
first mount the scroll is suppressed, so loading an existing army via a code does not jump.

## The unit card

Tapping any portrait opens a scrollable card (`max-h-[85dvh]`), closed by backdrop click or
`Escape`. Header: portrait, name, **"Size: {size}"**, the faction name in its colour, class tags
as clickable sky pills, and — while mounted — an emerald **"Mounted on {name}"**.

Then the **11-stat statline** as a tinted box grid (`STA SPD OFF DEF ACC INT AG T ARM HP M`, an
en dash where a model has no value), showing the **effective** stats: the mount's overrides and
all applied upgrade effects.

Below, in this order: **Skills → Traits → Combat Arts → Spellcrafts**, a divider, then
**Inventory → Stratagems**. The divider exists because the first four are the model's own rules
while the last two are its equipment and options; it renders only when something sits below it.

- **Rules tags** open popups. A **leveled** entry (Charm, Fencing, Resourceful, …) lists _every_
  catalog level ascending: levels up to the unit's are normal, higher ones greyed out, each headed
  **"Level {roman}"**. Tag titles carry the roman suffix as printed (_Fencing III_).
- **Links inside rules text** (the producer's cross-references, e.g. Rogue → Knockdown → Crouched)
  open further popups **stacked** on top of each other; `Escape` or a backdrop click unwinds one
  layer at a time.
- **Spellcrafts** open element-grouped spell cards, sorted Elder-first then level then name, with
  **PW** and **STK** resolved against _this unit's_ stats (so `INT -3` reads `INT (12) -3`). Only
  spells the unit can actually cast are listed — its group, at or below its level, in its
  Affinity elements. With none: _"No spells at this level for the unit's affinities."_
- **Inventory** is headed **"INVENTORY ({used}/{total} Space used)"**, grouped
  Weapons / Shields / Accessories / Consumables, each item showing PW, RCH, STK, QTY and WGT.
  Inscribed items (a Glyphscribe choice) show their modified weight and strike here.
- **Stratagems** render inline as cards grouped Authority / Subterfuge / Tribe.

## Mounts

A rider unit may be mounted. Mounting:

- adds the mount's **points** to that copy,
- **overrides** the rider's stats with the mount's non-null values, then **adds** the mount's stat
  changes on top,
- and makes the model count as **the mount's size**, not its own.

That last rule can invalidate an upgrade already picked — a size-capped item such as Flying
Carpet ("Size Medium or smaller") becomes illegal when a Medium rider becomes Huge. So the toggle
is guarded: the app lists what the toggle would _newly_ block, and confirms before dropping it —
_"Mount this model? Its size changes, so {names} will be removed."_ (**Yes** / **No**). With
nothing at stake the toggle is immediate. Still-legal upgrades are untouched, and unmounting
never conflicts.

## Upgrades (Standard format)

Each copy has a slot budget: **1 + its Resourceful level + the number of Pouch upgrades it
carries**. Units the rulebook excludes from upgrades have **zero** slots (Tomoe, Kogetsu, Seigen,
Tharos, Anari, Na'ra, Chiyohime, Chanra — note the generic Goblin Shaman is _not_ excluded).

Access is by faction: the four main factions (Helian League, Empire of Soga, Coalition of
Thenion, Sand Kingdoms) get their own exclusives plus the neutral upgrades; **Oni Clans, Goblin
Wartribes and the Adventurers' Guild get neutrals only**.

Picking happens in an overlay headed **"Upgrade {unit name}"**, listing each candidate with its
artwork, **discounted** cost, per-army limit and description. A candidate that cannot be taken
shows why, in red:

| Reason        | Shown as                              |
| ------------- | ------------------------------------- |
| `locked`      | "This model cannot receive upgrades"  |
| `owned`       | "Already taken by this model"         |
| `slots`       | "No free upgrade slot"                |
| `limit`       | "Army limit reached"                  |
| `requirement` | "Model does not meet the requirement" |
| `max-level`   | "Already at the maximum level"        |

`requirement` covers a missing required class, a forbidden trait, a size ceiling (judged against
the **effective** size, so a mounted model is gated by its mount) and a choice upgrade with no
usable option left.

Some upgrades need a further decision, which opens as an extra step:

- **Advance a Spellcraft** — only when more than one school could advance; a single candidate
  resolves automatically. Rows read **"Level {n} → {n+1}"**, or are disabled at the cap, which is
  derived from the unit's Affinity elements.
- **Choose an Option** — e.g. Glyphscribe's _Inscribed Item_ vs _Inscribed Armor_, or Elemental
  Lineage's choice of Affinity. Disabled options explain themselves: **"No item to inscribe"**,
  **"Model already has this Affinity"**, **"Model has no Affinity"**.
- **Choose an Item** — for inscribing: _"…choose the item to inscribe. Its weight drops by 1 and
  its Strike rises by 1."_
- **Replace an Affinity** — only when the unit has more than one element; rows read **"This
  Affinity is replaced by {element}."** A single element resolves without asking.

Every selection is stored on the entry, so it survives a code export and a reload.

**Costs** flow into the army total. One upgrade (Devotion: Paimon) discounts _every other_
upgrade army-wide by 1, to a minimum of 1; the provider itself keeps its full cost.

## Roster format: the equipment pool

A Roster army keeps units and mounts but carries **no per-unit upgrades** — the slot `+` buttons
do not render. Instead the faction's whole upgrade catalog becomes a shared pool, picked with
steppers in the Available panel's **Equipment** section and listed in Your Army's **Equipment**
section.

Each copy costs points toward the 125 cap and is limited by the upgrade's per-army limit.

> **The Paimon discount does not apply in Roster format** — the reduction only scans per-entry
> upgrades, and Roster entries carry none. Whether that is a rules ruling or an oversight is
> unresolved; see Open questions.

## Army codes

An entire list — faction, format, every copy, mounts, upgrades with all their selections, and the
Roster equipment pool — serializes to a short share code.

**Export**: **Copy Army Code** writes it to the clipboard and shows the persistent result panel
described above. When the clipboard API is unavailable (common in mobile browsers outside a
secure context) the code is still displayed for manual copying.

**Import**: paste a code on the faction select. Decoding is **strict** — malformed input in any
way is rejected — but tolerant of case and surrounding whitespace. Before anything is applied, the
code's **roster fingerprint** is compared against the current content: because the code stores
_indexes_ into sorted catalogs, a code built against a different roster would otherwise decode
into silently wrong units. A mismatch is refused loudly as **"This code was created with a
different roster version."**

A successful import **replays every pick through the same guards the UI uses** — copy limits,
mount toggles, upgrade gating and selections — so an import can never produce an illegal army. If
any replayed pick would be blocked, the whole import is rejected as invalid rather than partially
applied.

> Accepted consequence: a pre-size-rule code holding a _mounted_ Slayer Dragoon _with_ Flying
> Carpet is now rejected outright, because that list is genuinely illegal under the mount-size
> rule. Rejecting beats silently trimming.

## Saved armies

**Save Army** opens a dialog titled **Save Army** with a name input (_"Name this army list"_,
max 40 characters) and **Cancel** / **Save** (disabled while blank). Errors: **"Give the army a
name first."** and **"The army is empty."** A save stores only metadata plus the code — the code
_is_ the list.

**Load Army** lists the saves behind **Standard** / **Roster** filter tabs, grouped by faction in
config order with the faction name as a coloured chip header, **newest first** within a group.
Empty states read _"No saved Standard armies yet."_ / _"No saved Roster armies yet."_ Picking one
replays its code exactly like a pasted import and opens the builder on the Your Army panel.

Each row has a **✕** which confirms _"Delete "{name}"?"_ (**Yes** / **No**). `Escape` unwinds a
pending delete confirmation before it closes the dialog.

A stale save is **never auto-deleted** — it simply refuses to load, with **"This saved army is not
valid anymore."** or **"This saved army was created with a different roster version."** inline on
its row.

## Open questions

- **The Roster equipment pool ignores the Paimon cost reduction.** Structurally impossible today
  (the reduction scans per-entry upgrades). Is that the correct ruling?
- **Nothing blocks exceeding the point cap** — only the badge turns red. Intentional, but worth
  restating whenever someone asks for a "legal army" check.
- **Upgrade descriptions in the picker and detail dialogs strip rich links to plain text**; only
  the unit card's rules popups render them clickable. Inconsistent, and it hides cross-references
  exactly where a player is deciding whether to take an upgrade.
- **The item stat box labelled PW actually shows the item's toughness.** Consistent end to end
  (the producer's item PW column is imported as `toughness`) but easy to misread — worth a comment
  or a rename.
- **The unit-card popup stack has no depth limit.** Rules links can nest arbitrarily; on a phone a
  deep stack is only closable one layer at a time.
- **Upload Army is unbuilt.** The whole builder currently produces nothing the mission flow can
  use — the code and the save are the only outputs. Attaching an army to a mission run is the
  obvious next step and the reason the briefing's blue button exists.
