# Changelog

## Unreleased: maintenance

No change to the simulation physics or model version (monsoon-1.3).

- **Saved work is no longer lost.** An autosave or sandbox this version cannot read is backed up (newest three kept) before the app falls back to the default district, instead of being overwritten. One unreadable saved plan no longer hides the rest of the Planning lab library. Startup storage warnings stay visible after the first storm run.
- **Faster first load.** The 3D scene (with three.js) and the Planning lab load on demand, and React and three.js have their own long-lived chunks. The script needed before the panels appear fell from 926 kB to 362 kB (260 kB to 114 kB gzipped).
- **No third-party requests.** DM Sans and Manrope are self-hosted variable fonts instead of a render-blocking Google Fonts import.
- **Lighter simulation hand-off.** The worker transfers result grids to the page instead of copying them.
- **WebGL contexts are released** as soon as the 3D scene is rebuilt after a district edit, rather than when the browser garbage-collects the old canvas.
- **Safety nets.** Storage tests run against an in-memory IndexedDB, tests and configs are type-checked, a Playwright smoke test exercises the production build, and GitHub Actions runs type checks, unit tests, the build and the smoke test on every pull request.
- An all-rights-reserved license notice.

## Release 08

- **District editor** paints 100 m blocks as parks, roads, buildings or sealed ground. Choose a 1-block, 3 × 3 or 5 × 5 brush, select a location on the minimap or city, preview, then apply. Keyboard coordinate fields and district undo/redo support precise editing. Pond and landmark blocks remain protected; mission maps stay fixed.
- **Three neighborhood presets** add a dense urban quarter, garden neighborhood and industrial district alongside the original Bangla Quarter. Each has distinct land use. Preview before applying; application clears improvements, while undo restores the previous layout and placements. Painted blocks can be reset separately.
- **Model integration** carries layouts through soil absorption, roof runoff, drainage, connected roads, service routes, traffic, inspectors and result maps. The matched baseline is the same preset without painted blocks or improvements. The 10 m physics grid, terrain and existing mission fixtures are preserved. Land-use editing is an unpriced planning experiment, separate from the 100-credit intervention budget.
- **Construction animation** grows changed buildings and trees into place while ground tiles settle over 650 ms. Reduced motion applies changes immediately. Current camera pose survives layout changes.
- **First green block** is a hands-on experiment that backs up the current plan, opens the industrial preset, guides one park conversion and shows measured absorption and peak flooding differences. The standard example absorbs about 85 m³ more water and reduces peak flooded area by 0.03 ha; results depend on settings and any additional edits.
- **Persistence and comparison** retain layouts in autosaves, the plan library, exports, reports and version-2 share links. Legacy plans and version-1 links remain accepted. Saved-plan comparison keeps each plan's layout under the selected weather; portfolio search skips candidates incompatible with custom buildings.
- Two new function guides bring the field guide to **34 topics**. Open **District → Start first experiment** to try the release.

This remains a fictional educational model, not a calibrated city-planning or emergency-response tool. Presets preserve the existing terrain and landmark locations; the editor does not provide arbitrary terrain sculpting or real geographic data.

## Release 07

- **City** adds road accessibility and service-access layers. Green roads connect to the northern boundary, amber roads are dry but disconnected, and coral roads exceed the illustrative 15 cm closure threshold. Service routes show current access or an interrupted dry-weather reference with its first flooded cell marked. Choose a service card or landmark to focus it.
- **Illustrative traffic** adds instanced cars, buses and three-wheel rickshaws. Vehicles choose dry routes toward the north or south edge, brake before closures, hold position if flooded, and resume after recovery. Vehicles reroute at cell centres when another path exists. Traffic moves during playback only; reduced motion retains stationary markers. Seeking backwards or jumping more than one recorded minute resets positions. Trips and speeds are decorative, not transportation or evacuation predictions.
- **Keep the city connected** combines clinic restoration, school protection and continuous market access with a 5% peak flooded-area reduction target. The Essential services demo uses 96 credits and achieves a verified 13.14% reduction. Its school peak entrance depth is approximately 0.1 cm; clinic access is restored by the end. All four missions have tested within-budget solutions.
- **Move / Copy** controls provide validated destinations and keyboard coordinate previews. Moves preserve identity and cost. Copies respect the 100-credit and eight-item limits. Cancel keeps the original intact. Undo/redo preserves up to 50 edits; Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y are supported outside text fields and dialogs. Loading another plan resets edit history.
- **Comparison performance** caps each canvas at 1.25 pixel ratio and 1024-pixel shadows, halves its decorative vehicle count, shares a bounded route-analysis cache, and updates static shadows only when geometry or quality changes. These are workload reductions, not a measured frame-rate guarantee.
- Three new function guides bring the field guide to **32 topics**. Service state transitions have a short halo pulse that respects reduced motion. The simulation physics and model version remain unchanged.

Try **Replay → Demos → Essential services**, then open **City → Service access** and compare the clinic's two futures.

## Release 06

- **Graphics** in the header offers persistent Auto, Low, Balanced and High presets. Auto uses Low below 760 px or on devices reporting four or fewer CPU cores, otherwise Balanced. This is a device heuristic, not an FPS benchmark. Presets change pixel density, shadow maps, rain/splash counts and decorative architecture, never simulation inputs.
- **Storm atmosphere** changes sunlight colour/intensity, sky light and distance fog using the selected minute's rainfall and time since rain ended. Reduced motion applies lighting changes immediately. The weather label shows the actual rainfall rate from the model.
- **Water** uses continuous depth colour, subtle procedural normal ripples and a bounded rain-splash pool. Shallow outer edges fade within their cells; the simulated grid and 10 cm flood boundary are unchanged. Difference maps retain their signed colours without decorative ripples or splashes. Rain, ripples and splashes stop when playback pauses or reduced motion is enabled.
- **Building details** add instanced windows, ledges, balconies, rooftop tanks, shop awnings, doorways, lane dashes and pedestrian crossings. Existing clinic, school and market landmarks are preserved. Low quality keeps the original core architecture.
- **Why is this flooded?** replaces the basic cell inspector. Click the map or use Inspect coordinates. It shows design-adjusted elevation, water depth, soil absorption limit, remaining finite soil storage at the selected minute, local intake activity, nearby-drain distance and covering improvements. Roof selections explicitly use the ground cell receiving roof runoff.
- Inspector explanations describe measured local conditions and potential contributors, not a causal attribution. Nearby-intake distance is straight-line distance and does not imply a hydraulic connection. Full-run measurements are separated from selected-minute readings.
- Soil snapshots share the engine's existing hydraulic parameters; the underlying physics and model version remain unchanged. Two new guides bring the searchable field guide to 29 topics.

## Release 05

- **Replay** lists measured storm, flood, access and recovery events with filters. Clicking an event moves the timeline and camera to its location.
- **Watch the storm** presents up to ten measured chapters, prioritizing landmark access loss and return. Pause, previous, next and exit controls remain available. Reduced-motion mode starts paused and uses camera cuts.
- **Activity overlay** shows coarse surface-head directions, the 10 cm flood boundary and drains that discharged during the preceding recorded minute. Moving markers illustrate direction, not water velocity or particle trajectories; motion stops when playback pauses.
- **Reveal slider** overlays synchronized baseline and design views. It supports keyboard range controls and preserves linked orbit cameras.
- **Impact** cards calculate signed differences in peak flooded area, clinic interruption and school entrance depth. Unchanged or worse outcomes are explicitly reported.
- **Demos** includes clinic rescue, overloaded drainage, gardens and paving. Each previews placements and settings, saves the current plan to the local library and then runs matching baseline/design simulations.
- **Share** creates validated scenario links containing the name, settings and placements. Recipients review a preview before applying; their current design is backed up first. Results are recomputed. Links do not grant site access; existing sign-in and owner-private permissions still apply.
- Four new searchable guides bring the field guide to 27 topics. Existing saved scenarios remain compatible; recorded drain activity does not change the simulation physics.

## Release 04

- A six-step, replayable guided tour highlights the actual mission, storm, intervention, run, comparison and planning controls. It changes navigation only; it does not replace the user's scenario or automatically place interventions. Skip, back, direct step selection and keyboard dismissal are supported.
- Help & guides contains 23 searchable function explanations, category filters, examples, limits and direct navigation to the related workspace. Empty searches have a recovery action.
- Collapsible contextual explanations sit beside rainfall, recovery, drainage, soil, placement and every Planning lab tab. Map controls reveal readable labels on hover or keyboard focus.
- A dismissible first-use welcome and state-aware next-action message explain what to do after editing, during calculation and after results arrive. Welcome dismissal/tour completion is remembered locally.
- Panel reveals, staggered result entrances, tool selection feedback, placement-ring pulses, press feedback and restrained welcome motion emphasize actions. Both the OS reduced-motion preference and the in-app control are supported; the in-app preference is remembered. UI animations stop in reduced mode, and Three.js receives the same reduced-effects setting.
- Mobile tour placement keeps the sticky Run storm button visible. Guides use native dialogs/disclosures, labeled search, visible focus and keyboard-accessible tour navigation.

## Release 03

Open **Planning lab** from the studio header.

- Save named plans and notes in a versioned IndexedDB library; preview, rename, duplicate, delete with undo, and restore. Saved plans retain model, storm, interventions and completed result summaries. Applying a plan first saves the current design as a backup, then reruns the selected design.
- Compare up to three saved designs under the current storm, soil, drainage and recovery conditions.
- Find up to three best measured alternatives from at most 22 deterministic portfolios, with adjustable budget and objective (peak flooded area, clinic access outage, school entrance peak or cheapest meeting a flood-reduction target). Search evaluates a fixed bounded set, not every placement or a global optimum. No qualifying target solution is explicitly reported.
- Stress-test fixed placements against heavier rainfall, additional drain blockage, half-rate soil absorption and a double-peak profile. Capped or identical scenarios are marked. Passing means clinic and market connected and school entrance below 10 cm at run end. Counts are not probabilities.
- Remove each intervention and rerun to calculate conditional contributions to peak flooded area, clinic outage and school peak depth. These signed effects are not additive.
- Print a visual report with placement diagrams, storage chart, baseline comparison, landmark outcomes, available stress/contribution results and assumptions. Use the browser's PDF destination to save a PDF. Planning analyses are session-local; saved library summaries persist on this device.
- Analysis runs in a cancellable background worker with progress and bounded summary caching. Native dialogs and keyboard-focusable placement previews support keyboard navigation. Motion respects reduced-motion settings.
- Soil absorption multiplier (0–2) modifies rates, not finite soil capacity. Models 1.0 and 1.1 migrate to 1.2 with multiplier 1; fixed missions require multiplier 1.

## Release 02

- Three guided, fixed-condition missions: Protect the Clinic, Keep the School Open, and Keep the Market Connected. Each has an explicit landmark objective and a peak flooded-area reduction target. Every mission has a tested solution within 100 credits.
- Recovery continues for 0–180 minutes after rainfall stops. Soil and drains remain active. Timeline controls jump to rainfall start and rainfall end; totals and reports cover the full run.
- Landmark entrance impacts include peak depth, duration above 10 cm, access interruption and stable restoration time relative to rainfall end. Outcomes are sampled at one-minute intervals for routing. No restoration within the selected window is reported as unknown, not zero.
- Short entrance connectors join the road graph. Green paths show a currently available route; red paths show a dry-weather reference route when no connection exists. A static red marker identifies the first flooded reference-route cell. Animated route markers illustrate connectivity, not travel speed.
- Landmark focus moves the camera, with immediate movement under reduced effects. Clinic cross, school solar panels and market awnings distinguish the landmarks. Hovering an intervention shows its radius and invalid placement state before clicking.
- Starting a mission preserves the sandbox in a separate IndexedDB record. Return to saved sandbox restores it. Scenario export/import includes recovery and mission identity. Legacy model-1.0 files migrate with zero recovery to preserve their original horizon.

For a reproducible demonstration, import `samples/clinic-rescue.json`, run it, and inspect Banglar Clinic. The 92-credit solution reduces peak district flooded area by approximately 13.96%, lowers peak entrance depth from 35.5 cm to 19.0 cm and restores access 51 minutes after rainfall ends. The baseline remains disconnected at run end. These are fictional-model results.
