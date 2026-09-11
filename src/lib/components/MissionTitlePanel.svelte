<script lang="ts">
	type Props = { name: string };

	let { name }: Props = $props();
</script>

<section class="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur">
	<h1 class="text-center text-3xl leading-tight font-bold text-slate-50">{name}</h1>
</section>
