# Spark Curriculum & Multilingual Extension (NCERT & State Syllabus)

This is an incremental extension of the Spark STEM Education Platform preserving all existing 3D experiments, scientific instruments, UI design, and architecture. The bundled curriculum dataset (`src/curriculum/seed.json`) contains **104 source-verified curriculum mapping records** across **Classes 1 to 12**:
- **52 NCERT (`ncert`) records** covering Classes 1–12 across Science, Physics, Chemistry, Biology, and Mathematics, extracted directly from official NCERT textbook editions (*Joyful Mathematics*, *Maths Mela*, *Our Wondrous World*, *Curiosity*, *Ganita Prakash*, *Science Exploration*, *Ganita Manjari*, and Senior Secondary NCERT Physics, Chemistry, Biology, and Mathematics textbooks at https://ncert.nic.in/textbook.php).
- **52 Karnataka State Board — KSEAB / KTBS / DPUE (`karnataka`) records** covering Classes 1–12 across Science, Physics, Chemistry, Biology, and Mathematics.
- **100% Library Coverage**: Every single one of the **75 interactive STEM experiment modules** and all **75 3D scientific instruments** are mapped to both NCERT and Karnataka State Board chapters.

## Run locally (Windows PowerShell / VS Code)

Install Node.js 22 LTS (22.16 or newer recommended), extract the zip and open `Spark-main` in VS Code. In the integrated PowerShell terminal:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. No Firebase or Bhashini account is required for the bundled curriculum, navigation translations, or the original local learning features. Select **Curriculum Explorer**, choose **NCERT** (`India (National)`) or **Karnataka State Board (KSEAB)** (`Karnataka`), and filter by Class (1–12), Subject, Chapter, and Topic. Click any experiment or 3D instrument button to open the interactive module. Use the navigation language dropdown (`English`, `हिन्दी`, `ಕನ್ನಡ`, `தமிழ்`, `తెలుగు`, `മലയാളം`, `मराठी`, `বাংলা`) to switch UI labels without reloading. The Class 10 Electricity objective/outcome passage includes bundled translations in all eight languages; on other passages, the **Translate explanation** button uses a configured Bhashini service or reviewed Firestore translation while keeping the original English text visible.

## Firebase administration

Use the existing `SETUP.md` Firebase instructions. Copy `.env.example` to `.env`, set the `VITE_FIREBASE_*` values, enable Authentication and Firestore, and deploy the updated `firestore.rules` (which supports Classes 1–12 in `curriculumMappings`) to your Firebase project. Give authorized users the signed `admin: true` custom claim. The `Curriculum admin` page allows administrators to add or update boards, mappings (including enabling/disabling records), and reviewed educational passages across all supported Indian languages.

## Bhashini

Use the official onboarding docs at https://bhashini.gitbook.io/bhashini-apis/pre-requisites-and-onboarding and obtain your ULCA user ID, API key, and a translation-capable pipeline ID. Put these server-only entries into `.env`:

```
BHASHINI_USER_ID=your_user_id
BHASHINI_API_KEY=your_api_key
BHASHINI_PIPELINE_ID=your_pipeline_id
```

Do not use a `VITE_` prefix for these credentials. Restart Vite (`npm run dev` or `npm run preview`) or start the standalone translation proxy with `npm run translation:server`. Official workflow: https://dibd-bhashini.gitbook.io/bhashini-apis/pipeline-config-call and https://dibd-bhashini.gitbook.io/bhashini-apis/pipeline-compute-call.

## Validation

Executed in verification:
- `node --test scripts/curriculum-tests.mjs`: 6/6 tests passed, validating NCERT and Karnataka State Board coverage across all Classes 1–12, 100% coverage of all 75 experiment modules and 75 instruments, filter/override behavior, 8-language locale key parity, and Bhashini config/compute/cache + HTTP error handling.
- `node --check` passed on all modified JS/MJS modules.

After installing dependencies locally, run:

```powershell
npm run test:curriculum
npm test
npm run smoke
npm run test:security
npm run build
npm run preview
```
