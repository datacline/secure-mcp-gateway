## Summary

<!-- 1-3 lines. What this PR changes and why. Reference any related issue: `Fixes #123`. -->

## Changes

<!-- Bullet list of meaningful changes. -->

-

## Test plan

- [ ] `npm run lint --workspace @datacline/smcp` clean
- [ ] `npm run build --workspace @datacline/smcp` clean (ESM + CJS in `dist/`)
- [ ] `npm test --workspace @datacline/smcp` passes
- [ ] `npm pack --dry-run --workspace @datacline/smcp` shows expected files only
- [ ] Manually exercised affected `smcp` commands against a running gateway
- [ ] Added regression test that fails on main and passes with this change (if fixing a bug)

## Breaking changes?

<!-- Yes / no. If yes, what breaks and how should consumers migrate? Bump the major and update CHANGELOG.md. -->

## Gateway / policy-engine changes?

<!-- The CLI is paired with `server-java/` (gateway) and `policy-engine-go/`.
     If this PR depends on changes in those services, link them. -->
