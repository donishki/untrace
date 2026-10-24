<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Icon from './Icon.svelte';
  import ExportSettings from './ExportSettings.svelte';
  import MetadataComparison from './MetadataComparison.svelte';
  import { processImage } from './processing.js';
  import { isAccepted, formatMetadata } from './metadata.js';
  import { locationSummary } from './metadata-comparison.js';
  import { formatBytes } from './clean.js';
  export let files = [];
  export let format;
  export let quality;
  export let busy = false;
  export let stateLabel = 'Batch ready';
  const dispatch = createEventDispatcher();
  let rows = files.filter(entry => isAccepted(entry.file)).map((entry, id) => ({ ...entry, id, status: 'Queued', detail: '' }));
  let selected = 0;
  let controller, comparison, output;
  let message = '', operation = '', cancelled = false, choosing = false;
  $: current = rows[selected];
  $: available = rows.filter(row => row.result && row.status !== 'Saved');
  $: remaining = rows.filter(row => isAccepted(row.file) && !row.result);
  $: totalSize = rows.reduce((sum, row) => sum + (row.result?.size || 0), 0);
  $: summary = ['Cleaned', 'Saved', 'Failed', 'Cancelled'].map(status => `${rows.filter(row => row.status === status).length} ${status.toLowerCase()}`).join(' · ');
  $: gps = locationSummary(current?.metadata);
  function update(row, values) { Object.assign(row, values); rows = [...rows]; }
  function start(label) { controller = new AbortController(); cancelled = false; busy = true; operation = label; message = ''; }
  function finish() { busy = false; operation = ''; stateLabel = cancelled ? 'Batch cancelled' : 'Batch ready'; }
  export function isDialogOpen() { return comparison?.isOpen(); }
  export function cancel() {
    if (!busy) return;
    cancelled = true;
    controller?.abort();
    stateLabel = operation === 'Saving' ? 'Finishing current save' : 'Cancelling';
    message = operation === 'Saving' ? 'The current file will finish saving. Remaining files will not be saved.' : 'Stopped processing. Completed results are kept; remaining images can be retried.';
  }
  async function scan() {
    start('Scanning');
    try {
      for (const row of rows) {
        if (cancelled) break;
        if (row.status !== 'Queued') continue;
        update(row, { status: 'Scanning' }); stateLabel = `Scanning ${row.id + 1} of ${rows.length}`;
        try {
          const metadata = await processImage('scan', row.file, {}, controller.signal);
          update(row, { metadata, status: 'Ready', detail: metadata.scanError || '' });
        } catch (error) {
          update(row, { status: error.name === 'AbortError' ? 'Cancelled' : 'Failed', detail: error.name === 'AbortError' ? 'Scan cancelled.' : error.message });
        }
      }
      if (cancelled) rows = rows.map(row => row.status === 'Queued' ? { ...row, status: 'Cancelled', detail: 'Not scanned.' } : row);
    } finally { finish(); }
  }
  export async function clean() {
    if (busy || choosing || !remaining.length) return;
    start('Cleaning');
    const pending = [...remaining];
    try {
      for (let index = 0; index < pending.length && !cancelled; index++) {
        const row = pending[index];
        update(row, { status: 'Cleaning', detail: '' }); stateLabel = `Cleaning ${index + 1} of ${pending.length}`;
        try {
          if (!row.metadata) update(row, { metadata: await processImage('scan', row.file, {}, controller.signal) });
          const result = await processImage('clean', row.file, { format, quality: format === 'auto' ? 0.92 : Number(quality) }, controller.signal);
          if (result.fallback) throw new Error('Could not decode or rewrite this image. Convert it to JPEG or PNG and try again.');
          update(row, { result, status: 'Cleaned', detail: result.wasSecondPass ? 'Second pass: JPEG on white.' : '' });
        } catch (error) {
          update(row, { status: error.name === 'AbortError' ? 'Cancelled' : 'Failed', detail: error.name === 'AbortError' ? 'Cleaning cancelled.' : error.message });
        }
      }
      if (cancelled) for (const row of pending) if (!row.result && !['Failed', 'Cancelled'].includes(row.status)) update(row, { status: 'Cancelled', detail: 'Not processed.' });
    } finally { finish(); }
  }
  async function chooseOutput() {
    if (busy || choosing) return;
    choosing = true;
    try {
      if (!window.untraceDesktop) throw new Error('Folder saving is available in the Windows desktop app.');
      const next = await window.untraceDesktop.chooseOutputFolder();
      if (next) output = next;
    } catch (error) { message = error.message; }
    finally { choosing = false; }
  }
  export async function save() {
    if (busy || choosing || !available.length) return;
    if (!output) await chooseOutput();
    if (!output) return;
    start('Saving');
    const pending = [...available];
    try {
      for (let index = 0; index < pending.length && !cancelled; index++) {
        const row = pending[index];
        stateLabel = `Saving ${index + 1} of ${pending.length}`;
        update(row, { status: 'Saving' });
        try {
          const bytes = new Uint8Array(await row.result.blob.arrayBuffer());
          if (cancelled) { update(row, { status: 'Cleaned' }); break; }
          const saved = await window.untraceDesktop.saveOutput(output.token, row.result.filename, bytes);
          update(row, { status: 'Saved', detail: saved.path, saved, result: { ...row.result, blob: null } });
        } catch (error) { update(row, { status: 'Failed', detail: `Save failed: ${error.message}` }); }
      }
    } finally { finish(); }
  }
  function settingsChanged() {
    rows = rows.map(row => isAccepted(row.file) ? { ...row, result: null, saved: null, status: row.metadata ? 'Ready' : 'Queued', detail: '' } : row);
    message = 'Export settings changed. Clean again to prepare new copies. Files already saved stay unchanged.';
  }
  onMount(scan);
  onDestroy(() => { cancelled = true; controller?.abort(); });
</script>

<main class="editor">
  <div class="editor-toolbar"><div class="toolbar-file"><Icon name="folder" size="sm" /><span>{rows.length} files</span></div><button class="btn btn-secondary" disabled={busy || choosing} on:click={() => dispatch('close')}>Close batch</button></div>
  {#if message}<div class="inline-notice" role="status"><Icon name="info" size="sm" /><span>{message}</span></div>{/if}
  <section class="batch-workspace" aria-label="Batch files">
    <div class="batch-heading"><h2>Batch cleaning</h2><p>{summary}</p></div>
    <div class="batch-list">
      {#each rows as row}
        <div class="batch-row" class:selected={selected === row.id}>
          <button class="btn btn-ghost batch-file" aria-pressed={selected === row.id} on:click={() => selected = row.id}><Icon name="image" size="sm" /><span title={row.name}>{row.name}</span></button>
          <div class="batch-row-status"><span class="status" class:ok={row.status === 'Cleaned' || row.status === 'Saved'} class:err={row.status === 'Failed'} class:warn={row.status === 'Cancelled'} class:info={['Scanning', 'Cleaning', 'Saving'].includes(row.status)}>{row.status}</span>{#if locationSummary(row.metadata)}<span class="gps-badge"><Icon name="pin" size="sm" />GPS</span>{/if}</div>
          <span class="batch-size">{row.result ? formatBytes(row.result.size) : row.file ? formatBytes(row.file.size) : '—'}</span>
        </div>
      {/each}
    </div>
    <div class="batch-progress" role="status">{busy ? stateLabel : `${rows.length} files · ${formatBytes(totalSize)} prepared output`}</div>
  </section>
  <div class="workspace-note"><Icon name="shield" size="sm" /><span>Existing files are never overwritten. Duplicate names receive a number.</span></div>
</main>
<aside class="inspector" aria-label="Batch inspector">
  <div class="inspector-heading"><h2>Inspector</h2><span class="subtle">Batch</span></div>
  <div class="inspector-scroll">
    <section class="inspector-section"><div class="section-label"><h3>Selected file</h3></div>
      {#if current}<p class="source-name">{current.name}</p><p class="status" class:err={current.status === 'Failed'}>{current.status}</p>
        {#if current.detail}<p class="batch-detail">{current.detail}</p>{/if}
        {#if gps}<div class="location-warning" role="status"><Icon name="pin" size="sm" /><div><strong>Location data in original</strong><p>{gps}</p></div></div>{/if}
        {#if current.result}<dl class="properties"><div><dt>Original size</dt><dd>{formatBytes(current.file.size)}</dd></div><div><dt>Export size</dt><dd>{formatBytes(current.result.size)}</dd></div><div><dt>Size change</dt><dd>{Math.round(current.result.sizeDelta)}%</dd></div></dl><button class="btn btn-secondary" on:click={() => comparison.open(current.metadata, current.result.metadata, current.name)}>Compare metadata</button>{/if}
        {#if current.metadata}<details class="metadata-details"><summary>View original metadata</summary><pre>{formatMetadata(current.metadata)}</pre></details>{/if}
      {/if}
    </section>
    <section class="inspector-section"><div class="section-label"><h3>Export</h3><Icon name="download" size="sm" /></div><ExportSettings bind:format bind:quality {busy} on:change={settingsChanged} /><p class="export-hint batch-detail">Clean the batch to calculate exact sizes before saving.</p></section>
    <section class="inspector-section"><div class="section-label"><h3>Output folder</h3><Icon name="folder" size="sm" /></div><p class="batch-detail">{output?.path || 'Choose where to save the cleaned copies.'}</p><button class="btn btn-secondary" on:click={chooseOutput} disabled={busy || choosing}>{output ? 'Change output folder' : 'Choose output folder'}</button><p class="export-hint batch-detail">Subfolders are combined here. Your source folders stay unchanged.</p></section>
  </div>
  <div class="inspector-action">
    {#if busy}<p role="status">{stateLabel}</p><button class="btn btn-secondary" on:click={cancel} disabled={cancelled}>{cancelled ? 'Cancelling…' : 'Cancel processing'}</button>
    {:else}
      {#if available.length}<p>{available.length} files ready to save · {formatBytes(available.reduce((sum, row) => sum + row.result.size, 0))}</p><button class="btn btn-primary" disabled={choosing} on:click={save}>Save cleaned files</button>{/if}
      {#if remaining.length}<button class="btn" class:btn-primary={!available.length} class:btn-secondary={!!available.length} disabled={choosing} on:click={clean}>{rows.some(row => row.result) ? 'Clean remaining images' : 'Clean batch'}</button>{/if}
      {#if !available.length && !remaining.length}<p>Batch complete. {rows.filter(row => row.status === 'Saved').length} copies saved.</p>{/if}
    {/if}
  </div>
</aside>
<MetadataComparison bind:this={comparison} />
