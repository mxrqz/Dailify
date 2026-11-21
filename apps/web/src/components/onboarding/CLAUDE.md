# apps/web/src/components/onboarding — the first-run intro

Repo-wide rules: [/RULES.md](../../../../../RULES.md). Mockup: bd `Dailify-n4np`.

- `steps.ts`: pure `onboardingSteps({ android, notifications })`, which steps this device shows.
  Reminders only while `pushState()` is `off` (or not read yet); the assistant only in the Android
  app (`nativeReminders()`). Progress dots count only these.
- `onboarding.tsx`: `OnboardingView` (props only) and the `Onboarding` container, a full-screen
  Radix dialog (`data-slot="onboarding"`) mounted by `pages/home.tsx`, so it comes after the splash.
  `hold` (a `?at=`/`?mew=voice` intent) skips it on that load without spending it.
- Seen flag: `useStoredFlag(ONBOARDING_KEY)`, device-wide, set when it opens (steps 4 and 5 leave
  for system screens that may kill the app). Settings' "Rever introdução" clears it and navigates
  to `/dashboard`.
- Escape (the Android back button) steps back instead of closing; "Pular" closes, "Agora não"
  skips one step. Step 4 calls `enablePush`, step 5 `openAssistantSettings`, and both move on
  whatever the result. A step 6 suggestion closes it and hands the text to home's composer
  (`CreateFab text`).
- The pictures are real primitives (`Mew`, `TaskRow`, `MetaChip`, `Mine`, `MessageBox`,
  `ListGroup`) with demo copy, inside an `aria-hidden` non-interactive wrapper: keep buttons out
  of them (`Button asChild` over a `span` for the look).
- Tests: `onboarding.render` (flag, skip, steps per platform), `onboarding.composer.render`
  (suggestion to composer, with create-fab's mocks), `steps.test.ts`; `pages/settings.render`.
