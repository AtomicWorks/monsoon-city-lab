# How the MONSOON model works

MONSOON is an uncalibrated educational model. This page describes what it simulates, its units and its limits. The [README](../README.md) covers the app itself.

## Model and units

The domain is 100 by 100 cells, each 10 m by 10 m. Elevation and depth are meters, volume is cubic meters, time is seconds, rainfall inputs are mm/hour. The internal step defaults to 2 seconds, with a 2.8-second upper bound below the linear diffusion stability limit. Output snapshots are recorded every simulated minute. Playback speed affects viewing only.

Rain is spatially uniform. Roof rainfall is directed to adjacent ground; roof cells obstruct lateral flow. Infiltration is bounded by surface water, surface-specific rate and remaining soil storage. Neighbor exchange uses water-surface head differences with conductance 8 m²/s and donor-volume limiting. Internal transfers use a common state before simultaneous application. All domain edges are closed. Drains remove water at finite intake rates, scaled by blockage and a shared outlet capacity.

The accounting identity is rainfall = current surface storage + cumulative infiltration + cumulative discharge + residual. Green infrastructure increases infiltration or creates finite depressions. Depressions can overflow through the same conservative exchange mechanism. Overlapping depressions add storage and excavation depth; paving and garden infiltration benefits use the higher local rate, not a sum.

Flooded area counts cells above 0.10 m. Streets are unavailable above 0.15 m; connectivity is the fraction of street cells connected to any street cell on the northern boundary using orthogonal neighbors. These are illustrative thresholds, not safe-route advice. Costs are fictional credits. Pond cells start dry, representing available storm storage.

This is an uncalibrated educational storage-transfer model, not a shallow-water solver or real flood forecast. It omits sewer-network hydraulics, backflow, tides, groundwater feedback, evaporation, damage estimation and parameter uncertainty. Terrain and water heights are vertically exaggerated sixfold in the scene.

## Scope and next stages

This release implements the local planning workflow, guided challenges, recovery, landmark access, a bounded optimizer, stress scenarios and printable reports. Later stages remain: a drainage-network graph, calibrated uncertainty ensembles, real GIS import, cloud links and multiplayer. Building-level damage and evacuation models are not implemented.

Before treating outputs as research results, add analytical hydraulic benchmarks, a configurable mesh with resolution-convergence tests, measured field data, calibrated parameters and expert review. EPA SWMM can be considered for a separately validated network model; a 2D surface model would still require coupling.
