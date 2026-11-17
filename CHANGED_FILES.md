# Modified-file map

- `server/ai.mjs`, `server/start.mjs`, `vite.config.js`: validated server-side Gemini endpoint and development/preview/production routing.
- `src/partner/`: reusable context, state snapshots, AI panel, voice, settings, preferences, 3D alternatives and styling.
- `src/main.js`, `src/engine/viewer.js`, `src/engine/heroOrbit.js`, `src/features/stage.js`, `src/features/instruments.js`: integrate the shared controls and reduced-motion/keyboard/3D support with existing views.
- `src/modules/`: small read-only state-accessor additions in 67 existing modules; detailed pH/circuit/pendulum/linegraph data and descriptions. Existing deterministic calculations remain in place.
- `src/i18n/`, `src/locales/`: shared speech guide, offline-safe translation lookup and new regional-language controls/notices.
- `.env.example`, `package.json`, `package-lock.json`: server settings, reproducible installation, test commands and development-only test dependencies.
- `test/partner.test.js`, `scripts/partner-*.mjs`, `scripts/json-loader.mjs`, `scripts/smoke.mjs`, `eslint.config.js`: regression coverage, optional browser test and JSON-compatible smoke runner.
- `index.html`: use the existing generated app icon as favicon.
- Documentation: setup, functionality, limitations, validation and this change list.

## Exact source/artifact file changes relative to the uploaded ZIP

| File | Change |
| --- | --- |
| `.env.example` | Modified |
| `IMPLEMENTATION_GUIDE.md` | Added |
| `README.md` | Modified |
| `VALIDATION_AI_ACCESSIBILITY.md` | Added |
| `eslint.config.js` | Modified |
| `index.html` | Modified |
| `package-lock.json` | Modified |
| `package.json` | Modified |
| `public/icons/apple-touch-icon.png` | Added |
| `public/icons/icon-192.png` | Added |
| `public/icons/icon-512.png` | Added |
| `public/icons/maskable-512.png` | Added |
| `scripts/curriculum-tests.mjs` | Modified |
| `scripts/json-loader.mjs` | Added |
| `scripts/partner-browser.mjs` | Added |
| `scripts/partner-tests.mjs` | Added |
| `scripts/smoke.mjs` | Modified |
| `server/ai.mjs` | Added |
| `server/start.mjs` | Modified |
| `src/engine/heroOrbit.js` | Modified |
| `src/engine/viewer.js` | Modified |
| `src/features/instruments.js` | Modified |
| `src/features/stage.js` | Modified |
| `src/i18n/speech.js` | Modified |
| `src/i18n/translation.js` | Modified |
| `src/locales/bn.json` | Modified |
| `src/locales/en.json` | Modified |
| `src/locales/hi.json` | Modified |
| `src/locales/kn.json` | Modified |
| `src/locales/ml.json` | Modified |
| `src/locales/mr.json` | Modified |
| `src/locales/ta.json` | Modified |
| `src/locales/te.json` | Modified |
| `src/main.js` | Modified |
| `src/modules/atom.js` | Modified |
| `src/modules/barometer.js` | Modified |
| `src/modules/buoyancy.js` | Modified |
| `src/modules/calculus.js` | Modified |
| `src/modules/calorimeter.js` | Modified |
| `src/modules/circuit.js` | Modified |
| `src/modules/clinometer.js` | Modified |
| `src/modules/clock.js` | Modified |
| `src/modules/compass.js` | Modified |
| `src/modules/coulomb.js` | Modified |
| `src/modules/counting.js` | Modified |
| `src/modules/cradle.js` | Modified |
| `src/modules/dialysis.js` | Modified |
| `src/modules/dice.js` | Modified |
| `src/modules/digestive.js` | Modified |
| `src/modules/distillation.js` | Modified |
| `src/modules/dna.js` | Modified |
| `src/modules/electricgenerator.js` | Modified |
| `src/modules/electricmotor.js` | Modified |
| `src/modules/electromagnet.js` | Modified |
| `src/modules/electromagneticinduction.js` | Modified |
| `src/modules/electroscope.js` | Modified |
| `src/modules/foodchain.js` | Modified |
| `src/modules/fractions.js` | Modified |
| `src/modules/gaslaws.js` | Modified |
| `src/modules/genetics.js` | Modified |
| `src/modules/grapher.js` | Modified |
| `src/modules/heart.js` | Modified |
| `src/modules/heat.js` | Modified |
| `src/modules/humaneye.js` | Modified |
| `src/modules/incline.js` | Modified |
| `src/modules/ionicbond.js` | Modified |
| `src/modules/lens.js` | Modified |
| `src/modules/levers.js` | Modified |
| `src/modules/lightscattering.js` | Modified |
| `src/modules/linegraph.js` | Modified |
| `src/modules/magnet.js` | Modified |
| `src/modules/mensuration.js` | Modified |
| `src/modules/microscope.js` | Modified |
| `src/modules/mirrors.js` | Modified |
| `src/modules/panbalance.js` | Modified |
| `src/modules/pendulum.js` | Modified |
| `src/modules/periscope.js` | Modified |
| `src/modules/ph.js` | Modified |
| `src/modules/photosynthesis.js` | Modified |
| `src/modules/plantparts.js` | Modified |
| `src/modules/prismdispersion.js` | Modified |
| `src/modules/projectile.js` | Modified |
| `src/modules/pythagoras.js` | Modified |
| `src/modules/reactionrate.js` | Modified |
| `src/modules/reactiontime.js` | Modified |
| `src/modules/reflexhammer.js` | Modified |
| `src/modules/refraction.js` | Modified |
| `src/modules/resistors.js` | Modified |
| `src/modules/respiratory.js` | Modified |
| `src/modules/shapes3d.js` | Modified |
| `src/modules/similarity.js` | Modified |
| `src/modules/sound.js` | Modified |
| `src/modules/sphygmomanometer.js` | Modified |
| `src/modules/spring.js` | Modified |
| `src/modules/springbalance.js` | Modified |
| `src/modules/standing.js` | Modified |
| `src/modules/states.js` | Modified |
| `src/modules/stethoscope.js` | Modified |
| `src/modules/thermometer.js` | Modified |
| `src/modules/unitcircle.js` | Modified |
| `src/modules/waves.js` | Modified |
| `src/partner/context.js` | Added |
| `src/partner/panel.js` | Added |
| `src/partner/partner.css` | Added |
| `src/partner/preferences.js` | Added |
| `src/partner/settings.js` | Added |
| `src/partner/state.js` | Added |
| `src/partner/visuals.js` | Added |
| `src/partner/voice.js` | Added |
| `test/partner.test.js` | Added |
| `vite.config.js` | Modified |
| `CHANGED_FILES.md` | Added |
