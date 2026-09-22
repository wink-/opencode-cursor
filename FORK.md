# Fork Notes

Personal fork of [Nomadcxx/opencode-cursor](https://github.com/Nomadcxx/opencode-cursor)
(`@rama_nigg/open-cursor`), maintained because upstream has been dormant since
2026-08-27 while OpenCode's stable plugin API moved. This fork makes the plugin
and its installer work correctly on **OpenCode v2.0.14**.

Upstream is tracked as the `upstream` remote; fixes live on `main`.

## Deltas vs upstream 2.5.8

1. **`src/plugin-v2.ts` — polyfill `ctx.catalog` when absent.**
   open-cursor 2.5.7+ requires the `ctx.catalog` plugin API, which exists in
   newer OpenCode builds (v1.18.32+ stable line / dev) but **not** in v2.0.14,
   crashing setup with:
   `TypeError: undefined is not an object (evaluating 'ctx.catalog.transform')`.
   When `ctx.catalog` is missing, the provider registration now adapts through
   v2.0.14's `ctx.provider.transform`, whose draft exposes the same
   `update(id, fn)` shape. On builds that provide `ctx.catalog` natively the
   fallback is inert.

2. **`src/cli/opencode-cursor.ts` — stop writing `"cursor-acp"` into the
   `plugin` array (and clean it up when found).**
   The upstream installer pushed the provider id into `opencode.json`'s
   `plugin` array as a v1-era enable marker. OpenCode v2 resolves every array
   entry as an npm package target, and no `cursor-acp` package exists, so the
   server logged `Plugin entrypoint not found: cursor-acp` on every start.
   The plugin stays enabled via its `provider.cursor-acp` config block plus
   the auto-loaded file in the plugin directory.

3. **`dist/` is tracked.**
   npm installs straight from the git URL (`npm install -g
   github:wink-/opencode-cursor`) then work on machines without bun. Rebuild
   with `bun run build` after any source change and commit the result.

4. **Version is suffixed** (`2.5.8-fork.1`) so loaded-fork vs upstream builds
   are distinguishable in logs and `open-cursor --version`.

5. **Perf defaults flipped (2.5.8-fork.2): agent pool and session resume are
   ON by default.** Upstream ships both features but disables them behind env
   vars read from the OpenCode server process (awkward to set, so in practice
   every request cold-starts a `cursor-agent` child: ~6-7s spawn + auth +
   gateway handshake, measured). The fork enables them by default; opt out
   with `CURSOR_ACP_AGENT_POOL=0` / `CURSOR_ACP_SESSION_RESUME=0` in the
   server env. (Measured effect: see the validation section below.)

## Install (any machine with node/npm + OpenCode v2.0.x)

```bash
npm install -g github:wink-/opencode-cursor
open-cursor install
```

Then restart OpenCode and verify with `opencode models | grep cursor-acp`.

## Syncing from upstream

```bash
git fetch upstream
git merge upstream/main          # conflicts are unlikely: both fixes are tiny
bun install && bun run build     # rebuild dist and commit it
npm view @rama_nigg/open-cursor version   # bump our -fork.N suffix accordingly
git push origin main
```

Reinstall everywhere with `npm install -g github:wink-/opencode-cursor`.

## Validation

Verified on OpenCode v2.0.14 (Linux): plugin loads clean in server logs
(no `failed to load plugin` entries), `opencode models` lists 231
`cursor-acp/*` models, and `open-cursor install` produces a config without
the `plugin`-array marker.

Latency (tiny "reply OK" prompt, same model claude-sonnet-5, this fork's
dev machine, opencode run end-to-end): native provider baseline ~0.9s;
cursor-acp with upstream defaults ~9-11s (per-request cursor-agent spawn);
after the 2.5.8-fork.2 defaults — see docs/log.md for the benchmark table.
