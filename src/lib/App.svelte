<script>
  import Sidebar from './components/layout/Sidebar.svelte';
  import Workspace from './components/layout/Workspace.svelte';
  import FileExplorer from './components/layout/FileExplorer.svelte';
</script>

<div class="klay-app">
  <Sidebar />
  <main class="main-workspace">
    <Workspace />
  </main>
  <FileExplorer />
</div>

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0a0a0c;
    color: #e2e2e6;
    font-family: 'Space Grotesk', sans-serif;
  }

  .klay-app {
    display: grid;
    grid-template-columns: 240px 1fr 300px;
    height: 100vh;
    overflow: hidden;
  }

  .main-workspace {
    border-left: 1px solid #1f1f23;
    border-right: 1px solid #1f1f23;
    display: flex;
    flex-direction: column;
  }
</style>
