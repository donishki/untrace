# Publishing Untrace Desktop

## Repository layout

The desktop edition is maintained on `main`. The pre-existing GitHub web edition is preserved on `web-before-desktop`, and its commits remain in the shared history.

- `origin`: https://github.com/donishki/Untrace.git
- `gitea`: https://git.ptbox.org/dasp/Untrace.git
- `upstream`: https://github.com/developersharif/untrace.git (reference only)

Create empty repositories at the two publishing destinations before pushing. Do not initialize them with a README or license. Retain the MIT license and upstream attribution when distributing source or binaries.

## Verify and package

On Windows x64 with Node.js 22.13 or newer:

```powershell
npm ci
npm test
npm run portable
node scripts/smoke-portable.mjs
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
git tag -a v1.6.1 -m 'Untrace Desktop 1.6.1'
git push origin v1.6.1
git push gitea v1.6.1
```

Create a release on each host for the same tag. Upload `release/Untrace-Desktop-1.6.1-portable-x64.exe`, a SHA-256 checksum file, and matching source. Include the MIT license, theme credits, version highlights from CHANGELOG.md, Windows x64 requirements, and the unsigned-executable notice. Do not upload `Untrace-data` or test output.

Generate the checksum after building:

```powershell
$asset = 'release/Untrace-Desktop-1.6.1-portable-x64.exe'
$hash = (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $(Split-Path -Leaf $asset)" | Set-Content -Encoding ascii release/SHA256SUMS.txt
```

README.md links to the latest releases on both hosts. Publish identical assets and source on both hosts.
