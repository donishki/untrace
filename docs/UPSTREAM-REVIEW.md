# Upstream review — 2026-10-25

Reviewed [developersharif/untrace](https://github.com/developersharif/untrace) through commit `6d5e92b14d371ebe6133e5613259a858a79d7a0a` on upstream/main.

`git log main..upstream/main` is empty: all current upstream commits are already ancestors of this desktop edition. The earlier history-preserving merge intentionally kept the desktop working tree; ancestry alone does not mean every web feature was adopted.

The four web-edition commits after the original desktop baseline (`99b4b22`) add landing-page branding/animation, privacy guides and SEO/social assets, web batch review/ZIP downloads, and CNAME handling. They do not change `src/lib/clean.js`, `src/lib/metadata.js`, or `package.json` relative to that baseline. No scanner/cleaner fix or dependency update needs importing from these commits.

The desktop edition already implements sequential worker-based batches, cancellation, metadata comparison, and restricted native-folder saving. Importing the browser Batch component or website App/Vite configuration would replace or complicate those workflows without a required bug fix. No upstream commit was cherry-picked for 1.7.0.

Keep the original web implementation on `web-before-desktop` for reference. Both GitHub and Gitea should default to `main`. Gitea originally selected the first pushed branch, `web-before-desktop`; its repository default was corrected to `main`.

For future reviews, fetch upstream, inspect changes to shared processing modules separately from website changes, and test any selected fix against offline desktop, cancellation, batch saving, and both supported architectures before publishing.
