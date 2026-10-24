# Changelog

## 1.7.0 - 2026-10-25

- Added per-user Windows installers and portable launchers for x64 and x86.
- Store installed-app preferences in the user's application-data directory; preserve portable settings beside the launcher.
- Use Electron 43.8.3 for x86 because Electron 44 no longer ships 32-bit binaries; keep Electron 44.3.0 for x64.
- Added reproducible full-workspace screenshots with generated sample artwork.
- Reviewed upstream through 6d5e92b; no outstanding image-engine fixes require importing the web interface.
- Set main as the default branch on both hosting services.


## 1.6.1 - 2026-09-10

- Filter folder selections, multiple-file selections and drag-and-drop before opening a batch: only supported images enter the queue. Non-image files no longer appear as skipped rows.
- Show a clear message when a selection contains no supported images, preserving the current workspace.
- Added regression coverage for documents and executables inside nested folders and mixed drag-and-drop selections.


## 1.6.0 - 2026-09-10

- Added batch cleaning for multiple files, selected folders and dropped folders, including nested contents and per-file results.
- Added native output-folder selection and collision-safe batch saving. Existing files are preserved; failed saves retain prepared outputs for retry.
- Added before/after metadata comparison with field values, detected changes and explicit uncertainty when parsing fails. GPS and camera fields are prioritised.
- Added prominent original-image GPS warnings and coordinate display without online maps.
- Added an exact export-size preview that reuses its prepared output, plus batch output sizes before saving.
- Remember export format and JPEG quality across launches and share settings between single-image and batch modes.
- Moved metadata scanning and image encoding into background workers. Cancel stops active processing; batch saving finishes the current file before stopping the remaining queue.
- Release saved batch image blobs to reduce retained memory; keep comparison details available for the session.
- Preserve previously discarded parsed metadata fields and replace misleading clean claims after parser errors with incomplete-scan reporting.
- Report encoder-generated colour profiles and avoid an unnecessary second JPEG pass for those profiles.
- Added regression tests for the new workflows, file collisions, path validation, cancellation, save failures and retries. Updated README and portable build.


## 1.5.0 - 2026-09-10

- Added eight VS Code-inspired palettes: One Dark, Dracula, Tokyo Night, Night Owl, GitHub Dark, GitHub Light, Catppuccin Mocha and Catppuccin Latte. Retained all six existing themes and saved preferences.
- Reworked Appearance into a wider, scrollable gallery grouped into editor favourites and Untrace originals, with the heading and Done button kept in view.
- Adapted secondary text and action colours for readable app controls; theme choices still leave image pixels unchanged.
- Added theme inspiration credits and extended the existing contrast checks to all fourteen palettes.


## 1.4.0 - 2026-09-10

- Replaced Midnight, Forest, Plum and Sand with four redesigned themes: Graphite, Paper, Cobalt and Ember. Light and Dark are unchanged.
- Use neutral surfaces and stronger tonal separation rather than colouring every surface with the accent hue.
- Added a distinct dark navy frame to Cobalt's light workspace; Graphite uses silver controls, Paper uses dark olive ink, and Ember uses warm orange accents.
- Migrate saved selections: Midnight to Cobalt, Forest to Graphite, Plum to Ember, and Sand to Paper.
- Updated previews and documentation, and checked text contrast in both the workspace and Cobalt's contrasting frame.

## 1.3.0 - 2026-09-10

- Rebranded this derivative as **Untrace Desktop**, including the workspace, Help, window title, Windows product metadata and portable executable name. Retained original Untrace attribution and MIT license.
- Added Midnight, Forest, Plum and Sand palettes alongside Light and Dark.
- Replaced the light/dark toggle with an Appearance dialog containing live theme previews and accessible radio controls.
- Added Follow Windows, which tracks system theme changes while the app is open.
- Persist theme choices, retain legacy light/dark preferences, and apply saved themes before first paint using shared startup logic.
- Preserve the existing `Untrace-data` folder and storage origin across the rename.
- Added contrast, persistence, system preference and rebranding checks. Theme changes affect the interface only.

## 1.2.0 - 2026-09-10

- Replaced the landing page with a desktop workspace: application rail, file toolbar, central preview, persistent inspector, export controls and status bar.
- Removed the promotional sections and moved usage guidance into an accessible Help dialog.
- Added original/cleaned preview switching, fit/actual-size viewing and responsive layouts for smaller windows.
- Added automatic, PNG and JPEG export options, with JPEG quality controls.
- Fixed PNG output being unnecessarily converted to JPEG when required IHDR image headers were mistaken for removable metadata; PNG export now preserves transparency.
- Added Ctrl+O (open), Ctrl+V (paste), Ctrl+Enter (clean), Ctrl+S (save), Esc (close image), and F1 (help).
- Accept drag-and-drop and pasted images throughout the workspace; release replaced previews and invalidate exports after setting changes.
- Replaced the misleading “already clean” message with a qualified metadata scan result.
- Simplified startup markup, removed unused website UI from the bundle, and retained offline Electron packaging.
- Extended integration checks for themes, keyboard controls, PNG alpha, export invalidation, preview switching and small-window layout.

## 1.1.0 - 2026-09-10

- Added a Windows x64 portable executable with bundled Electron runtime.
- Added offline packaging, content security policy, sandboxed rendering, denied permissions, blocked network requests, and restricted external links.
- Store preferences in `Untrace-data` beside the executable.
- Fixed black backgrounds when large transparent images become JPEG by applying a white matte.
- Fixed misleading success badges and removal lists when decoding fails.
- Preserve the original filename on failure; safely handle filenames without extensions.
- Accept recognized image extensions when Windows supplies an empty or generic MIME type.
- Prevent repeated cleaning requests while processing.
- Added desktop integration tests, build commands, and Windows documentation.

## Upstream baseline - 2026-09-10

Imported developersharif/untrace at commit `99b4b223525a0b85da8ab0994066b5151d6a83fa`.
This date records the import, not the upstream release date. Original MIT license retained.
