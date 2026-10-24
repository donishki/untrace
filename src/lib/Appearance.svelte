<script>
  import { THEMES, theme } from './theme.js';
  import Icon from './Icon.svelte';
  let dialog;
  export function open() { dialog.showModal(); }
  export function isOpen() { return !!dialog?.open; }
</script>

<dialog class="modal appearance-dialog" bind:this={dialog} aria-labelledby="appearance-title" style:margin="auto" style:width="calc(100% - var(--space-6))" style:max-width="calc(var(--space-9) * 8)">
  <div class="appearance-content">
    <div class="help-heading">
      <div><span class="overline">Make it yours</span><h2 id="appearance-title">Appearance</h2></div>
      <button class="btn btn-ghost" type="button" on:click={() => dialog.close()} aria-label="Close appearance"><Icon name="close" /></button>
    </div>
    <div class="appearance-description">Choose a theme for your workspace. Your choice is saved automatically.</div>
    <fieldset class="theme-choices">
      <legend class="visually-hidden">Workspace theme</legend>
      <label class="system-choice">
        <input class="radio" type="radio" name="workspace-theme" value="system" checked={$theme === 'system'} on:change={() => theme.select('system')} />
        <span><span class="theme-name">Follow Windows</span><span class="theme-description">Match the system light or dark setting.</span></span>
        <Icon name="monitor" />
      </label>
      {#each [{ name: 'Editor favourites', items: THEMES.filter(item => item.editor) }, { name: 'Untrace originals', items: THEMES.filter(item => !item.editor) }] as group}
      <div class="theme-group">
      <h3 class="theme-group-title">{group.name}</h3>
      <div class="theme-grid">
        {#each group.items as item}
          <label class="theme-choice" class:selected={$theme === item.id}>
            <div class="theme-mini" data-theme={item.id} aria-hidden="true">
              <span class="mini-rail"></span><span class="mini-header"></span>
              <span class="mini-canvas"><span class="mini-image"><Icon name="image" size="sm" /></span></span>
              <span class="mini-inspector"><span></span><span></span><span class="mini-action"></span></span>
            </div>
            <span class="theme-choice-label">
              <input class="radio" type="radio" name="workspace-theme" value={item.id} checked={$theme === item.id} on:change={() => theme.select(item.id)} />
              <span><span class="theme-name">{item.name}</span><span class="theme-description">{item.description}</span></span>
            </span>
          </label>
        {/each}
      </div>
      </div>
      {/each}
    </fieldset>
    <div class="appearance-note"><Icon name="image" size="sm" />Themes change the workspace, never your image or exported colours.</div>
    <div class="appearance-footer"><button class="btn btn-secondary" type="button" on:click={() => dialog.close()}>Done</button></div>
  </div>
</dialog>
