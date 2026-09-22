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
   vars read from the OpenCode server process (awkward to set). The fork
   enables them by default; opt out with `CURSOR_ACP_AGENT_POOL=0` /
   `CURSOR_ACP_SESSION_RESUME=0` in the server env. Honest scope: the pool
   keeps the plugin's Node *runner* warm but still spawns a cursor-agent child
   per request, so it saves the runner boot (~0.1-0.3s), not the cursor-agent
   handshake; session resume mainly saves conversation re-upload on
   multi-turn sessions. The dominant per-request cost (~6s measured:
   cursor-agent spawn + auth + gateway handshake) is inside Cursor's CLI and
   is not removable plugin-side unless a Cursor API key is configured
   (`CURSOR_ACP_BACKEND=sdk` + `CURSOR_API_KEY`, which uses persistent SDK
   connections).

6. **Workspace trust (2.5.8-fork.3): pass `--trust` to cursor-agent by
   default.** Without a TTY, cursor-agent's interactive workspace-trust prompt
   hangs every request in any directory cursor-agent hasn't trusted before —
   through the plugin this surfaced as requests timing out with no error
   output. OpenCode's own permission model already governs tool use, so
   auto-trusting the workspace it runs in is consistent with upstream's
   default-on `--force`. Opt out with `CURSOR_ACP_TRUST=false`.

7. **Config-driven backend selection (2.5.8-fork.4).** The runtime backend
   can now be selected from the OpenCode config — set
   `"backend": "sdk"` under `provider["cursor-acp"]` in opencode.json(c) —
   instead of exporting `CURSOR_ACP_BACKEND` in the OpenCode server process
   (which is awkward to persist). Resolution order: `CURSOR_ACP_BACKEND` env
   wins, then the config value, then `auto`. Use it together with a Cursor
   API key stored via `opencode auth login` (cursor-acp provider) to run the
   persistent-connection SDK backend and avoid the per-request cursor-agent
   handshake.

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

Plugin load: verified on OpenCode v2.0.14 (Linux) — no `failed to load plugin`
entries in server logs, `opencode models` lists 231+ `cursor-acp/*` models,
`open-cursor install` produces a config without the `plugin`-array marker.

Workspace trust fix: in a directory cursor-agent hasn't trusted, without
`--trust` a one-shot CLI call exits 1 on the interactive prompt (~0.8s) and
the plugin's piped spawn blocks until request timeout; with `--trust` the
same call completes normally.

Latency (tiny "reply OK" prompt, claude-sonnet-5, dev machine, opencode run
end-to-end unless noted):

| Path | Time |
|---|---|
| native provider (github-copilot, same model) | 0.8-1.3s |
| direct `cursor-agent -p` one-shot | 6.4-9.8s |
| cursor-agent process boot alone (`--version`) | ~0.6s |
| through plugin, pool off (fork.1) | 7.6-11.2s (warm turns 9.0-9.5s) |
| through plugin, fork.2+ defaults | marginal: pool saves the Node runner boot only; resume helps anchored multi-turns |

Conclusion: the dominant per-request cost is inside cursor-agent itself
(spawn + auth + gateway handshake + model TTFB), which reoccurs every request
because the runner spawns cursor-agent per invocation. The plugin cannot
remove it on the cursor-agent backend; a Cursor API key
(`CURSOR_ACP_BACKEND=sdk`) would enable the persistent-connection SDK path.

Known test failures: `tests/unit/proxy/plugin-resume.test.ts` has 3 failures
from cross-test cache leakage that also fail on pristine upstream 2.5.8;
fork changes add no new failures.
