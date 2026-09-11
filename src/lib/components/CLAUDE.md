# lib/components/ — reusable UI

- Presentational, "dumb" components: receive data and callbacks via props (`$props()`),
  render UI, emit events/call callbacks back up. Avoid importing stores directly — let
  the page in `routes` wire store state to props instead.
- Domain _types_ (`Mission`, `SchemeCard`, `MissionProgress`, ...) are fine to import
  for prop typing. Domain _logic_ (random draws, clamping, VP math) is not — that stays
  in `lib/domain` or `lib/stores`.
- Style with Tailwind utility classes. Keep touch targets large and layouts
  mobile-first — the app is used on a phone screen during a game.
- Keep components small and focused (e.g. `MissionMap`, `ResultsPanel`, `SchemesPanel`,
  `ScoreSummaryPanel`, `IncrementBoxes`) rather than one large page-shaped component.
- Fixed-position overlays (e.g. the `CommandPanelTwoPlayer` tab pinned to the right edge)
  need matching padding reserved in the surrounding layout — `MissionDetailTwoPlayer` keeps
  right padding clear for the closed tab; the expanded panel intentionally
  overlays content. Solo no longer has a drawer: its score, round and reset live inline in
  `ScoreSummaryPanel`, the first panel of the tracker's Scoring view.
- Overlays (`fixed inset-0`) must render as a **sibling of `Panel`, never inside it**: a
  non-`none` `backdrop-filter` makes the panel the containing block for its fixed
  descendants, so the overlay would cover only that panel and every later panel would
  paint over it. Split trigger from overlay and let the parent hold the open state —
  `RuleLabels` (buttons, emits `onOpenRule`) + `RuleCalloutDialog` (overlay), wired in
  `DescriptionPanel`. Dialogs use `z-50`; the `CommandPanelTwoPlayer` tab is `z-40` and the
  sticky headers (mission briefing, solo tracker) are `z-30`.
- **Escape goes through `escapeKey.ts`, never an element `onkeydown`.** Register it from
  the overlay's script with `$effect(() => onEscapeKey(close))`. A backdrop `div` is not
  focusable, so an `onkeydown` on it only fires while focus happens to sit inside the
  overlay — which is exactly how Escape came to do nothing in the army dialogs. The
  helper keeps a stack, so nested overlays (Load Army over the builder plus its delete
  confirmation, a unit card plus its rules popups) close exactly one layer per keypress,
  the topmost one. For outside-click, test `event.target === event.currentTarget` on the
  backdrop instead of putting `onclick={stopPropagation}` on the card: a click handler on
  a `role="dialog"` div trips `a11y_click_events_have_key_events`.
