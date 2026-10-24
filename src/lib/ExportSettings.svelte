<script>
  import { createEventDispatcher } from 'svelte';
  import { saveExportSettings } from './export-settings.js';
  export let format = 'auto';
  export let quality = 0.92;
  export let busy = false;
  const dispatch = createEventDispatcher();
  function changed() { saveExportSettings(format, quality); dispatch('change'); }
</script>

<div class="export-fields">
  <div class="field"><label for="export-format">File format</label><select id="export-format" class="select" bind:value={format} on:change={changed} disabled={busy}><option value="auto">Automatic</option><option value="image/png">PNG · preserve transparency</option><option value="image/jpeg">JPEG · smaller file</option></select></div>
  {#if format === 'image/jpeg'}<div class="field"><label for="export-quality">JPEG quality</label><select id="export-quality" class="select" bind:value={quality} on:change={changed} disabled={busy}><option value={0.92}>High · 92%</option><option value={1}>Maximum · 100%</option><option value={0.85}>Balanced · 85%</option></select></div>{/if}
  <p class="export-hint">{format === 'image/png' ? 'Preserves transparency. Files may be larger.' : format === 'image/jpeg' ? 'Transparency is flattened onto white.' : 'Small PNGs stay PNG. Other images become JPEG on white.'} Settings are remembered.</p>
</div>
