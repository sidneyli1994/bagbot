<script>
	import Chat from './components/Chat.svelte'
	import Header from './components/Header.svelte';
	import Footer from './components/Footer.svelte';
	import Main from './components/Main.svelte';
	import Onlymob from './components/Onlymob.svelte';
	import Login from './components/Login.svelte'
	import Register from './components/Register.svelte'	
	import Forgot from './components/Forgot.svelte';
	import { onMount } from 'svelte';
	import { user, userid, token, isLoggedIn } from './store.js';
  import { comment } from 'svelte/internal';


	//Manejo de la vista a mostrar
	let view = 'main'; // main, login, register o guest
	let lastview = '';

	function changeView(event) {
		view = event.detail.view;
		if (view == 'guest'){
			lastview = 'guest';
		}else if (view == 'main'){
			lastview = '';
		}
	}

	function handleCloseLogin() {
		//Si la vista anterior es guest muestra guest sino main
		if (lastview == 'guest'){
			view = 'guest';
		}else{
			view = 'main';
		}
	}
	function handleCloseRegister() {
		view = 'login';
	}


	let schema = "S"
	function getSchema() {
		fetch("./schema")
		.then(c => c.text())
		.then(c => (schema = c));
	}

	let userName;
	let loggedIn;

	isLoggedIn.subscribe(value => { loggedIn = value; });
	user.subscribe(value => { userName = value; });

	 // Al cargar el componente, verifica si hay un token guardado
	onMount(async () => {
		const storedToken = localStorage.getItem('jwt_token');
		if (storedToken) {
			try {
				const response = await fetch('http://127.0.0.1:5000/protected', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${storedToken}`,
					'Content-Type': 'application/json'
				}
				});

				if (response.ok) {
					const result = await response.json();
					token.set(storedToken);  // Establece el token en el store
					let username= result.nombre;
					user.set(username);
					userid.set(result.id)
					isLoggedIn.set(true);
				} else {
					// Si el token no es válido o ha expirado, limpiar el localStorage
					logout();
				}
			} catch (error) {
				console.error("Error al verificar la sesión:", error);
				logout();
			}
		} else {
			// Si no hay token, asegura que no se considere autenticado
			isLoggedIn.set(false);
		}
		//Reinicia al json al recargar la pagina
		try {
			const res = await fetch("http://127.0.0.1:5000/reset-chat-json", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			const data = await res.json();
			console.log("JSON reiniciado:", data.message);
		} catch (error) {
			console.error("Error al reiniciar JSON:", error);
		}
	});

	function logout() {
		//Limpia todo para cerrar la sesion
		localStorage.removeItem('jwt_token');
		token.set(null);
		user.set(null);
		isLoggedIn.set(false);
	}
</script>


<Header on:nav={changeView} />
<main class="main">
	{#if loggedIn}
	<!--Aquí se muestra la vista principal del chatbot cuando ya inicio de sesión-->
		<Chat />
	{:else if view === 'main'}
		<Main on:nav={changeView} />
	{:else if view === 'login'}
		<Login on:closeLogin={handleCloseLogin} on:nav={changeView} />
	{:else if view === 'register'}
		<Register on:closeRegister={handleCloseRegister} />
	{:else if view === 'forgot'}
		<Forgot on:closeRegister={handleCloseRegister} />
	{:else if view === 'guest'}
		<!--Aquí se muestra la vista principal del chatbot cuando no está en inicio de sesión-->
		<Chat />
	{/if}
</main>
<div class="onlyMob">
	<Onlymob />
</div>

<Footer />

<style>
@media only screen and (min-width: 998px) {
	.onlyMob{
		display: none;
	}
}
@media only screen and (max-width: 997px) {
	.main{
		display: none;
	}
	.onlyMob{
		display: block;
	}
}
</style>
