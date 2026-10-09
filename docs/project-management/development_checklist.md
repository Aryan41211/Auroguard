# Aeroguard — Engineering Checklist

## Foundation

- [x] Create repository
- [x] Add docs
- [ ] Pin Unity version
- [x] Create Python environment
- [x] Create FastAPI skeleton
- [x] Add `/health`
- [x] Add Git ignore rules

## Data model

- [x] Scenario model
- [x] Threat model
- [x] Session model
- [x] Event model
- [x] Score model
- [x] Performance profile

## Scenario engine

- [x] Seed support
- [x] Scenario validation
- [x] Environment
- [x] Day/night
- [x] Visibility
- [x] Sensor quality
- [x] Threat count
- [x] Difficulty
- [x] Spawn timing
- [x] Anti-repetition logic

## Unity

> Delivered for the Phase 3 vertical slice by the browser Three.js client
> (`client/`); the Unity implementation is deferred to the optional Phase 8.

- [x] Main scene
- [x] Camera
- [x] Environment
- [x] Threat prefab
- [x] Threat movement
- [x] Scenario loader
- [x] Detection UI
- [x] Classification UI
- [x] Response UI
- [x] Timer
- [x] Session completion

## Backend

- [x] Scenario endpoint
- [x] Session endpoint
- [x] Event endpoint
- [x] Complete-session endpoint
- [x] AAR endpoint
- [x] Performance endpoint
- [x] Recommendation endpoint

## Scoring

- [x] Detection score
- [x] Classification score
- [x] Response score
- [x] Timing score
- [x] Penalties
- [x] Final score
- [x] Unit tests

## AAR

- [x] Summary
- [x] Metrics
- [x] Errors
- [x] Timeline
- [x] Weakness detection
- [x] Recommendation

## Adaptive training

- [x] Historical performance
- [x] Difficulty adjustment
- [x] Condition-specific weakness
- [x] Next scenario recommendation

## Content expansion (Phase 5)

- [x] Generator dimension coverage tests (environment, day/night, visibility tiers, sensor bins, threat counts)
- [x] Anti-repetition: 10 consecutive scenarios, no repeated configuration
- [x] Client fog/noise degradation by visibility tier (visual only)
- [x] Client night lighting adjustment (visual only)
- [x] Multi-threat HUD with per-threat stage and color coding (ground truth kept secret)
- [x] Per-condition metrics on performance endpoint (urban/rural, visibility tiers, sensor bins)
- [x] Condition-specific recommendation evidence

## Polish

- [ ] Better assets
- [ ] Better lighting
- [ ] Sound
- [ ] UI polish
- [ ] Error handling
- [ ] Demo mode

## Optional

- [ ] React dashboard
- [ ] VR
- [ ] advanced analytics
