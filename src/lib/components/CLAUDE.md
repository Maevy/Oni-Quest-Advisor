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
  `CommandPanel`, `IncrementBoxes`) rather than one large page-shaped component.
- Fixed-position overlays (e.g. the `CommandPanel` tab pinned to the right edge)
  need matching padding reserved in the surrounding layout — `MissionDetail` keeps
  right padding clear for the closed tab; the expanded panel intentionally
  overlays content.
