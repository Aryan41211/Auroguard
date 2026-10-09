# Aeroguard — Phase 5: Content Expansion

Based on the master roadmap, Phase 5 focuses on expanding content variety while ensuring scoring remains unaffected by visual-only changes.

## Tasks

1. **Generator dims**
   - Verify/enhance generator dimensions: urban/rural, day/night, visibility tiers (clear/reduced/poor), sensor_quality choices, threat counts (1,2,3,5)
   - Ensure difficulty factors are explainable (already implemented via compute_difficulty)
   - Optionally add more granularity to visibility tiers or sensor quality bins

2. **Cooldown anti-repetition**
   - Existing anti-repetition service is functional; verify capacity and max attempts are appropriate
   - No changes needed unless required

3. **Client night lighting, fog/noise degradation (visuals never affect scoring)**
   - Enhance client scene to add fog/noise particle effects for reduced/poor visibility
   - Ensure these visual effects do not influence scoring (scoring based solely on events)
   - Adjust night lighting intensity if needed

4. **Multi-threat HUD (2–3)**
   - Improve HUD to clearly display multiple threats (up to 3) with better visual distinction
   - Consider adding threat icons or color coding (while preserving ground-truth secrecy)

5. **Per-condition metrics**
   - Extend PerformanceProfile to include additional condition-specific scores:
     - urban_score, rural_score
     - clear_visibility_score, reduced_visibility_score, poor_visibility_score
     - high_sensor_score, medium_sensor_score, low_sensor_score (based on sensor quality bins)
   - Update adaptive service to compute these metrics
   - Update recommendation logic to consider these condition-specific weaknesses

## Definition of Done (DoD)

- 10 consecutive scenarios show no repeated configuration (anti-repetition working)
- Scoring remains unchanged by visual-only changes (fog/noise, lighting adjustments)
- All new metrics are computed and exposed via `/trainees/{trainee_id}/performance`
- Recommendations can be based on condition-specific weaknesses
- Client visual enhancements for night lighting and visibility degradation are present but do not affect scoring

## References

- Master roadmap: docs/plans/00-master-roadmap.md
- Build order: docs/project-management/build_order.md
- Module specifications: docs/modules/
- API contract: docs/api/openapi.yaml
