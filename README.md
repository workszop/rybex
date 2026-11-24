# AI Project Lab – Rybex

Workshop app for running an AI project end to end for Rybex, a canned-fish manufacturer: task choice, data, building a prototype, evaluation and report. It is built as a guided simulation for non-technical participants: an incident to solve, a recommended nine-step path, a company website and short checks along the way. Polish and English.

**Open:** https://workszop.github.io/rybex/

The vision lab now loads the separately generated can dataset from `assets/vision-generated/web/`; the previous dataset remains in `assets/vision-realistic/web/`. Its defect classes are generation-prompt labels and have not been visually verified, so experiment scores are provisional. Rebuild the local-file bundle with `node tools/vision-bundle.mjs` after changing the new dataset. The photos are WebP re-encodes of the earlier JPEGs (git history), 2.9 MB instead of 7.5 MB. `replay.json` was recorded on the previous photo set, so it holds no answer for the current vision requests (see the replay paragraph below).

- A static page with no build step: `rybex-ai-workshop.html` (the shell), `css/`, `js/` and `i18n/` next to it (see Code layout below). Also shipped: the vision photo set (`assets/vision-generated/web/`) and four product images for the company site (`assets/products/`). Team work is stored in the browser and can be exported as a team file.
- Rybex data: 210 photo-style can images (`assets/vision-generated/web/`, 320×400 WebP, about 3 MB; drawn images are the fallback when they cannot load; the photos load on the first visit to the vision lab or the image folder), plus synthetic sales history, sensor readings, complaints and company documents (12: procedures PROCES-01…08, a seamer workstation instruction, a quality FAQ, a procedure-change notice and one archived procedure version).
- Every lab is one guided exercise in building an AI solution, in five steps that match the five room stations: Zadanie (the task), Dane (the data), Budowa (build), Eksperyment (run, look at the mistakes, change one thing, save) and Wynik (the final check on data the solution did not see). A step strip in the lab header (`#labSteps`) shows where the team is. A result is always shown on its own (counts and mistakes), never against another method, another model or another run.
- Five tracks: vision, knowledge assistant, complaints, demand forecast, machine failures. The vision set includes borderline cases (shallow dents, small label shifts, light smudges, harmless glare, soft print). All keep the practice set / final test discipline: the vision, knowledge-assistant and complaints labs have a hidden final test that is revealed once; the forecast is checked on the last months hidden from the model, the machine-failure model on minutes 300 to 600.
- Vision, knowledge assistant and complaints are built with a language model (DeepSeek V4.1 Flash or Claude Haiku 5.5 via OpenRouter): the team writes the instruction (prompt versions), chooses labelled examples and, in the knowledge assistant, sets the document search; an optional LLM judge grades the assistant's answers. Tokens, cost and time are shown for every call. The model's weights are not changed, so the app never calls this training.
- Forecast and machine failures train one model each in the browser ("Wytrenujcie model", `#fcTrain` and `#mtTrain`): the forecast model learns trend and seasonality from the months it is shown, the machine-failure model learns each chosen sensor's normal level and usual fluctuation from minutes 0 to 300. Both show what the model learned before any score.

The app also runs opened straight from disk (`file://`). There the photos come from `assets/vision-generated/web/photos.js`, a generated bundle of the same WebP files. Rebuild it whenever the images or their `manifest.json` change (`node tests/ai.mjs file` fails while it is out of date):

```bash
node tools/vision-bundle.mjs
```

Model calls go through the Cloudflare Worker in `worker/`, which holds the API key and checks a class code; see [worker/README.md](worker/README.md). Without the Worker the three language-model labs can only show recorded answers for their default runs (next paragraph); the forecast and machine-failure labs run entirely in the browser and need no server.

`replay.json` holds recorded answers for the default model runs and is used when the Worker is unreachable; the AI panel then says that recorded answers are shown, and each such answer is labelled as recorded. A recorded answer is found by the exact request body, so an edited prompt or any other changed setting is never answered from the recording. Re-record it only when a default prompt, the photos or a default setting changes (about $0.04 of team 8's budget). A class code must still be typed for a recorded answer to be shown. The default complaints and knowledge-assistant runs are served from the existing recording. The vision answers in it were recorded on the earlier photo set (before the generated dataset and its WebP re-encode), so no current vision request matches: without the Worker a vision run ends with the "no connection" message until `replay.json` is re-recorded.

```bash
CC='class-code' node tools/record-replay.mjs
# dry run against the mock Worker: no real calls, writes outside the repo
CC=test-code AI=http://127.0.0.1:8800/mock OUT=/tmp/replay-mock.json node tools/record-replay.mjs
```

The dry run checks that the tool still drives every lab to the end. With `AI` set, `OUT` is required and may not be the repository's `replay.json`, and the tool stops before any call if the app does not use the given URL (the app accepts only a localhost `?ai=`). `PORT` moves the tool's local server off 8800. Its request keys should match `replay.json` except for the LLM-judge requests, which embed the mock's answers, and the vision requests (see above).

## Guided path

The start page's main button and agenda follow the same nine steps. A path bar under the header shows the current step ("Jesteś tutaj: krok n z 9"), a hint for the next step and a button that goes to it (or, on the step's own page, focuses the thing to do there; when that thing is an action – train the model, save the result, export the report – the button performs it, so no second, identically named button has to be clicked. The one-time test reveal and paid model runs stay focus-only). The bar only recommends: navigation is never locked, the menu always works, and so do the keys `1`–`7` except while typing in a field or with the photo inspector open. The nine steps (`PATH_STEPS`, Polish label first):

1. Przydział i strona firmy (Team set-up and the company) – read the incident memo, enter the team name, read the notice about the returned lot on the company site.
2. Cykl projektu (Project lifecycle) – the lifecycle demo and its quiz.
3. Wybór zadania (Choosing the task) – pick one of the five tracks and write a success criterion.
4. Dane zadania (Task data) – open the data file of the chosen task.
5. Demonstracje (Demos) – the demos the task needs, each followed by a quiz.
6. Laboratorium, runda 1 (Build lab, round 1) – build the first version of the solution, run it and save the result in the log. On the language-model tracks that is a model run with the team's instruction and examples; on the forecast and machine-failure tracks it is a trained model. The first version may keep the lab's starting settings.
7. Rundy 2–3 i test (Rounds 2–3 and the test) – save at least three experiments (`MIN_EXPERIMENTS`), changing one thing at a time; the same result cannot be saved twice. On the tracks with a hidden test set, reveal the final test once ("Odsłońcie test końcowy", open once one experiment on the practice set is saved), run the model on it and save the result while it is visible. The step is done only when that final result is in the log; a reveal alone does not complete it. Team files from before this rule keep the step done if an entry was saved after a test view. On the forecast and machine-failure tracks (no hidden test set) the step is done with the three experiments: every one of them is already scored on data the model did not see.
8. Ryzyka i wdrożenie (Risks and go-live) – answer at least four risk cards and take the four go-live decisions.
9. Raport i wystąpienie (Report and presentation) – export the report; the final-project checklist is folded by default and stays fully usable when opened. Above the export buttons the page lists what the report would still show as empty (team name, success criterion, a saved lab result, diagram, go-live decisions, unanswered risk cards, unticked checklist items), each with a link to its place; the export is never blocked. Checklist items the team's work already shows can be ticked with one button.

What participants meet along the way:

- An incident memo (lot RYB-261031-L2 returned by a retail chain) and a short onboarding card on the start page; a case bar keeps the incident in view on the working screens once a task is chosen.
- Glossary terms underlined in the text, with a tooltip on hover or keyboard focus.
- A plain-language recap of each result with two headline numbers; the other metrics (F1, accuracy, the confusion matrix and so on) are folded under "Więcej miar" (More metrics).
- Two-question quizzes after the demos (lifecycle, tokens, RAG, data split, metrics).
- In every lab, the five-step strip and a save to the log with a ready-to-save line ("Gotowe do zapisu (eksperyment n z min. 3)"). The forecast and machine-failure labs show their scores only after the model was trained on the current settings (before that, a short placeholder asks for it; after a change of what the model learns from, it asks to train again); the forecast lab names the hidden months. The machine-failure lab, log and report lead with breakdowns detected, alarm delay and false-alarm minutes, in plain shop-floor numbers (no z-score or F1 terms on screen; F1 stays only in the folded "Więcej miar" panel), and a callout says the alarm comes during the breakdown, not before it. The team's own success criterion is shown next to the headline result in the lab and the report (never judged automatically). In the vision, knowledge-assistant and complaints labs the final test can be revealed once one experiment on the practice set is saved; while it is visible the instruction and the examples are locked. Old team files whose test set was already revealed or viewed are exempt from the reveal gate; their baseline entries are dropped on load and their rules-mode entries stay readable as older records ("starszy zapis").
- One vocabulary for the data parts in every lab, log, report and badge: "zestaw ćwiczeniowy" (practice set, where you tune) and "test końcowy" (final test, hidden and revealed once), each explained once by a glossary tip. Internal keys (`dev`, `val`, `test`) are unchanged.
- Plain result on the hidden-test tracks: the lab (after the test) and the report headline give counts on one data part (knowledge assistant "poprawne odpowiedzi 1 z 6", complaints "kategorie 17 z 24 · groźne 6 z 6", vision defects found), with the success criterion beside it. Complaints rows in the log show the dangerous-complaint count next to the categories.
- Knowledge assistant: an answer citing the archived document gets a red "ŹRÓDŁO ARCHIWALNE" tag, and the weak-match warning sits above the answer.
- The language-model panel opens with "Koszt pokrywa prowadzący – nic nie zepsujecie."; API, tokens and prices are folded under "Dla zaawansowanych". The complaints lab shows Polish category names and column names; the model still receives the category ids.
- From the third experiment on, saving to the log requires a one-sentence conclusion (it goes into the report); the first save of the final test result is the exception.
- One challenge per track (for example "Najtrudniejsze puszki" in vision, an out-of-scope question in the knowledge assistant).
- Risk cards on a sixth demo tab, "Ryzyka" (personal data, hallucination, AI Act, bias, prompt injection), told through Rybex staff.
- Four go-live decisions on the architecture page (where the model runs, who may stop the line, what is monitored, how often it is reviewed); who may stop the line and what is monitored are worded for the team's track. Each answer shows its cost at once. For the complaints and knowledge-assistant tracks, choosing the cloud or hybrid option without the "Anonimizacja danych osobowych" (personal-data anonymisation) component in the diagram shows a privacy warning with a button that adds the component or switches to local processing.
- Seven badges (fair test, three experiments, demos passed, personal data protected and others), announced when earned. The counter and the strip show only the badges the team's track can earn: 6 on vision and complaints, 7 on the knowledge assistant (its challenge badge is marked optional), 5 on the forecast and machine-failure tracks, which have no hidden test to reveal.
- "Pokażcie przykład zespołu" (Show an example team): a read-only preview of a finished, deliberately imperfect forecast project. The team's own work is not touched, the model does not run and report export is off while the example is shown.

## Walk-in rooms

Each lab task opens in its own first-person 3D room: line 2 of the production hall for vision, the quality office for the knowledge assistant, customer service for complaints, the dispatch warehouse for the forecast and the retort machine room for machine failures. The room has five stations, one per lab step: Zadanie (Brief), Dane (Data), Budowa (Build), Eksperyment (Experiment) and Wyniki (Results); the station keys in the code are still `brief`, `data`, `method`, `experiment`, `results`. A station opens a panel beside the room with the same lab controls as the plain page, so scores, saved runs and team files are the same in both views.

- Controls: click a glowing station or its button in the toolbar. Walk with WASD or the arrow keys, drag to look around, click the floor to walk there. `Esc` closes the panel, and ‹ › go to the previous or next station. Typing in a panel never moves the camera.
- Order: the stations are numbered 1 to 5 in the toolbar and on their labels in the room. The first one not opened yet is the next step: its label turns yellow and the guide at the bottom names it, with a button that goes there. An open panel shows "Krok n z 5" (Step n of 5), one line on what to do there and a "Dalej" (Next) button to the following station. Visited stations get a tick; the count starts again after a reload. From the experiment station on, the guide follows the lab's own progress instead of the visit order: "Eksperyment 1 z 3" (build the first version, run it, save it), "2 z 3", "3 z 3" (the toolbar button counts them, e.g. 1/3), then the final test on the team's own task where the track has one, then the results station with the saved experiments and the final result. While work is left at the open station its panel has no "Dalej" button.
- Chrome: while the room is shown, the team bar, the page title and the footer are hidden, so the menu, the path bar, the task tabs and the room fill the window. The 2D view has them back.
- Type: text inside the rooms (signs, screens, station labels) is Raleway, loaded with the page's Google Fonts stylesheet; text drawn before the font arrives is redrawn once it is in. Terminal screens stay monospace and the whiteboards keep their handwriting.
- 2D toggle: "Widok 2D" (2D view) in the toolbar switches to the plain page, and "Wejdźcie do pokoju 3D" (Enter the 3D room) switches back. The choice is saved with the browser state. `?rooms=0` forces the plain page without saving anything (the older test suites use it).
- Fallback: without WebGL2, or when the room fails to start, the lab is shown as the plain page with a one-line notice. If the GPU drops the 3D view later, the toolbar and panels stay and only the 3D picture goes.
- The room shows real app data: can photos on the vision monitor (they replace the drawn cans as soon as the photos load), document codes, complaint categories, one product's sales and a vibration window.
- Look: each room has one side key light with shadows and weak fill. The engine adds the rest for every room: soft contact shadows under whatever stands on the floor (traced from the room's own geometry near the floor, or a hand-made `contacts` list in the room spec), an HDR reflection environment for metal, glass and gloss paint, a pool of light on the floor at each station that brightens with the station's glow, neutral tone mapping (`exposure` per room) and a light vignette. `kit.mat` takes `roughMap` (uneven gloss on large surfaces) and `bump` (relief from the colour map); `kit.rbox` and a batch's `rbox` make bevelled boxes for parts seen up close.
- Files: `rooms/engine.js` (camera, stations, panels), `rooms/room-*.js` (one per track) and `rooms/rooms.css`. They are classic scripts, so the rooms also work from `file://`.
- Three.js r170 is vendored in `vendor/three/`. The app loads `vendor/three/three.global.js`, a classic-script wrapper that sets `window.THREE`, because module scripts do not load from `file://`. Rebuild it after replacing the vendored files:

```bash
node tools/build-three-global.mjs          # writes vendor/three/three.global.js
node tools/build-three-global.mjs --check  # exits 1 when it is out of date
```

Room tests are in `tests/rooms.mjs` (not part of `npm test`), sections `engine look integration file`; without a section all four run:

```bash
cd tests
node rooms.mjs                    # all sections
node rooms.mjs integration file   # the real app in the lab, and the app opened from disk
ROOMS_TRACKS=rag,forecast node rooms.mjs look
ROOMS_GL=swiftshader ROOMS_PICK_MS=8000 node rooms.mjs   # no GPU: software renderer, slower clicks allowed
```

- `engine` checks the engine on a test page (`tests/rooms-fixture.html`). `look` builds every room and checks draw calls, frame time, brightness, labels and reduced motion. `integration` runs the real app through the mock Worker on port 8799: panels, seen-progress, the baseline equal to the plain page, typing, a model run and its stop, track, language and team switches, jump links, the 2D toggle, the fallback, scrolling, camera framing, the photo refresh and resizing. `file` opens the app from disk.
- WebGL runs on the machine's GPU through ANGLE (`--use-angle=gl`). `ROOMS_GL=swiftshader` uses the software renderer instead. It is about ten times slower, so raise `ROOMS_PICK_MS` (how long a click on a station may take to open it, default 2000).
- Run it on its own: a second GPU-heavy browser at the same time can crash the test browser. Screenshots go to `scratch/rooms/` (not committed).

## Company site

The route `#/rybex/<page>` shows the Rybex website inside a frame, with a back button to the workshop. Pages (`RYBEX_PAGES`): `home`, `about`, `products`, `quality`, `news`, `contact`, `career`, `intranet`. It is not a menu item; the path bar and links in the app lead to it.

- The contact form writes to the team's inbox (`team().inbox`, at most 20 entries). The inbox is shown in the complaints lab ("Zgłoszenia z formularza www"), with the category the sender chose. It is kept apart from the 60 evaluation complaints: never part of the dev or test set and never sent in model runs.
- The intranet page shows requests from Rybex staff that link to the labs, the process documents and the inbox count.
- The product images are `assets/products/*.webp` (four packshots), used only by the site. If one cannot load, a neutral tile with the product name takes its place.

## Team files

Team files are JSON with `version: 3` (`FILE_VERSION`). Version 3 adds the path, onboarding, site, inbox, quiz, challenge, risk, badge and go-live state and the vision prompt versions. Version 2 files still load: missing fields get their defaults and the log is kept.

### Trainer mode

Open the app with `?trainer=1` (for example `rybex-ai-workshop.html?trainer=1#/trainer`). The flag is never saved: a reload without it is the participant view. It is a convenience, not access control: any participant who knows the parameter can add it to the address. It adds a "Tryb prowadzącego" chip in the header that opens `#/trainer`, where the trainer sees the progress of the eight local team slots of this browser and of team files imported from the participants' laptops (select several JSON files at once; they stay in memory only and are never written to a slot). The tables show the task, path steps, experiments, test views, whether the final test result is saved, quizzes, risk cards, go-live decisions, notes, news read, intranet opened and contact form sent, never a test-set score; "Pobierz CSV" exports both tables for Excel. The `replay.json` download in the AI panel and the skipping of the reveal gate and of the note requirement are also trainer-only. The class code never appears in the trainer view, the CSV, reports or team files.

## Presentation

The Polish workshop deck is `prezentacja.html`, served at `https://rybex.warsztaty-ai.com/prezentacja.html`. Press `F` for full screen and `S` for the speaker view. The deck loads reveal.js from a CDN (jsDelivr), so open it once on the venue network before class: if jsDelivr is blocked there, it falls back to one long page.

Four `[uzupełnij: …]` placeholders on slides 1, 23, 25 and 27 must be filled in before each workshop; `node tests/presentation.mjs facts` lists them.

The screenshots in `assets/presentation/` come from the real app. Refresh them with `node tools/presentation-shots.mjs` (modes `base`, `ai`, `all`). The two AI shots need the class code and spend a few cents of class budget: `CC=<class code> node tools/presentation-shots.mjs ai`. The class server caches identical requests, so a retake on the same day as the previous one is refused by the tool when the run comes back cached; change the prompt sentence in `aiShots` and run again.

## Code layout

Classic scripts and plain CSS, no bundler, no modules (they must keep working from `file://`, where Chrome blocks module imports).

| Path | What it holds |
|---|---|
| `rybex-ai-workshop.html` | The shell: head, markup, and the ordered `<link>` and `<script defer>` tags |
| `css/tokens.css`, `css/app.css`, `css/overrides.css` | Design tokens, the app styles, and the later focus-pass layers that override `app.css` on purpose (fold a rule back into `app.css` when you touch it) |
| `js/*.js` | The app in load order: `data`, `docs`, `constants`, `state`, `helpers`, `vision-engine`, `ai-client`, `logging`, `routing-path`, `views-start`, `site-personas`, `demos`, `lab-core`, `lab-vision`, `prompt-versions`, `lab-rag`, `lab-complaints`, `lab-forecast`, `lab-maint`, `challenges`, `golive`, `deliver`, `trainer`, `main` |
| `i18n/en.js` | The English texts, keyed by the Polish text |
| `vendor/icons.js` | The lucide icons the app uses (`node tools/build-icons.mjs`) |
| `vendor/three/`, `rooms/` | three.js, the 3D room engine and one script per track room, fetched when a lab first needs them |

- The `js/` files share one global scope and run in the order of the `<script>` tags. A function declaration is not hoisted across files, so code that runs while a file loads can only call what an earlier file defined (`rng` and `gauss` sit at the top of `data.js` for that reason).
- Texts: `T('Polish text')` returns the Polish text; the English comes from `i18n/en.js`, which is fetched only when an English reader needs it (at start, or when the language is switched). `T('Polish', 'English')` keeps both inline, for texts with `${}` parts or a Polish text that needs more than one English version. Add the English of a new `T('...')` to `i18n/en.js`; `node tests/i18n.mjs` fails when an entry is missing or unused. `?i18n=all` loads the dictionary for everyone (the test suites flip the language directly).
- The 3D stack loads on demand: three.js, the engine and the one room script of the team's track, when a lab first needs them. Until then the lab shows as a page, then the room replaces it.

## Tests

```bash
cd tests && npm install
npm test                   # the suites below, one after another (presentation.mjs without `ai`)
node i18n.mjs              # every T('...') has an English entry; the dictionary is fetched only for English readers
node ai.mjs                # app probes against a mock Worker (no real calls)
node vision-realistic.mjs  # photo asset loading and fallback
node worker.mjs            # Worker contract against a mock OpenRouter
node guided.mjs [section]  # guided path probes; run one or more sections by name
node presentation.mjs [section]  # slide deck probes; no section runs shots, deck and facts. `ai` runs only when named: it makes one /status call with a wrong code and spends nothing (the paid part is `presentation-shots.mjs ai`)
```

`guided.mjs` sections: `smoke state gloss recap story path quiz labstart visprompt note exit1 gate site world risk golive challenge compare badges example exit2 trainer a11y copy final fresh ragdata ragtypes simplify`. The WCAG contrast walker used by its `a11y` section and by the regression suite is shared in `tests/contrast.mjs`.

`worker.mjs` starts `wrangler dev` on port 8787 (and a mock OpenRouter on 8799). An aborted run can leave port 8787 taken; free it before the next run.

`ux-audit/regression.mjs` holds the UI and accessibility regression checks. It needs the app served on port 8794 and Playwright importable from `ux-audit/` (ESM ignores `NODE_PATH`, so link the test dependencies once). Run it on its own, not at the same time as `npm test`:

```bash
ln -sfn ../tests/node_modules ux-audit/node_modules   # once; ux-audit/* is gitignored
node tests/mock-server.mjs 8794 &                     # serves the app on http://127.0.0.1:8794
cd ux-audit && node regression.mjs
kill %1                                               # stop the server
```
