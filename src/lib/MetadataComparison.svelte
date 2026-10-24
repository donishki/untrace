<script>
  import Icon from './Icon.svelte';
  import { compareMetadata } from './metadata-comparison.js';
  let dialog;
  let before, after, filename;
  $: rows = compareMetadata(before, after);
  export function open(original, cleaned, name) { before = original; after = cleaned; filename = name; dialog.showModal(); }
  export function isOpen() { return !!dialog?.open; }
</script>

<dialog class="modal comparison-dialog" bind:this={dialog} aria-labelledby="comparison-title" style:margin="auto" style:width="calc(100% - var(--space-6))" style:max-width="calc(var(--space-9) * 10)">
  <div class="comparison-content">
    <div class="help-heading"><div><span class="overline">{filename}</span><h2 id="comparison-title">Metadata comparison</h2></div><button class="btn btn-ghost" aria-label="Close comparison" on:click={() => dialog.close()}><Icon name="close" /></button></div>
    <p class="export-hint">Fields detected in the original and the encoded copy. Image headers and an encoder-generated colour profile can remain or change. “Not detected afterward” is a scan result, not proof that all metadata is gone.</p>
    {#if before?.scanError || after?.scanError}<p class="status warn">Some metadata could not be read. Missing fields are unverified where parsing failed.</p>{/if}
    <div class="comparison-scroll">
      <table class="table"><thead><tr><th scope="col">Field</th><th scope="col">Original</th><th scope="col">Cleaned copy</th><th scope="col">Result</th></tr></thead><tbody>
        {#each rows as row}<tr><th scope="row">{row.name}</th><td>{row.before}</td><td>{row.after}</td><td>{row.status}</td></tr>{/each}
        {#if !rows.length}<tr><td colspan="4">No recognized fields to compare.</td></tr>{/if}
      </tbody></table>
    </div>
    <div class="appearance-footer"><button class="btn btn-secondary" on:click={() => dialog.close()}>Done</button></div>
  </div>
</dialog>
