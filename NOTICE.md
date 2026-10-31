# Attribution and Third-Party Software

This is an independent community extension for Remotion Studio and Codex.
It is not an official Remotion or OpenAI product, and does not bundle the
Remotion implementation.

The extension's original code, dictionary and documentation are released under
the Unlicense. This dedication does not change the licenses or rights of
third-party projects, their names, logos, or dependencies.

The work was inspired by:
https://github.com/yinbaozong/remotion-zh

The original regex patch scripts from that repository are not included or
executed. This extension uses its own AST transform, dictionary, build loader,
companion launcher and Codex integration.

Runtime dependencies are installed separately through npm:

| Package | License reported by the lockfile |
| --- | --- |
| @jridgewell/remapping | MIT |
| @jridgewell/gen-mapping | MIT |
| @jridgewell/resolve-uri | MIT |
| @jridgewell/sourcemap-codec | MIT |
| @jridgewell/trace-mapping | MIT |
| acorn | MIT |
| acorn-walk | MIT |
| magic-string | MIT |

Their own license and copyright notices remain applicable and are supplied in
the installed packages. Source distribution of this extension excludes those
packages and the user's configuration backups.

Remotion is a separate user-installed dependency subject to its own terms:
https://www.remotion.dev/license
