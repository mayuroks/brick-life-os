# Feature Specification: Speed Up CI Build & Plan

**Feature Branch**: `009-speed-up-ci-build`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "the github actions build and plan take 15 mins to build. what can be done to improve the time to 1 min. I already asked to disable transcribe completely"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer gets fast CI feedback (Priority: P1)

A developer pushes a change to the deploy pipeline. The CI "build" job (building the app image) currently blocks on slow steps. They want to see the build finish and get a deploy signal quickly so they can iterate without waiting ~15 minutes.

**Why this priority**: The whole build+plan pipeline currently takes ~15 minutes, which is the core pain being solved. Cutting build time is the highest-value slice.

**Independent Test**: Push a trivial change to the pipeline and measure wall-clock time from push to successful build completion. This delivers a measurable first step and works standalone even if "plan" optimization ships later.

**Acceptance Scenarios**:

1. **Given** a build runs with no related file change, **When** a commit is pushed, **Then** cached layers are reused and the build completes in under 3 minutes.
2. **Given** a fresh build (no cache), **When** the pipeline runs, **Then** it still completes successfully and establishes a cache for future runs.

---

### User Story 2 - Fast plan/provisioning step (Priority: P2)

A developer triggers a deploy that includes a "plan" phase. Today the whole build + plan chain takes ~15 minutes. They want the plan phase to be short so the end-to-end deploy from push to running service is under 1 minute.

**Why this priority**: Delivers the end-to-end 1-minute target but depends on the build optimization from User Story 1, so it is lower priority.

**Independent Test**: Trigger a deploy with the planning phase and measure total time from trigger to a running service. This can be tested independently once build caching is in place.

**Acceptance Scenarios**:

1. **Given** cached build artifacts and an unchanged infrastructure state, **When** a deploy runs, **Then** the end-to-end build + plan completes in under 1 minute.
2. **Given** no changes needing reprovisioning, **When** the plan runs, **Then** it skips unnecessary work and reports "no changes" quickly.

---

### Edge Cases

- What happens when the cache is unavailable or expired (e.g., GitHub Actions cache evicted)? The pipeline must still complete, just slower, and rebuild the cache.
- What happens when the slow step is genuinely needed for this run (e.g., a dependency version bump invalidates layers)? The pipeline must not silently skip required work.
- What happens if the network is slow while pulling base images? Steps that can run in parallel should not serialise.
- What happens when build and plan steps could run concurrently but share state? Dependency ordering must be respected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline MUST reuse previously built image layers across repeated runs so unchanged work is not redone.
- **FR-002**: The pipeline MUST skip or exclude components the user has disabled (e.g., transcribe) so they never add build time.
- **FR-003**: Steps that can run without blocking each other MUST run concurrently rather than sequentially.
- **FR-004**: The pipeline MUST still produce a correct, working build when no cached artifacts exist (cold start).
- **FR-005**: The plan/provisioning step MUST avoid repeating work already done and report no-op runs quickly.
- **FR-006**: The pipeline MUST fall back gracefully when caches are evicted or unavailable, completing (though slower) rather than failing.
- **FR-007**: Total build time reduction MUST be measurable and reported (e.g., a visible job duration or timing summary).

### Key Entities *(include if feature involves data)*

- **Build artifact**: The produced image/output of the build job; its layers are the units reused across runs.
- **Cache**: The reusable store of previously computed build layers; determines how much work is skipped.
- **Deploy pipeline**: The sequence of build + plan + deploy stages that must complete end-to-end.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cached build completes in under **1 minute** (from run start to build success).
- **SC-002**: The end-to-end build + plan pipeline completes in under **1 minute** when caches are warm.
- **SC-003**: A cold build (no cache) completes successfully and establishes a usable cache for the next run.
- **SC-004**: Repeated runs reuse cached work for at least **90%** of unchanged layers/steps.
- **SC-005**: The previously disabled transcribe component contributes **zero** time to the pipeline.

## Assumptions

- The bottleneck today is a combination of no/recently-broken layer caching, serialised steps, and included-but-unneeded components (transcribe), not raw network or runner latency.
- A 1-minute target applies to warm-cache runs; cold runs may take longer but must still complete.
- Existing hosting/deploy infrastructure (AWS, container registry) is reused; no new paid services are required to reach the target.
- Most pipeline runs are near-identical to the previous run (only config/trigger changes), so caching benefit is high.
- Correctness is non-negotiable: optimisations must never skip required build or deploy work.
