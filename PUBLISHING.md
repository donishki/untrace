# Publishing Untrace Desktop

## Repository layout

The desktop edition is maintained on `main`. The pre-existing GitHub web edition is preserved on `web-before-desktop`, and its commits remain in the shared history.

- `origin`: https://github.com/donishki/Untrace.git
- `gitea`: https://git.ptbox.org/dasp/Untrace.git
- `upstream`: https://github.com/developersharif/untrace.git (reference only)

Both repositories already exist and default to `main`. Retain the MIT license and upstream attribution when distributing source or binaries.

## Verify and package

On Windows x64 with Node.js 22.13 or newer:

```powershell
npm ci
npm test
npm run release:windows
node scripts/smoke-portable.mjs x64
node scripts/smoke-portable.mjs x86
```

Review `git status --short` and `git diff` before committing. Keep dependencies, generated builds, local settings, secrets and test outputs out of Git. Inspect all newly added files as well as tracked changes. Commit the reviewed source and publishing documentation before tagging a release.

## Publish the reviewed commit

Use the current branch name for both hosts:

```powershell
$branch = git branch --show-current
git push -u origin $branch
git push gitea $branch
```

After validating the built release and ensuring the tag does not already exist:

```powershell
git tag -a v1.7.0 -m 'Untrace Desktop 1.7.0'
git push origin v1.7.0
git push gitea v1.7.0
```

Create a release on each host for the same tag. Upload exactly these six files:

- `release/x64/Untrace-Desktop-1.7.0-setup-x64.exe`
- `release/x64/Untrace-Desktop-1.7.0-portable-x64.exe`
- `release/x86/Untrace-Desktop-1.7.0-setup-x86.exe`
- `release/x86/Untrace-Desktop-1.7.0-portable-x86.exe`
- `release/Untrace-Desktop-Source-v1.7.0.zip`, made with `git archive` from the release tag
- `release/SHA256SUMS.txt`, containing hashes for all five files above

Test installed-app startup and uninstall for both architectures, preserving user preferences. Run the full packaged test suite on x86 because it uses a different Electron major version. The x64 runtime is 44.3.0; x86 uses 43.8.3 (the last supported 32-bit series, reaching end of support in January 2027). Do not change the runtime pins without repeating package tests.

Include MIT attribution, theme credits, the Windows requirements, and the unsigned-executable notice. Do not upload user data, intermediate archives, blockmaps, or test outputs. Validate the six remote assets before publishing each draft. When resuming an upload, locate drafts through the release list as tag lookup may omit drafts.

README.md links to the latest releases on both hosts. See [upstream review](docs/UPSTREAM-REVIEW.md) before importing web-edition changes. Regenerate the real application screenshots with `npm run screenshots`; the scenic image is generated test artwork.

Run installer checks sequentially, with no other Untrace processes running: NSIS uninstall closes running copies by executable name. Use scripts/test-installers.ps1 -Architecture x64, then x86, and only then run packaged regression tests. The x86 packages were verified under WOW64 on a 64-bit Windows host; native 32-bit Windows was not separately tested.
