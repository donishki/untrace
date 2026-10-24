<script>
  import { onMount } from 'svelte';
  import { theme } from './lib/theme.js';
  import Workspace from './lib/Workspace.svelte';
  onMount(() => theme.init());
</script>

<Workspace />
