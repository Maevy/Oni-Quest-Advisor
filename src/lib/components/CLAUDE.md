# lib/components/ — reusable UI

- Presentational, "dumb" components: receive data and callbacks via props (`$props()`),
  render UI, emit events/call callbacks back up. Avoid importing stores directly — let
  the page in `routes` wire store state to props instead.
- Domain _types_ (`Scenario`, `MissionCard`, ...) are fine to import for prop typing.
  Domain _logic_ (random pick, validation rules) is not — that stays in `lib/domain`
  or `lib/stores`.
- Style with Tailwind utility classes. Keep touch targets large and layouts mobile-first
  — mission cards and the scenario map are used on a phone screen during a game.
- Keep components small and focused (e.g. `ScenarioMap`, `MissionCardGrid`,
  `MissionCard`, `ScenarioRoller`) rather than one large page-shaped component.
