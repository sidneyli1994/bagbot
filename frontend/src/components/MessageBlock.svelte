<script>
	let bagbot_avatar = './assets/bagbot.png';
	let user_avatar = './assets/user.png';
	import { showOptions,selectedOption } from '../store';
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
	export let message;
	export let locked = false;
	export let lastMessage = false;
	export let chatLength = 0;
	export let selectedDate = null;
	let today = new Date().toISOString().split("T")[0];

	let showOpt;
	showOptions.subscribe(value => { showOpt = value; });

	function optionSelected(option) {
		selectedOption.set(option);
		showOptions.set(false);
        dispatch('optionSel', { option: option });
    }
	function optionSelectedMenu(option) {
		selectedOption.set(option);
		showOptions.set(true);
        dispatch('optionSel', { option: option });
    }
	// Evaluar si el mensaje contiene "Indicame tu consulta por favor" o "PDF procesado con éxito" para no mostrar el boton de ver opciones
	$: isAQuestion = message.message.includes("Seleccionaste la opción") || message.message.includes("PDF procesado con éxito");

</script>

<!-- tipo 0 = usuario y tipo 1 = bagbot agregamos las clases correspondientes para los estilos de la vista-->
<div class="container {message.type === 0 ? 'own-container' : ''}">
	<img class="avatar" src={message.type === 0 ? user_avatar : bagbot_avatar} alt="avatar" />
	<section class={
  	`${message.type === 0 ? 'message own-message' : 'message'} ${showOpt ? 'messageColumn' : ''}`}>
		<div class="mensaje" class:noshowOpt={lastMessage}><span>{@html message.message}</span></div>
		{#if message.type === 1 && showOpt && lastMessage && !locked}
			<div class="buttonsOpt">
				<button class="btn btn-primary" on:click={() => optionSelected("📚 Información de la Biblioteca")}>📚 Información de la Biblioteca</button>
				<button class="btn btn-primary" on:click={() => optionSelected("📖 Buscar libros o recursos")}>📖 Buscar libros o recursos</button>
				<button class="btn btn-primary" on:click={() => optionSelected("🧠 Recomendaciones bibliográficas")}>🧠 Recomendaciones bibliográficas</button>
				<button class="btn btn-primary" on:click={() => optionSelected("📑 Crear informe o contenido")}>📑 Crear informe o contenido</button>
				<button class="btn btn-primary" on:click={() => optionSelected("📝 Resumir un recurso PDF")}>📝 Resumir un recurso PDF</button>
				<button class="btn btn-primary" on:click={() => optionSelected("❓ Hacer una consulta libre")}>❓ Hacer una consulta libre</button>
			</div>
		{/if}
		{#if !selectedDate || selectedDate === today}
			{#if lastMessage && chatLength>1 && !showOpt && !isAQuestion && message.type === 1 }
				<div class="extra-message">
					<p class="extra-text">¿Hay algo más en lo que te pueda ayudar sobre esta opción?, recuerda que no tengo acceso al contexto previo, es decir, <strong>no tengo memoria</strong>, por lo que debes ser específico(a), ¿o deseas ver el Menú de Opciones? --></p>
					<button class="btn btn-primary extra" on:click={() => optionSelectedMenu("Ver Opciones")}>Ver Opciones</button>
				</div>
			{/if}
		{/if}
	</section>
	
</div>


<style>
.avatar {
	border-radius: 50%;
	width: 60px;
	height: 60px;
	margin: 5px;
}
.container {
	display: flex;
}
.container.own-container {
	flex-direction: row-reverse;
}
.message {
	box-sizing: border-box;
	padding: 10px 14px;
	margin: 5px 10px;
	background: #ffffff;
	border-radius: 18px 18px 18px 0;
	min-height: 36px;
	width: fit-content;
	max-width: 80%;
	font-size: 17px;
}
.messageColumn{
	flex-direction: column;
}
.message.own-message {
	align-self: flex-end;
	margin: 1rem 1rem 1rem auto;
	border-radius: 18px 18px 0 18px;
	background: #333333;
	color: #ffffff;
}
.extra-message{
	display: flex;
	align-items: center;
	margin-top: 15px;
}
.extra-message .extra-text{
	margin: 0 10px 0 0;
}
.btn.extra{
	min-width: 150px;
}
@media only screen and (max-width: 1280px) {
	.message{
		font-size: 15px;
	}
}
</style>
