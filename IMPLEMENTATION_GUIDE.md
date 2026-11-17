# Spark AI Lab Partner — implementation and running guide

This is an enhancement of the supplied Spark project, not a rebuilt application. Vite, vanilla JavaScript, the lazy-loaded Three.js module registry, existing curriculum mappings, language selection, PWA and account-scoped Firebase synchronization are retained.

## Run in VS Code on Windows

1. Extract the ZIP to a new folder. Open the folder containing `package.json` in VS Code.
2. Use Node.js 22.9+ (Node.js 24 is suitable). Check `node -v` and `npm -v` in a fresh terminal.
3. Install from the included lockfile:

```powershell
npm ci
Copy-Item .env.example .env
```

4. Open `.env` in VS Code. Add your own server credential:

```dotenv
GEMINI_API_KEY=your_actual_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Do not put the key in a `VITE_` variable, browser code, chat, GitHub, or a screenshot. `.env` is already excluded from Git. Choose a model enabled for your API project if the example model is unavailable. Quotas and free-tier eligibility depend on the provider/account; the application does not promise unlimited free requests.

5. Start:

```powershell
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The development server already includes both `/api/lab-partner` and `/api/translate`; a second API terminal is NOT needed in development. Restart after editing `.env`.

The experiments work without a Gemini key. Asking the assistant without one displays a configuration error, never a fake answer. Voice narration uses the browser, not Gemini.

## Try the features

1. On the existing home page choose class, board and language. State-based language suggestions remain unchanged; language can be overridden in the global selector or AI & accessibility settings.
2. Open Experiments → Explore all → Ohm's law loop, or visit `/#/circuit`.
3. Set voltage to 12 V and resistance to 4 Ω. The deterministic simulation shows 3.00 A and 36.0 W.
4. Open **Current simulation data** to inspect the values available to the assistant.
5. Click **Explain this result**, or **Spark AI Lab Partner** and ask “Why is the current 3 amperes?”
6. Change resistance to 6 Ω and ask again. The request now contains 2 A and 24 W. An older answer is explicitly a snapshot, not a live-updating answer.
7. Open **Voice guide** and press Play. Pause, Resume, Repeat step and Stop control narration. The current sentence is highlighted in the transcript. Read results narrates the current output; Read answer narrates the latest AI explanation.
8. Open **AI & accessibility** to choose explanation level, language, voice, speed, text size, contrast, colour-vision mode and reduced motion.
9. Open Pendulum, pH scale or Line grapher to examine more detailed scientific context and text alternatives.

## Implemented coverage

| Area | Functionality and boundary |
| --- | --- |
| AI Lab Partner | Floating, modal chat on all 75 built-in experiment pages; suggested questions, follow-up context, clear/cancel controls, request snapshot labels and readable errors. Also available with lesson-only context when WebGL is unavailable. |
| Live context | Fresh input and rendered-output capture on every request; 2 Hz local data preview. 67 modules additionally expose actual primitive simulation state. Eight modules without a shared `state` object use their actual controls/results; unavailable internal quantities are not invented. |
| Detailed science adapters | Ohm's law: voltage, resistance, current, power and formulas. Pendulum: length, gravity, angle, energy per mass, small-angle period and damping caveat. pH: actual pH, concentration, universal-indicator ramp and approximate colour name. Line graph: slope, intercept, rise/run and point coordinates. |
| Explanations | Beginner, intermediate and advanced; selected class/board/language are sent to Gemini. The prompt asks for formulas, substitutions, assumptions and applications. A language model can still make errors; real scientific response quality requires live credential-based testing. |
| Voice | Web Speech API, explicit user start, voice selection, local-voice preference, rate 0.5–2×, pause/resume/repeat/stop, transcript, cancellation on navigation or language change. Existing chapter audio now uses the shared voice component. |
| Offline | Existing production PWA caches experiment JS and bundled lessons. English can be narrated with a working English local voice. Regional narration needs bundled or previously cached translation plus a compatible local voice. Missing translation/voice leaves readable text. |
| Regional language | New core controls/settings/notices bundled for English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi and Bengali. Existing translation service supplies longer lesson/instruction translations, caching successful results. Additional configured languages use the existing dynamic dictionary mechanism. |
| Colour accessibility | Protanopia/deuteranopia/tritanopia modes add geometry edges, alternate line palettes/dash lengths and patterned energy bars. Real scientific colour phenomena are preserved. pH has data-based colour interpretation; circuit has actual component/charge/glow descriptions; line graph has a marker/line explanation and numeric points. This is not a claim that every pre-existing coloured component has a bespoke semantic legend. |
| General accessibility | Native keyboard-operable forms/dialogs, visible focus, named controls, readable alert/log regions, text sizes, contrast, reduced motion, keyboard camera orbit/zoom and added Shift+arrow panning. Existing selection buttons remain available for pickable models. Full WCAG 2.2 AA conformance has not been certified. |
| Settings | Uses `preferences.labPartner` in the existing versioned account-scoped store. Cloud sync follows the existing authenticated Firebase flow when Firebase is configured. Chat contents are kept only in the current page's memory and are not saved to Firebase. |
| Instruments | Existing instrument viewer gets optional geometry/line accessibility treatment and reduced auto-rotation. The AI chat applies to built-in experiment pages, not arbitrary user-submitted simulation code. |

## Technical decisions

- No physics formula is calculated by the AI or copied into a second chatbot calculation engine. Existing simulation functions remain authoritative.
- Input capture is scoped to the experiment panel; no profile, account identity, email or full-page scrape is sent. The question itself is free text, so users are told not to enter personal information.
- `server/ai.mjs` validates the experiment ID against the server registry, curriculum, strings, arrays, message roles and size limits. It uses a server-only API header, a timeout, per-IP/global request budgets and bounded concurrent requests. Provider errors never return private credentials or raw upstream errors.
- The conversation window is at most eight prior turns, each capped at 1,200 characters on the client. The latest simulation snapshot takes precedence over earlier answers.
- AI answers are inserted using `textContent`; no generated HTML is executed. Prompt-injection resistance is a model instruction, not a mathematical guarantee.
- Speech language must match the chosen language. The app does not silently narrate Kannada text with an English-only voice.
- No automatic narration or background AI requests are introduced.
- The supplied pH classification defect (calling 6.5–7.5 neutral) is corrected: below 7 acidic, above 7 basic for the model's assumed 25 °C. Indicator colour alone is not labelled as proof of acid strength.
- Missing supplied illustrations fall back to their original descriptive captions. The favicon uses the existing generated app icon.

## Production and offline use

```powershell
npm run build
npm run preview
```

Preview includes the API middleware for local testing. Open online first and allow the service worker to finish installation before testing offline; normal Vite development mode is not an offline-installation test.

For deployment, serve `dist/` over HTTPS and run the Node API on the server:

```powershell
npm run api
```

Reverse proxy `/api/` to that process (default `127.0.0.1:8787`). Set `AI_ALLOWED_ORIGINS` to your exact HTTPS site origin if the proxy changes the Host header. `API_PORT` and `API_HOST` are configurable. A static-only host cannot execute the Gemini endpoint: deploy a Node backend or adapt the handler to the host's serverless environment. Never upload `.env` into `dist/`.

Example reverse-proxy location:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_read_timeout 40s;
}
```

The included rate limiter is in-memory and per process. It deliberately ignores forwarded IP headers. Behind a reverse proxy, it may share one IP budget across students. For a public or multi-instance deployment, put verified authentication/App Check, shared rate limiting and provider spending limits in front of this endpoint. These are deployment recommendations, not hidden dependencies of local experiments.

## Verification and practical limits

See `VALIDATION_AI_ACCESSIBILITY.md` for executed checks and the manual checklist. Real Gemini answers need your key. Actual voice availability, sound output, mobile browser behavior, production service-worker offline operation and cloud preference synchronization require device/deployment testing. A mocked speech test proves control wiring, not audible speech quality.

Best next project steps, without changing the product scope: use the four detailed adapters for your demonstration; ask a teacher to review AI answers/translations; test once with a keyboard and your target Windows/Android voices; configure backend quotas before public hosting.

Reference specifications checked during implementation:
- https://aistudio.google.com/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/api/generate-content
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService
