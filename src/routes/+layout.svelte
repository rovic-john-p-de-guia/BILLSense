<script>
	import '../app.css';

	let { children } = $props();
</script>

<div class="app-container">
	{@render children()}
</div>

<style>
	.app-container {
		min-height: 100vh;
		background-color: var(--bg-color);
	}
</style>
