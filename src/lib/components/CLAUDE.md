# lib/components/ — reusable UI

- Presentational, "dumb" components: receive data and callbacks via props (`$props()`),
  render UI, emit events/call callbacks back up. Avoid importing stores directly — let
  the page in `routes` wire store state to props instead.
- Domain _types_ (`Mission`, `SchemeCard`, `MissionProgress`, ...) are fine to import
  for prop typing. Domain _logic_ (random draws, clamping, VP math) is not — that stays
  in `lib/domain` or `lib/stores`. The line is _decisions_: a pure read/format accessor
  with no rule in it (`unitStatuses`, `pickedArmyFormat`, `qrCodeMatrix`) is a display
  helper and fine to call, whereas anything that could be wrong about the game is not.
- **A panel that renders for either seat belongs in a `{#snippet}`, not in duplicated
  own/opponent branches.** The online seat cards started as four near-identical blocks
  (P1/P2 × own/opponent) and every change had to be made four times. Compute a per-seat
  data object in the script — `{@const}` inside a snippet cannot see an `{#if}`'s
  narrowing, and TypeScript will reject a comparison it can prove false — then
  `{@render seatPanel('player1')}` twice. `OnlineArmyPrep`, `OnlineSchemeSelect` and the
  lobby's Ready row all do this.
- Style with Tailwind utility classes. Keep touch targets large and layouts
  mobile-first — the app is used on a phone screen during a game.
- Keep components small and focused (e.g. `MissionMap`, `ResultsPanel`, `SchemesPanel`,
  `ScoreSummaryPanel`, `IncrementBoxes`) rather than one large page-shaped component. Hot-seat
  gets its own variants where the seat model changes a panel (`SchemesPanelTwoPlayer`,
  `ScoreSummaryPanelTwoPlayer`, `ActivePlayerPanel`) and reuses the shared ones unchanged
  (`ResultsPanel`, `ArmyReadonlyPanel`, the static panels).
- Seat colours live in `playerAccent.ts` as literal Tailwind class strings — never build them by
  interpolation, Tailwind only sees whole names. A component that shows a seat takes a `PlayerKey`
  or a `SeatHue` and reads its recipe from there.
- Overlays (`fixed inset-0`) must render **above every transformed or backdrop-filtered
  ancestor**: a non-`none` `backdrop-filter` _or_ `transform` makes that ancestor the containing
  block for the overlay's fixed descendants. Inside a `Panel` the overlay would cover only that
  panel; inside a tracker's sliding strip (which carries a translate) its backdrop still
  covers the screen while the centred card lands off-screen — the "only the darkening shows" bug.
  Split trigger from overlay and let the **screen** hold the open state — `RuleLabels` (buttons,
  emits `onOpenRule`) + `RuleCalloutDialog` (overlay) rendered at the screen root, the way the
  army popups already are. Dialogs use `z-50`; the sticky top bar (`ScreenHeader`) is `z-30`.
- **An inline `{#if}` inside a sentence eats the space at its boundary.**
  `Assign every player{#if odd} and the BYE{/if} to a table` renders as "playerand the BYE", and
  Prettier then re-wraps the block so the missing space is easy to miss in review. Write the whole
  sentence in each `{#if}`/`{:else}` branch, or build the string in an expression
  (`{needsBye ? 'Players & Bye' : 'Players'}`) — both are what `TournamentRoundPrep` does.
- **Escape goes through `escapeKey.ts`, never an element `onkeydown`.** Register it from
  the overlay's script with `$effect(() => onEscapeKey(close))`. A backdrop `div` is not
  focusable, so an `onkeydown` on it only fires while focus happens to sit inside the
  overlay — which is exactly how Escape came to do nothing in the army dialogs. The
  helper keeps a stack, so nested overlays (Load Army over the builder plus its delete
  confirmation, a unit card plus its rules popups) close exactly one layer per keypress,
  the topmost one. For outside-click, test `event.target === event.currentTarget` on the
  backdrop instead of putting `onclick={stopPropagation}` on the card: a click handler on
  a `role="dialog"` div trips `a11y_click_events_have_key_events`.
