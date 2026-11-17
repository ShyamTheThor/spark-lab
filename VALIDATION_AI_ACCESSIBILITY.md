# Validation record — AI and accessibility integration

## Executed in the implementation environment

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` on supplied lockfile | Passed; development test dependencies were then added and the final lockfile updated |
| `npm run build` | Passed; production chunks and service-worker precache generated |
| `npm test -- --maxWorkers=2 --minWorkers=1` | 130 tests passed: 118 existing tests plus 12 AI/voice/context/preferences DOM tests |
| `npm run test:partner` | 7 tests passed: validation, metadata allowlisting, missing credentials, provider request mapping, bounded history, malformed/oversized/cross-origin requests, rate limiting, quota and empty-provider results |
| `npm run test:curriculum` | 8 tests passed, including consistent locale keys and existing curriculum IDs/order |
| `npm run smoke` | 75/75 built-in modules passed construction, panel/wiring and simulation smoke checks |
| `npm run lint` | No errors; six pre-existing unused-import warnings remain |
| Chromium visual/browser test | Not completed. Chromium launch was blocked by the execution environment's socket restrictions; browser-download attempts also failed. No visual/mobile browser pass is claimed. |
| Live Gemini, audible voice, offline PWA and Firebase sync | Not verified with real credentials/devices in this environment |

The AI HTTP tests use a **test-only injected provider**; the application never ships a fake AI response. The speech tests use a **test-only browser API mock**. They verify function calls, highlighting, navigation cleanup and local-only voice selection; they do not prove that a physical device can produce sound offline.

## Verified behavior in DOM tests

- Ohm's law uses actual simulation values: 12 V / 4 Ω = 3 A; changing resistance to 6 Ω changes the request to 2 A.
- pH 6.8 is acidic, pH 7.2 is basic, and pH 7 is neutral in the current model; indicator interpretation comes from current state.
- Follow-up requests include bounded prior messages plus a fresh snapshot.
- HTML-like provider text is displayed literally and cannot create an image/script element.
- Failed AI requests show an error without creating an assistant answer.
- Play, Pause, Resume, Repeat and Stop call the expected speech APIs; the active transcript step is highlighted.
- Offline selection refuses remote voices and voices for another language; English local narration does not fetch a translation.
- Missing voices retain text and show a useful message.
- Settings survive state reload and update document attributes.
- Kannada preference appears in AI context.
- All 75 built-in modules produce serializable experiment context; primitive state extraction excludes functions and arbitrary objects.

## Manual acceptance checklist on your computer

1. Set a valid Gemini key/model, run `npm run dev`, ask the Ohm's law question and check the real answer against I=V/R. Repeat after changing resistance. Try Beginner/Advanced and Kannada/Hindi.
2. Try multi-turn questions, Clear chat and Cancel request. Disconnect internet and verify the real error instead of an invented answer.
3. In your browser's developer tools inspect `/api/lab-partner`: only current experiment context, the question and recent conversation should be present. A private Gemini key must never appear.
4. In Voice guide choose a supported voice, then Play/Pause/Resume/Repeat/Stop. Change speed, change language, navigate away during narration, and turn voice guidance off.
5. Build and preview the production app; wait for PWA installation online. Cache a regional instruction translation by playing it online. Go offline, reopen the same experiment and confirm text remains usable. If a working local voice is installed, verify actual offline audio; otherwise confirm the fallback message.
6. Refresh after changing every accessibility setting. If Firebase is configured, sign in on a second device and verify preference synchronization.
7. Keyboard-only: Tab through controls, use sliders with arrow keys, orbit/zoom the canvas, pan with Shift+arrows, open dialogs, close with Escape and check focus return.
8. Inspect pH, circuit, pendulum energy bars, line graph and instruments with each colour mode. Numeric descriptions must remain understandable; physical colour interpretations must match the model.
9. Check high contrast and large text in light/dark/system themes at mobile widths and 200% zoom. Use a screen reader to review dialog titles, logs, errors and form labels.
10. Review with a teacher and perform an accessibility audit before claiming WCAG 2.2 AA compliance. The pre-existing application has not received a full conformance audit.

Optional repeatable browser acceptance check (start `npm run dev` in another terminal):

```powershell
npx playwright install chromium
npm run test:browser
```

Set `TEST_URL` to test another local deployment; `CHROME_PATH` can select an installed Chromium executable. This script checks real controls, snapshot request content, persisted settings, keyboard sliders, mobile dialog bounds and navigation. It does not assert real AI accuracy or audible TTS.

## Known inherited limitations

- Four illustration files referenced by atom/cell/DNA/heart were absent from the uploaded ZIP. Their supplied descriptions/captions are used as fallbacks. Vite still warns about the absent source URLs; the build succeeds.
- Some legacy experiment text is English and depends on the existing translation service. New notices/core controls have bundled regional translations; scientific translations should be reviewed by native-speaking teachers. Technical colour-vision names and the internal explanation request remain in English where appropriate.
- Existing unauthenticated/keyless translation providers can be unavailable or rate-limited. Offline cache lookup now avoids the Firebase network call.
- A colour mode adds geometric/pattern alternatives; it is not a fully bespoke redraw of every legacy chart or instrument.
