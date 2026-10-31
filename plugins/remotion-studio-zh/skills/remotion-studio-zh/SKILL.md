---
name: remotion-studio-zh
description: Open or preview Remotion Studio in Chinese alongside the official Remotion plugin. Apply when creating a project that will be previewed, starting an existing Studio, or reopening Studio after a Remotion upgrade. Not needed for render-only commands.
---

Use the installed companion launcher when starting Studio. It reads the project's
original config and adds translation through a generated config outside the project.
The project needs its own installed Remotion CLI; the launcher does not install or
upgrade Remotion.

Installation first links this companion from the official Remotion router and
Studio skills. Only denied local writes justify a global AGENTS.md fallback.
The installed launcher checks and repairs those local links when invoked; ordinary
preview checks do not add global instructions. After an official plugin update that
replaces the links, invoke this companion once or run its runtime's
`scripts/repair-routing.cjs repair`. No background startup hook is installed.

Resolve this skill's `scripts/remotion-zh.cjs` to an absolute path, then run:

```powershell
node "<skill-directory>/scripts/remotion-zh.cjs" doctor --project "<project-root>"
node "<skill-directory>/scripts/remotion-zh.cjs" studio --project "<project-root>" -- <original-studio-arguments>
```

Pass the actual project root, not the chat's unrelated directory. Preserve its entry
point, bundler, port and explicit config arguments. The launcher adds `--no-open`;
open the exact returned local URL in the user's requested viewer. If an existing
English Studio is reused, start a separate instance with `--force-new` and a free
port, leaving other running instances alone.

For a newly created project, install its normal dependencies with the existing
Remotion workflow first, then use this launcher for the preview. Keep the official
Remotion and Motion Craft skills for their respective work.

Use `--locale en` on the launcher before `--` when English is requested. The
translation is partial. If doctor reports missing dependencies or an unsupported
version, report that result; do not call an English fallback a successful Chinese
preview. A Node API bundle outside this launcher still needs the language override
explicitly; this skill does not intercept external terminal commands.
