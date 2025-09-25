<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

	let bagbot_avatar = './assets/bagbot.png';
    // Función para manejar el clic del botón Invitado
    function guest() {
        dispatch('nav', { view: 'guest' });
    }
    // Función para manejar el clic del botón iniciar sesion
    function user() {
        dispatch('nav', { view: 'login' });
    }
</script>

<div class="mainBagbot">
    <div class="container">
        <img class="avatar" src={bagbot_avatar} alt="avatar" />
        <div class="mainMessage">
            <h1 class="title">Hola, mi nombre es Bagbot, soy el asistente virtual de la Biblioteca Alonso Gamero (BAG) <br> ¿Deseas iniciar sesión o ingresar como invitado?</h1>
        </div>
    </div>
    
    <div class="options">
        <button class="btn btn-primary" on:click={user}>Iniciar Sesión</button>
        <button class="btn btn-primary" on:click={guest}>Entrar como invitado</button>
    </div>
</div>

<style>
	.avatar {
		border-radius: 50%;
		width: 90px;
		height: 90px;
		max-width: 90px;
		max-height: 90px;
		margin: 5px;
        animation: float 3s ease-in-out infinite;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        margin-right: 30px;
	}
	.container {
		display: flex;
	}
    .mainBagbot{
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: 5%;
    }
    /* Floating animation */
    @keyframes float {
    0% {
        transform: translateY(0px);
    }
    50% {
        transform: translateY(-20px);
    }
    100% {
        transform: translateY(0px);
    }
    }
    .title {
    font-size: 25px;
    text-align: center;
    font-weight: bold;
    background: linear-gradient(270deg, #050036, #133b9e, #5092d9, #61abff);
    background-size: 600% 600%;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: colorChange 6s ease infinite;
    margin-top: 20px;
    }

    /* Gradient text animation */
    @keyframes colorChange {
    0% {
        background-position: 0% 50%;
    }
    50% {
        background-position: 100% 50%;
    }
    100% {
        background-position: 0% 50%;
    }
    }
</style>