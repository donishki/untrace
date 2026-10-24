<script>
  import { onDestroy, tick } from 'svelte';
  import Icon from './Icon.svelte';
  import Appearance from './Appearance.svelte';
  import { ACCEPTED_EXTENSIONS, isAccepted, findings, countEntries, formatMetadata } from './metadata.js';
  import { formatBytes } from './clean.js';
  import BatchWorkspace from './BatchWorkspace.svelte';
  import MetadataComparison from './MetadataComparison.svelte';
  import ExportSettings from './ExportSettings.svelte';
  import { loadExportSettings } from './export-settings.js';
  import { processImage } from './processing.js';
  import { locationSummary } from './metadata-comparison.js';
  import { readDroppedFiles } from './drop-files.js';
  const savedSettings = loadExportSettings();
  let batchFiles = [], batch, batchBusy = false, batchState = 'Batch ready';
  let comparison, folderInput, controller, estimate = null;
  const version = __APP_VERSION__;
  const appName = __APP_NAME__;
  let appearance;

  let file = null;
  let metadata = null;
  let previewUrl = null;
  let result = null;
  let stage = 'idle';
  let view = 'original';
  let zoom = 'fit';
  let format = savedSettings.format;
  let quality = savedSettings.quality;
  let dimensions = '';
  let previewFailed = false;
  let dragging = false;
  let dragDepth = 0;
  let input;
  let help;
  let saveLink;
  let notice = '';
  let generation = 0;

  $: busy = batchBusy || ['scanning', 'cleaning', 'estimating', 'collecting'].includes(stage);
  $: gps = locationSummary(metadata);
  $: ready = !!result && !result.fallback;
  $: list = findings(metadata);
  $: entries = countEntries(metadata);
  $: currentUrl = view === 'cleaned' && ready ? result.url : previewUrl;
  $: stateLabel = batchFiles.length ? batchState : stage === 'collecting' ? 'Reading folder' : stage === 'estimating' ? 'Calculating export size' : stage === 'scanning' ? 'Scanning image' : stage === 'cleaning' ? 'Cleaning image' : result?.fallback ? 'Could not clean' : ready ? 'Ready to save' : file ? 'Ready to clean' : 'Ready';

  function releaseResult() {
    if (result?.url) URL.revokeObjectURL(result.url);
    result = null;
    estimate = null;
    view = 'original';
  }
  function release() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    releaseResult();
  }
  function reset() {
    if (busy) return;
    generation++;
    release();
    file = null; metadata = null; dimensions = ''; notice = ''; previewFailed = false;
    stage = 'idle'; zoom = 'fit';
  }
  function dialogOpen() { return help?.open || appearance?.isOpen() || comparison?.isOpen() || batch?.isDialogOpen(); }
  function cancel() {
    if (batchFiles.length) { batch?.cancel(); return; }
    generation++; controller?.abort();
    if (file && !metadata) metadata = { scanError: 'Original metadata scan was cancelled.' };
    stage = file ? 'review' : 'idle';
    notice = 'Processing cancelled. Your original is unchanged.';
  }
  function offerFiles(entries, forceBatch = false) {
    if (busy || dialogOpen()) return;
    entries = entries.filter(entry => isAccepted(entry.file));
    if (!entries.length) { notice = 'No supported images found. Choose JPEG, PNG, AVIF, HEIC or TIFF images.'; return; }
    if (entries.length === 1 && !forceBatch) { offer(entries[0].file); return; }
    reset(); batchFiles = entries;
  }
  function closeBatch() { batchFiles = []; batchBusy = false; reset(); }
  async function offer(next) {
    if (!next || busy || dialogOpen()) return;
    if (!isAccepted(next)) {
      notice = 'That file type is not supported. Choose a JPEG, PNG, AVIF, HEIC or TIFF image.';
      return;
    }
    release();
    const run = ++generation;
    file = next; metadata = null; dimensions = ''; previewFailed = false; notice = ''; zoom = 'fit';
    previewUrl = URL.createObjectURL(next);
    stage = 'scanning'; controller = new AbortController();
    try {
      const scanned = await processImage('scan', next, {}, controller.signal);
      if (run !== generation) return;
      metadata = scanned;
      if (scanned.scanError) notice = scanned.scanError;
      stage = 'review';
    } catch {
      if (run !== generation) return;
      stage = 'review';
      notice = 'The metadata could not be read. You can try rewriting the image, or open another file.';
    }
  }
  function choose() { if (!busy && !batchFiles.length) input.click(); }
  function onChange(event) { offerFiles([...event.target.files].map(file => ({ file, name: file.webkitRelativePath || file.name })), event.target === folderInput); event.target.value = ''; }
  async function clean(sizeOnly = false) {
    if (batchFiles.length) { batch?.clean(); return; }
    if (!file || busy) return;
    const run = generation;
    stage = sizeOnly ? 'estimating' : 'cleaning'; notice = ''; controller = new AbortController();
    try {
      const cleaned = estimate || await processImage('clean', file, { format, quality: format === 'auto' ? 0.92 : Number(quality) }, controller.signal);
      if (run !== generation) return;
      if (sizeOnly && !cleaned.fallback) { estimate = cleaned; stage = 'review'; return; }
      releaseResult();
      result = { ...cleaned, url: URL.createObjectURL(cleaned.blob) };
      view = result.fallback ? 'original' : 'cleaned'; stage = 'done';
    } catch (error) {
      if (run !== generation) return;
      stage = 'review'; notice = error.message || 'Could not process this image. Try another file.';
    }
  }
  function settingsChanged() {
    estimate = null;
    if (result) { releaseResult(); stage = 'review'; }
  }
  function onPaste(event) {
    if (busy || dialogOpen() || batchFiles.length) return;
    const item = [...(event.clipboardData?.items || [])].find(entry => entry.type.startsWith('image/'));
    if (item) { event.preventDefault(); offer(item.getAsFile()); }
  }
  async function onDrop(event) {
    event.preventDefault(); dragging = false; dragDepth = 0;
    if (busy || dialogOpen() || batchFiles.length) return;
    controller = new AbortController();
    const run = ++generation;
    stage = 'collecting';
    try {
      const entries = await readDroppedFiles(event.dataTransfer?.items || [], event.dataTransfer?.files || [], controller.signal);
      if (run !== generation) return;
      stage = file ? 'review' : 'idle'; await tick(); offerFiles(entries);
    } catch (error) {
      if (run !== generation) return;
      stage = file ? 'review' : 'idle'; notice = 'Could not read the dropped files. Try Open folder or Open image.';
    }
  }
  function onDragEnter(event) {
    if (![...(event.dataTransfer?.types || [])].includes('Files') || busy || dialogOpen() || batchFiles.length) return;
    event.preventDefault(); dragDepth++; dragging = true;
  }
  function onDragLeave() { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dragging = false; }
  function onKey(event) {
    if (dialogOpen()) return;
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); choose(); }
      if (event.key.toLowerCase() === 's') { event.preventDefault(); if (batchFiles.length) batch?.save(); else if (ready) saveLink?.click(); }
      if (event.key === 'Enter') { event.preventDefault(); if (!ready) clean(false); }
    }
    if (event.key === 'Escape' && busy) { cancel(); return; }
    if (event.key === 'Escape' && !batchFiles.length && !busy && !['SELECT', 'INPUT'].includes(event.target.tagName)) reset();
    if (event.key === 'F1') { event.preventDefault(); help.showModal(); }
  }
  onDestroy(() => { generation++; controller?.abort(); release(); });
</script>

<svelte:window on:keydown={onKey} on:paste={onPaste} on:dragenter={onDragEnter} on:dragleave={onDragLeave} on:dragover|preventDefault on:drop={onDrop} />

<div class="desktop-app density-comfortable">
  <aside class="app-rail" aria-label="Application tools">
    <div class="brand-mark" title={appName}><Icon name="shield" size="lg" /></div>
    <div class="rail-current" aria-label="Image cleaner" title="Image cleaner"><Icon name="image" /></div>
    <div class="rail-bottom">
      <button class="btn btn-ghost" type="button" on:click={() => help.showModal()} aria-label="Help and shortcuts" title="Help and shortcuts (F1)"><Icon name="help" /></button>
      <button class="btn btn-ghost" type="button" on:click={() => appearance.open()} aria-label="Choose a theme" title="Appearance"><Icon name="palette" /></button>
    </div>
  </aside>

  <header class="app-header">
    <div class="app-heading"><h1>{appName}</h1><span class="header-divider"></span><span>Image cleaner</span></div>
    <span class="local-badge"><Icon name="lock" size="sm" /> Local workspace</span>
  </header>

  {#if batchFiles.length}
    <BatchWorkspace bind:this={batch} files={batchFiles} bind:format bind:quality bind:busy={batchBusy} bind:stateLabel={batchState} on:close={closeBatch} />
  {:else}
  <main class="editor">
    <div class="editor-toolbar">
      <div class="toolbar-file"><Icon name="image" size="sm" /><span title={file?.name}>{file?.name || 'Untitled workspace'}</span></div>
      <div class="toolbar-actions">
        {#if file}<button class="btn btn-ghost" type="button" on:click={reset} disabled={busy} title="Close image (Esc)" aria-label="Close image"><Icon name="close" size="sm" /></button>{/if}
        <button class="btn btn-ghost" type="button" on:click={() => folderInput.click()} disabled={busy}>Open folder</button>
        <button class="btn btn-secondary" type="button" on:click={choose} disabled={busy} title="Open image (Ctrl+O)"><Icon name="folder" size="sm" />Open image</button>
      </div>
    </div>

    {#if notice}<div class="inline-notice" role="alert"><Icon name="info" size="sm" /><span>{notice}</span><button class="btn btn-ghost" type="button" aria-label="Dismiss message" on:click={() => notice = ''}><Icon name="close" size="sm" /></button></div>{/if}

    <section class="image-workspace" class:dragging aria-label="Image preview">
      {#if !file}
        <div class="welcome">
          <div class="image-emblem"><Icon name="image" size="lg" /><span class="emblem-badge"><Icon name="shield" size="sm" /></span></div>
          <div class="welcome-copy"><p class="overline">A fresh start for your images</p><h2>Keep the image.<br />Leave the metadata.</h2><p>Drop images or a folder to inspect and remove<br class="desktop-break" /> the information stored inside it.</p></div>
          <button class="btn btn-primary" type="button" on:click={choose}><Icon name="plus" size="sm" />Choose an image</button>
          <span class="shortcut-hint">or paste from clipboard <kbd>Ctrl V</kbd></span>
          <div class="format-hint">JPEG <span>·</span> PNG <span>·</span> AVIF <span>·</span> HEIC <span>·</span> TIFF</div>
        </div>
      {:else}
        <div class="preview-controls">
          <div class="view-switch" aria-label="Preview version">
            <button class="btn btn-ghost" type="button" aria-pressed={view === 'original'} on:click={() => view = 'original'}>Original</button>
            <button class="btn btn-ghost" type="button" aria-pressed={view === 'cleaned'} disabled={!ready} on:click={() => view = 'cleaned'}>Cleaned copy</button>
          </div>
          <span class="preview-label">{view === 'cleaned' && ready ? formatBytes(result.size) : formatBytes(file.size)}</span>
        </div>
        <div class="preview-viewport" class:actual-size={zoom === 'actual'}>
          {#if previewFailed}
            <div class="preview-unavailable"><Icon name="image" size="lg" /><h2>Preview unavailable</h2><p>This format could not be decoded.<br />Try converting it to JPEG or PNG first.</p></div>
          {:else}
            <img class="workspace-image" src={currentUrl} alt={view === 'cleaned' ? 'Cleaned image preview' : 'Original image preview'} on:load={event => dimensions = `${event.target.naturalWidth} × ${event.target.naturalHeight}`} on:error={() => previewFailed = true} />
          {/if}
        </div>
        <div class="preview-bottom"><span>{dimensions || 'Image preview'}</span><div class="zoom-controls"><button class="btn btn-ghost" type="button" aria-pressed={zoom === 'fit'} on:click={() => zoom = 'fit'}>Fit</button><button class="btn btn-ghost" type="button" aria-pressed={zoom === 'actual'} on:click={() => zoom = 'actual'}>100%</button></div></div>
      {/if}
      {#if dragging}<div class="drop-overlay"><Icon name="upload" size="lg" /><h2>Drop to open images</h2></div>{/if}
      {#if busy}<div class="processing-overlay" role="status"><span class="spinner"></span>{stateLabel}… <button class="btn btn-secondary" on:click={cancel}>Cancel processing</button></div>{/if}
    </section>
    <div class="workspace-note"><Icon name="shield" size="sm" /><span>Your original stays untouched. Save a separate, cleaned copy.</span></div>
  </main>

  <aside class="inspector" aria-label="Image inspector">
    <div class="inspector-heading"><h2>Inspector</h2><span class="subtle">{file ? '1 image' : 'No image'}</span></div>
    <div class="inspector-scroll">
      <section class="inspector-section">
        <div class="section-label"><h3>Source</h3><Icon name="file" size="sm" /></div>
        {#if file}
          <p class="source-name" title={file.name}>{file.name}</p>
          <dl class="properties"><div><dt>File size</dt><dd>{formatBytes(file.size)}</dd></div><div><dt>Dimensions</dt><dd>{dimensions || '—'}</dd></div></dl>
        {:else}
          <div class="source-placeholder"><Icon name="image" /><p>No image selected<span>Open a file to get started.</span></p></div>
        {/if}
      </section>
      {#if gps}<div class="location-warning" role="status"><Icon name="pin" size="sm" /><div><strong>Location data in original</strong><p>{gps}</p><p>Sharing this original can reveal where it was taken.</p></div></div>{/if}
      <section class="inspector-section">
        <div class="section-label"><h3>Metadata</h3>{#if file && !busy}<span class="count-badge">{entries} entries</span>{:else}<Icon name="scan" size="sm" />{/if}</div>
        {#if stage === 'scanning'}
          <p class="subtle">Inspecting the file…</p>
        {:else if file && list.length}
          <ul class="metadata-list">{#each list as item}<li><span class="status {item.severity}">{item.label}</span><p>{item.detail}</p></li>{/each}</ul>
          <details class="metadata-details"><summary>View raw metadata</summary><pre>{formatMetadata(metadata)}</pre></details>
        {:else if file}
          <p class="scan-note"><Icon name="info" size="sm" /><span>No recognized metadata found. A rewrite can still remove unrecognized containers.</span></p>
        {:else}
          <p class="section-description">See what travels with your image.</p>
          <ul class="coverage-list"><li><Icon name="pin" size="sm" />Location & GPS</li><li><Icon name="camera" size="sm" />Camera & device</li><li><Icon name="clock" size="sm" />Dates & timestamps</li><li><Icon name="shield" size="sm" />Content credentials</li><li><Icon name="file" size="sm" />EXIF, XMP & comments</li></ul>
        {/if}
      </section>
      {#if ready}<section class="inspector-section"><div class="section-label"><h3>After cleaning</h3></div><p class="export-hint">{result.metadata?.scanError || 'Compare detected fields in the original and the cleaned copy.'}</p><button class="btn btn-secondary" on:click={() => comparison.open(metadata, result.metadata, file.name)}>Compare metadata</button></section>{/if}
      <section class="inspector-section">
        <div class="section-label"><h3>Export</h3><Icon name="download" size="sm" /></div>
        <ExportSettings bind:format bind:quality {busy} on:change={settingsChanged} />
        {#if file && !ready}<div class="size-preview">
          {#if estimate}<dl class="properties"><div><dt>Export size</dt><dd>{formatBytes(estimate.size)}</dd></div><div><dt>Size change</dt><dd>{Math.round(estimate.sizeDelta)}%</dd></div></dl><p class="export-hint">Exact encoded size. This prepared output will be reused when you clean.</p>
          {:else}<button class="btn btn-secondary" disabled={busy} on:click={() => clean(true)}>Preview export size</button><p class="export-hint">Calculate the actual file size before cleaning and saving.</p>{/if}
        </div>{/if}
      </section>
    </div>
    <div class="inspector-action" aria-live="polite">
      {#if result?.fallback}
        <span class="status err">Not cleaned</span><p>This image could not be rewritten. Convert it to JPEG or PNG and try again.</p>
        <button class="btn btn-primary" type="button" on:click={choose}>Try another image</button>
      {:else if ready}
        <span class="status ok">Ready to save</span><p class="output-name" title={result.filename}>{result.filename}<span>{formatBytes(result.size)} · {Math.round(result.sizeDelta)}% size change</span></p>
        {#if result.wasSecondPass}<p>A second pass used JPEG on white to remove remaining metadata.</p>{/if}
        <a class="btn btn-primary" href={result.url} download={result.filename} bind:this={saveLink}><Icon name="download" size="sm" />Save clean image</a>
      {:else}
        <p>{file ? 'Rewrites the image without its embedded metadata.' : 'Your export will be ready here.'}</p>
        <button class="btn" class:btn-primary={!!file} class:btn-secondary={!file} type="button" disabled={!file} aria-disabled={busy} on:click={() => clean(false)}>{#if busy}<span class="spinner"></span>{stateLabel}…{:else}<Icon name="shield" size="sm" />Clean image{/if}</button>
      {/if}
    </div>
  </aside>
  {/if}

  <footer class="app-statusbar"><span class="status" class:ok={!busy} class:info={busy}>{stateLabel}</span><span class="statusbar-tip">{busy ? 'Esc to cancel processing' : batchFiles.length ? 'Ctrl Enter to clean · Ctrl S to save' : ready ? 'Ctrl S to save a copy' : file ? 'Ctrl Enter to clean' : 'Ctrl O to open an image'}</span><span class="statusbar-local"><Icon name="lock" size="sm" />On-device processing</span></footer>
</div>

<input class="visually-hidden" type="file" multiple accept={ACCEPTED_EXTENSIONS} bind:this={input} on:change={onChange} tabindex="-1" aria-label="Open image file" />
<input class="visually-hidden" type="file" webkitdirectory multiple accept={ACCEPTED_EXTENSIONS} bind:this={folderInput} on:change={onChange} tabindex="-1" aria-label="Open image folder" />
<MetadataComparison bind:this={comparison} />
<Appearance bind:this={appearance} />

<dialog class="modal" bind:this={help} aria-labelledby="help-title" style:margin="auto">
  <div class="help-content"><div class="help-heading"><div><p class="overline">{appName}</p><h2 id="help-title">A little less attached.</h2></div><button type="button" class="btn btn-ghost" aria-label="Close help" on:click={() => help.close()}><Icon name="close" /></button></div>
  <p>Open one image, several images, or a folder. Inspect metadata, clean, then save separate copies. Batch mode includes subfolders and gives each file a result. Use Cancel processing or Esc to stop; completed copies are kept. Everything is processed on your device.</p>
  <h3>Keyboard shortcuts</h3><dl class="shortcut-list"><div><dt>Open image</dt><dd><kbd>Ctrl O</kbd></dd></div><div><dt>Paste image</dt><dd><kbd>Ctrl V</kbd></dd></div><div><dt>Clean image</dt><dd><kbd>Ctrl Enter</kbd></dd></div><div><dt>Save clean copy</dt><dd><kbd>Ctrl S</kbd></dd></div><div><dt>Close image</dt><dd><kbd>Esc</kbd></dd></div></dl>
  <h3>Good to know</h3><p>JPEG and PNG work best. HEIC, TIFF and some AVIF files may need conversion first. JPEG is lossy; PNG can preserve transparency. Colour profiles, animation and additional pages are not preserved.</p><p>Metadata scanning is best effort. Removing metadata does not remove visible watermarks or identifying image content, guarantee anonymity, or prevent AI labels.</p><div class="help-footer"><span>Untrace {version} · MIT license</span><a href="https://github.com/developersharif/untrace" target="_blank" rel="noreferrer">Original project ↗</a></div></div>
</dialog>
