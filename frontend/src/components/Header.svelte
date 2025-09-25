<script>
    import { createEventDispatcher } from 'svelte';
    import { user, userid, token, isLoggedIn } from '../store.js';

    let userName;
    let userId;
    let loggedIn;

	isLoggedIn.subscribe(value => { loggedIn = value; });
    //isLoggedIn.subscribe(value => { loggedIn = value; });
	user.subscribe(value => { userName = value; });
    userid.subscribe(value => { userId = value; });

    // Crear un despachador de eventos
    const dispatch = createEventDispatcher();

    // Función para manejar el clic del botón de iniciar sesión
    function showLogin() {
        dispatch('nav', { view: 'login' }); // Emitir un evento llamado "login"
    }
    function _logout() {
		//Limpia todo para cerrar la sesion
		localStorage.removeItem('jwt_token');
        localStorage.removeItem('Test');
		token.set(null);
		user.set(null);
        userid.set(null);
		isLoggedIn.set(false);
        window.location.reload();
        //dispatch('nav', { view: 'main' });
	}
    // Función para manejar el clic del botón inicio, para mostrar la vista principal
    function main() {
        dispatch('nav', { view: 'main' });
    }
</script>

<header class="bagHeader">
	<div class="headerContainer">
        <div class="header">
            <p>BAG - Bliblioteca Alonso Gamero - UCV</p>
            <div class="lastTop">
                <p class="welcome">{#if loggedIn}
                    Bienvenid@ {userName} - {userId}
                    {:else}
                    Bienvenid@
                    {/if}
                </p>
                {#if loggedIn}
                    <button class="login" on:click={_logout}>Cerrar Sesión</button>
                {:else}
                    <button class="login" on:click={showLogin}>Iniciar Sesión</button>
                {/if}
            </div>
        </div>
        <div class="top">
            <img class="logoBag" src="./assets/logoBag.png" alt="logoBag" />
            <!--<div class="buscador"> <input type="text" placeholder="Buscar por Cota | Título | Autor | Materia | Editorial..."></div>-->
            <div class="nameBagbot"><img class="logoBagbot" src="./assets/logo-BagBot.png" alt="logoBagBot" /></div>
            <div class="lastLogos">
                <img class="logoCiens" src="./assets/ciencias.jpeg" alt="logoCiencias" />
                <img class="logoUCV" src="./assets/ucv-logo.svg" alt="logoUCV" />
            </div>
        </div>
        <div class="topBar">
            {#if loggedIn==false}<button class="barOption system" on:click={main}>Inicio</button>{/if}
            <a href="https://sidneyli1994.github.io/bagbot-home-local/" class="barOption backBag">Volver al sistema BAG</a>
            {#if loggedIn}<button class="barOption system" on:click={_logout}>Cerrar Sesión</button>{/if}
        </div>
	</div>
</header>

<style>
.bagHeader{
	height: 186px;
}
.headerContainer{
	position: fixed;
	width: 100%;
    top: 0;
    background: #fff;
    z-index: 9999999;
}
.header{
	background: #272727;
	color: #a3a3a3;
	display: flex;
	justify-content: space-between;
    padding: 0 100px;
}
.header p{
    margin: 12px 0;
}
.lastTop{
	display: flex;
    align-items: center;
}
.login{
	margin-left: 150px;
    background: transparent;
    color: #a3a3a3;
    border: unset;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0;
}
.login:hover{
    color: #fff;
}
.top{
	display: flex;
	justify-content: space-between;
    padding: 6px 90px;
    align-items: center;
}
.logoBag{
    width: 160px;
}
.logoCiens{
	width: 80px;
}
.logoUCV, .logoBagbot{
	width: 135px;
}
.topBar{
	background: #3980BB;
	display: flex;
	color: #fff;
	padding: 0 100px;
}
.topBar .barOption{
	margin: 0;
    padding: 15px 25px;
    font-weight: bold;
    cursor: pointer;
	text-align: center;
    color: #fff;
    background: #3980BB;
    border: none;
    text-decoration: none;
	transition: all ease 300ms;
}
.topBar .barOption:hover{
	background: #CF8B4E;
}
@media only screen and (max-width: 1180px) {
  .lastTop .welcome{
    display: none;
  }
}
@media only screen and (max-width: 997px) {
  .login, .barOption.system{
    display: none;
  }
  .header, .topBar{
    justify-content: center;
  }
}
@media only screen and (max-width: 740px) {
    .header, .topBar{
        padding: 0 15px;
    }
    .top{
        padding: 6px 0 6px 15px;
    }
    .logoBag{
        width: 100px;
    }
    .logoCiens{
        width: 40px;
    }
    .logoUCV, .logoBagbot{
        width: 70px;
    }
}
</style>