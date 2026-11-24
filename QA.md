# MONSOON verification — 2 November 2026

## Release 10 verification — 24 November 2026

Package version 1.3.0, with no change to the simulation physics or model version (monsoon-1.3). All 48 unit tests and three browser tests (smoke, accessibility, idle rendering) pass on the production build locally. CI passed on the idle-rendering and text-size merges to main.

Idle rendering, measured by counting WebGL draw calls in Chromium with software WebGL:

- **Idle:** the production build makes no draw calls while nothing moves; before the change it made about 1,440 every two seconds. On the live site, an idle page made 72 draw calls in three seconds, which is two frames from one wake-up (any app update wakes the scene for two frames), against 1,350 in two seconds during playback.
- **Waking:** moving the timeline, dragging the camera and playback all draw, then return to idle. In the test browser (about 10 frames a second) the scene settled about 1 second after a timeline change, 2.2 seconds after pausing, and 6.5 seconds after a drag. Camera damping is per frame, so the glide is far shorter at 60 frames a second.
- **Animations still play:** the landmark camera glide, the placement hover preview, district painting, linked cameras in the comparison view (both views drew after dragging one), and playback with reduced motion, which redraws only when the minute changes (282 draw calls in two seconds against 1,406 with full motion).
- **Tests still run one at a time.** Running the three browser tests in parallel failed: each keeps its scene busy while it works through the app.
- The accessibility scan now waits for fade-in animations. Once the scene stopped using the CPU, it reached the Planning lab mid-fade and reported false contrast failures.

Readable text:

- 85 font-size declarations changed: all-caps labels are at least 9 px and other text at least 10 px. Some phone labels were 5–6 px.
- At 1440 × 900 and 390 × 844 there is no horizontal overflow. On phones the timeline phase labels and the footer wrap onto two lines. Name tags inside the 3D scene are drawn by the scene and are unchanged.
- Four panels lost a stale "Release 08 / Shape the city" label, and the welcome heading reads correctly on phones ("Your first plan starts with one change"); both were checked in a browser.

No physical-device, Safari, screen-reader or sustained frame-rate benchmark was performed.

## Release 09 verification — 21 November 2026

A maintenance release (package version 1.2.0) with no change to the simulation physics or model version (monsoon-1.3). Existing mission and conservation fixtures return their original results.

All 48 automated tests pass: the 42 existing checks plus four storage tests and two worker-transfer tests. The storage tests run the real IndexedDB code against an in-memory database. They cover backing up an unreadable autosave instead of overwriting it, keeping only the newest three backups, restoring valid scenarios, and listing the Planning lab library when one saved plan cannot be read. The transfer tests check that every result buffer is sent once, including when the same result is both baseline and design. Type checks now cover the tests, the smoke test and the build configs.

A new Playwright smoke test runs the production build in Chromium. It checks for a live WebGL 2 canvas, loaded self-hosted fonts, a storm run that fills the scenario results, and the Planning lab opening, with no console errors or warnings and no requests to other hosts. Deliberately breaking the build with a duplicated transfer buffer, and separately with an empty font file, made it fail. GitHub Actions now runs type checks, unit tests, the build and the smoke test on every pull request.

Measurements:

- **First load:** the script needed before the panels appear is 362 kB (114 kB gzipped), down from 926 kB (260 kB gzipped). three.js 0.187 (568 kB, 140 kB gzipped; 0.180 was 517 kB, 130 kB gzipped), the 3D scene and the Planning lab load afterwards. The chunk-size warning limit was raised to 600 kB so the lazily loaded three.js chunk no longer triggers Vite's advisory; that chunk is not smaller.
- **WebGL (measured with three.js 0.180):** in Chromium, 70 consecutive district rebuilds caused no lost contexts. Before the fix, 11 replaced contexts were still alive afterwards; with `forceContextLoss()` each is released at once. Each rebuild still costs a main-thread task of about 75 ms, which this release does not change.
- **Fonts:** DM Sans and Manrope are served from the app's own origin as four variable woff2 files (95 kB in total); the Google Fonts request is gone.

Accessibility (automated only):

- **axe-core 4.14 scan** (WCAG 2.1 A and AA rules) of the studio after a run, all five other sidebar tabs, the comparison view, the scenario report, field notes, help centre, graphics panel and Planning lab. Two issues were found and fixed: the header link's accessible name omitted its visible text (WCAG 2.5.3), and the scene container's `aria-label` had no role to attach to. The scan is now part of `npm run test:e2e` and CI.
- **Contrast on gradients:** axe could not decide 56 desktop and 47 mobile (390 × 844) text elements because they sit on gradient backgrounds. Measuring the rendered background behind each, with text hidden, put every one above its WCAG AA threshold; the lowest was 4.73:1 for the small Bangla district subtitle.
- **Keyboard focus:** tabbing through the studio reached 41 distinct controls, and each showed a visible focus ring.
- **Not covered:** no screen reader, voice control or keyboard-only task completion was tested. Much secondary text is small: labels and captions are often 7–8 px, and a few are 5–6 px. WCAG sets no minimum size, but this text is hard to read without zooming.

Running the browser tests in parallel starved the simulation of CPU (software WebGL renders the scene continuously, even when idle), so Playwright now runs them one at a time.

Evidence: `docs/hero.jpg`, captured from the Protect the clinic demo at minute 24. No physical-device, Safari, screen-reader or sustained frame-rate benchmark was performed.

## Release 08 verification — 10 November 2026

All 42 automated tests pass: the 35 existing checks plus seven district tests. New coverage includes preset geometry, protected blocks, valid roof runoff receivers, immutable painting, invalid layouts and mission rejection, placement collisions, layout-aware routing, legacy model and share-link migration, saved-plan comparison, candidate validation and custom-map water conservation. The one-block tutorial fixture absorbs 85.456 m³ more water; existing mission fixtures remain unchanged.

Browser verification in the Chromium-based in-app browser:

- Completed the industrial park tutorial: 85 m³ extra absorption and -0.03 ha peak flooded-area change. Verified the comparison action and explicit inclusion of any additional design edits in the explanation.
- Previewed and cancelled a garden preset without changing the active industrial layout; applied the dense preset and verified undo/redo restore the corresponding district names and maps.
- Painted buildings and a road using the minimap, confirmed stale-result invalidation and successful reruns, and verified the edited garden layout survived reload.
- Started the clinic mission, verified the district editor was locked, and returned to the saved custom sandbox with its edits intact.
- Checked desktop and 390 × 844 mobile layouts without horizontal overflow. Mobile minimap painting worked; map and overlay dimensions align. Corrected a world-position offset in building geometry and fixed light button hover text contrast.
- Verified 34 function guides, the district explanation and its navigation into the editor. Browser console had no warnings or errors during the final editor checks.

Evidence: `docs/release-08.png`. The release retains the existing terrain and the 10 m simulation grid. Land-use changes are unpriced experiments, not costed development proposals. No physical-device, Safari, formal accessibility or sustained frame-rate benchmark was performed. The production bundle retains Vite's size advisory.

## Release 07 verification — 8 November 2026

All 35 automated tests pass. New tests cover immutable move/copy edits, placement/budget/count restrictions, undo/redo branching, bounded road routing and alternate paths, braking/recovery, and the combined services challenge plus share-link identity. The verified 96-credit fixture reduces peak flooded area by 13.14%; all three service goals pass and the unchanged baseline fails. Modified challenge conditions cannot earn completion.

Browser verification in the Chromium-based in-app browser across 7–8 November:

- Loaded the Essential services demo, checked all three completed objectives, and verified the 96-credit budget and 13.1% displayed reduction.
- Inspected road and service overlays, selected-minute service cards, baseline interrupted reference route versus the design's open clinic route, playback, paused traffic, and reduced-motion stationary markers.
- Moved a basin from 59,63 to 60,63 without extra cost. Occupied destinations disabled submission. Copy remained disabled at 96 credits, became available after removing a drain, and created a distinct placement. Button undo/redo and Ctrl+Z restored the expected plan; edits invalidated stale results.
- Verified 32 guides and navigation from the traffic guide to the City controls.
- Tested 1440 × 900 desktop and 390 × 844 mobile with no horizontal overflow. Mobile move-by-coordinate and undo succeeded.
- Both comparison canvases measured approximately 1.249 backing pixels per CSS pixel, within the 1.25 cap. Static shadows, fewer comparison vehicles and cached route fields reduce rendering work. No sustained frame-rate benchmark was performed.
- Corrected road-overlay ordering so it does not obscure vehicles, and gave rickshaws three visible wheels. The final comparison scene produced no browser warnings or errors.

Evidence: `docs/release-07.png`. No physical-device, Safari, formal accessibility or traffic-model validation was performed. Vehicle speed and trips are illustrative; the 10 m hydrology grid and monsoon-1.2 physics are unchanged. The production bundle still has Vite's size advisory.

## Release 06 verification — 7 November 2026

All 30 automated tests and the production TypeScript/Vite build pass. Vite retains its large-bundle advisory; code splitting is not part of this release.

The release adds graphics-only effects and a selected-minute inspector while retaining model monsoon-1.2. The existing mission/conservation fixtures retain their original results. New tests cover quality selection and invalid saved preferences, storm-to-recovery atmosphere, soil snapshot accounting, modified elevation/roof sampling/blocked drainage explanations, and bounded architecture instance buffers.

Browser verification in the available Chromium-based in-app browser:

- Switched Low, Balanced and High without a page reload; Auto resolved to Balanced at desktop width and Low at 390 px. Saved Auto and reduced-motion preferences survived reload.
- Inspected detailed facades, roof tanks, balconies, awnings, road markings, changing light, rain and subtle water highlights. Console contained no WebGL shader errors or warnings after switching presets and entering comparison/difference views.
- Selected clinic-adjacent cell 64,66 by keyboard coordinates. At minute 0 it reads 0 cm water and 30/30 mm remaining soil storage; at minute 120 it reads 54.0 cm and 24/30 mm. The explanation labels the sampled minute, modified elevation, absorption limit and nearest-intake distance.
- Verified the reveal comparison remains aligned with the richer architecture and weather. Decorative water effects are excluded from the difference map by implementation.
- Verified 29 searchable guides and navigation from the new graphics guide into the actual Graphics dialog.
- Inspected 1440 × 900 desktop and 390 × 844 mobile layouts. Fixed mobile header overflow by arranging all five navigation actions into two rows. Final mobile document has no horizontal overflow; the inspector and graphics dialog scroll within their available height.

Evidence: `docs/release-06.png`. No physical-device, Safari, formal accessibility, or sustained frame-rate benchmark was performed. Auto is a documented viewport/CPU heuristic, not an adaptive performance guarantee. Water shading and atmospheric changes are illustrative; they do not increase the simulation's spatial resolution or physical fidelity.

## Release 05 verification — 6 November 2026

All 25 automated tests pass. Five new cases cover Unicode scenario-link round trips, malformed/unsupported/oversized links, measured event ordering and access transitions, actual drain discharge snapshots, and overlay geometry plus demo validation. Existing conservation, deterministic simulation, mission, planning and migration tests remain passing.

Browser checks in the available Chromium-based in-app browser:

- Loaded the clinic demo from a placement/settings preview. The current plan was backed up to the library; the resulting design has four interventions and costs 92 credits.
- Computed impact cards show 0.68 ha less peak flooded area and 94 fewer minutes of clinic access interruption (143 baseline versus 49 design).
- Clicked the minute-91 access-return event and verified the timeline and landmark focus. Cinematic replay advanced automatically to its final chapter and paused; previous/next and exit worked. Reduced-motion replay starts paused and uses camera cuts.
- Inspected linked baseline/design reveal alignment at the clinic. Keyboard Home, End and PageUp changed the reveal boundary; the midpoint keeps both maps aligned. Inspected flood boundaries and recorded-drain markers.
- Copied a scenario link, opened its preview, cancelled without applying, then loaded and reran it. Both demo and shared-plan backups appeared in Planning lab. An invalid link displayed an error and kept the current plan.
- Verified Field Guide 05 lists 27 guides, including all four new Replay & sharing topics.
- Inspected desktop 1440 × 900 and mobile 390 × 844. Fixed mobile heading/action overlap and hidden activity-legend overlap during cinematic replay. Neither layout had horizontal document overflow. Shared preview fits the mobile viewport.
- The inspected browser console contained no warnings or errors. Evidence: `docs/release-05.png`.

The production build passes. Vite reports the existing large JavaScript bundle advisory; code splitting remains a future performance improvement. No physical-device, Safari, multi-user sign-in or formal accessibility audit was performed. Scenario links preserve current site access permissions; they do not make an owner-private site publicly accessible.

## Release 02 verification — 3 November 2026

All 15 automated tests passed, including six release-level checks for post-rainfall recovery, legacy migration, landmark routing, restoration/censoring, fixed challenge conditions and achievable challenge solutions.

Verified mission solutions (all within 100 credits):

| Mission | Peak flooded-area reduction | Target | Local objective                                               |
| ------- | --------------------------: | -----: | ------------------------------------------------------------- |
| Clinic  |                     13.963% |     5% | Connected at end; stable access returns 51 minutes after rain |
| School  |                      9.106% |     5% | Entrance below 10 cm at end                                   |
| Market  |                      3.677% |     3% | Access preserved at end                                       |

These are numerical fixtures, not real-world impact claims. The clinic solution is included in `samples/clinic-rescue.json` and costs 92 credits. Its peak entrance depth changes from 35.5 cm to 19.0 cm; sampled access interruption changes from 143 to 49 minutes.

Browser checks in the available Chromium-based in-app browser: started a challenge, imported the clinic solution, completed the full rainfall/recovery run, observed "Challenge achieved", focused the landmark and route, compared scenarios, jumped to rainfall end, and restored the saved sandbox (including its original one intervention and zero-recovery horizon). Desktop 1440 × 1000 and mobile 390 × 844 layouts were inspected; neither had horizontal document overflow. Inspected runtime logs contained no app warnings or errors. Reduced-motion behavior is implemented; physical-device testing, Safari and a formal accessibility audit remain outside this verification pass.

The earlier release evidence below is retained for traceability.

## Engine

Nine automated test cases cover zero-rain behavior, nonnegative finite depth, volume conservation, outlet limits, complete blockage, deterministic runs, intervention effects, time-step sensitivity, import validation and roof runoff routing.

The 20-minute four-intervention fixture (85 mm/h intensity setting) produced:

| Metric                    |      Baseline |      Improved |
| ------------------------- | ------------: | ------------: |
| Rain volume               | 10,902.526 m³ | 10,902.526 m³ |
| Surface storage at end    |  9,198.866 m³ |  8,823.759 m³ |
| Infiltration              |    669.719 m³ |    775.138 m³ |
| Drain discharge           |  1,033.940 m³ |  1,303.629 m³ |
| Flooded area above 0.10 m |       3.68 ha |       3.23 ha |
| Maximum depth             |       0.326 m |       0.511 m |

The greater maximum depth in the improved scenario is consistent with storing water in an excavated basin. It illustrates why one metric alone does not establish a better plan.

Volume residual was below 0.000001 m³ in this fixture. Halving the default time step from 2 s to 1 s changed aggregate end storage by approximately 0.0763%. A maximum-depth sensitivity assertion is also included. This is a limited numerical check, not calibration or proof of physical accuracy. Spatial resolution convergence and comparisons against analytical hydraulics remain future validation work.

## Browser checks

Verified in the available Chromium-based in-app browser on Windows:

- A 1440 × 1000 desktop viewport rendered the procedural city, controls, terrain, water and computed metrics.
- A 390 × 844 viewport showed responsive navigation and no horizontal document overflow.
- Added a garden through keyboard-accessible coordinate inputs. Budget changed from 100 to 82 credits; results became stale and playback/report were disabled until rerun.
- Ran baseline and edited scenarios; comparison displayed synchronized scenario results and distinct water states.
- Playback restarted at time zero; keyboard End moved the time slider to the completed state.
- Reduced-effects toggle updated its state.
- Report displayed rainfall, storage, infiltration, discharge and volume residual for both runs.
- Export downloaded a scenario JSON file. Importing that file succeeded.
- Local autosave restored the edited scenario following development reloads.
- Inspected browser warnings and errors: none were reported in the checked app logs.
- Studio screenshot is in `docs/studio.jpg`.

## Limits

No physical mobile device, Safari, Firefox or screen-reader session was available for this pass. No formal frame-rate benchmark, accessibility certification or audible sound-quality check was performed. Cancellation and every possible malformed-file combination have not been exercised in the browser. Engine import validation is covered by automated tests.

The model is educational and uncalibrated. Results apply to this fictional district and stated assumptions. Advanced GIS, optimization, multiplayer and hydraulic-network features remain outside this first release; see README.

# Release 03 verification — 2026-11-03

- All 20 engine, mission and planning tests passed. New checks cover candidate validity, budget limits, uniqueness and reproducibility; soil migration/validation/conservation; stress-condition caps and fixed placements; measured ranking and unmet targets; identical comparison conditions and actual leave-one-out differences.
- Production TypeScript/Vite build passed. Existing Three.js bundle size warning remains advisory.
- Local development server returned HTTP 200.
- Browser interaction, IndexedDB UI flows, mobile rendering and printed output could not be verified in this release: the in-app browser tool returned `browser.user is unavailable`; desktop Computer Use subsequently stopped because it could not reliably determine the browser URL. No browser safety checks were bypassed. Release 02 browser checks elsewhere in this file are historical, not Release 03 verification.
- Search explores a fixed catalog of at most 22 valid portfolios, not a global solution. Stress scenarios are deterministic comparisons, not a calibrated probability model. All financial costs and safety thresholds are illustrative.
# Release 04 verification — 2026-11-04

- Production TypeScript/Vite build passed; the existing advisory Three.js bundle-size warning remains. All 20 numerical, mission and planning regression tests passed.
- Local preview served HTTP 200. Browser checks covered six-step tour navigation, actual control highlights, back/direct-step/finish controls, saved welcome completion, and native Help dialog dismissal with Escape.
- Verified guide search (outlet returns two matching explanations), expandable explanations, direct navigation to Storm, empty-search recovery, and contextual Stress test help in Planning lab.
- Checked desktop at 1440 × 900 and mobile at 390 × 844. Neither had horizontal page overflow. Found and fixed a mobile overlap: the run-step tour now appears above the sticky Run storm button; measured bounds do not overlap.
- Reduced motion reports `animation-name: none` for the help dialog. The preference survived a reload and the map control/guide toggle stayed consistent. Restored normal motion after verification.
- Browser warning/error log returned no entries in the checked session. Screenshot: `docs/release-04.jpg`.
- Limits: no physical-device, Safari/Firefox, screen-reader, performance benchmark or PDF print-output pass in this release. Production access continues to require sign-in; local browser QA does not bypass that gate.
