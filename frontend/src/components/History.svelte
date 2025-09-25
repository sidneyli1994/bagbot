<script>
	import { onMount } from "svelte";
	import { isLoggedIn, userid } from '../store.js'; // Importamos el store
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
	let loggedIn; //Esta logueado?
    let userId; //id del usuario
	isLoggedIn.subscribe(value => { loggedIn = value; });
	userid.subscribe(value => { userId = value; });
	let dates = [];
	let today = new Date().toISOString().split("T")[0]; // fecha de hoy yyyy-mm-dd
	async function loadDates() {
		const res = await fetch(`http://127.0.0.1:5000/dates?user_id=${userId}`);
		dates = await res.json();
	}
	// Solo carga fechas si el usuario está logueado
	onMount(() => {
		if (loggedIn) {
			loadDates();
		}
	});
	function selectDate(date){
		dispatch("selectedDate", date); // Enviar fecha al componente padre
	}
	function reloadPage() {
        location.reload();
    }

</script>

<div class="history">
	<h3 class="history_title">Historial</h3>
	<div class="history_content">
		{#if loggedIn}
			{#if !dates.find(d => d.original === today)}
				<button class="btn btn-primary" on:click={reloadPage}>
					{new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
				</button>
			{/if}

			{#each dates as date}
				<button class="btn btn-primary" on:click={() => selectDate(date.original)}>{date.beauty}</button>
			{/each}
		{:else}
			<div class="msgLoginSect"><p  class="msgLogin">Inicia sesión para acceder a esta sección</p></div>
		{/if}
	</div>
</div>

<style>
	.history_title {
		margin: 5px 0 15px;
	}
	.msgLogin{
		font-size: 18px;
		margin: 5px 0;
	}
	.history {
		font-size: 18px;
		padding: 10px 20px;
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23);
		margin-top: 20px;
		margin-left: 15px;
		display: flex;
		flex-direction: column;
		background: #f7f7f7;
		height: calc(100vh - 315px) !important;
	}
	.history_content{
		width: 100%;
		overflow-y: auto;
	}
	.btn{
		width: 100%;
	}
	.history_content::-webkit-scrollbar {
        width: 8px;  
    }

    .history_content::-webkit-scrollbar-track {
        background: #edf4ff; 
    }

    .history_content::-webkit-scrollbar-thumb {
        background-color: #8dc3f1;
        border-radius: 20px;
        border: 1px solid #eaf1ff;
    }
@media only screen and (max-width: 1280px) {
	.msgLoginSect .msgLogin{
		font-size: 15px;
	}
}
</style>
