<script>
    import { createEventDispatcher } from 'svelte';
    import {login } from '../store.js';
    let open_eye = './assets/eyeOpen.png';
	  let close_eye = './assets/eyeClose.png';
    let email = '';
    let password = '';
    let errMessage = '';
    let showPwd = false; //Contraseña oculta
    const dispatch = createEventDispatcher();
    // Función para manejar el clic del botón de close login
    function handleCloseClick() {
        dispatch('closeLogin'); // Emitir un evento llamado "closeLogin"
    }
    function toglePassword(){
        showPwd = !showPwd; // alterna true/false
    }
    async function clickButton() {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) {
          // Si el email no es correcto
          errMessage= 'El correo no es válido';
          setTimeout(() => {
            errMessage = '';
          }, 8000);
          return;
        }
        // Llama a login con los datos registrados
            const loginMsg = await login(email, password); //funcion en store.js
            errMessage =(loginMsg);
            setTimeout(() => {
              errMessage = '';
            }, 8000);
    }
    function registerOption() {
        dispatch('nav', { view: 'register' });
    }
    function forgotPWD() {
        dispatch('nav', { view: 'forgot' });
    }
</script>

  <div class="containerForm">
    <h2 class="title">Inicio de Sesión</h2>
    <button class="btn btn-primary close" on:click={handleCloseClick}>X</button>
    <form class="form" on:submit|preventDefault={clickButton}>
      <input class="inputLogin" name="email" type="email" placeholder="Correo" bind:value={email} required/>
      <div class="pwdSect">
        {#if showPwd}
          <input class="inputLogin last" name="password"  type='text' placeholder="Contraseña" bind:value={password} autocomplete="off" required/>
        {:else}
          <input class="inputLogin last" name="password"  type='password' placeholder="Contraseña" bind:value={password} autocomplete="off" required/>
        {/if}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div class="showPass" on:click={toglePassword}>
          <img class="avatar" src={showPwd ? close_eye : open_eye } alt="avatar" />
        </div>
      </div>

      <p class="errMessage">{errMessage}</p>
      <button class="btn btn-primary login" type="submit">Iniciar Sesión</button>
    </form>
    <button class="registerButton one" on:click={forgotPWD}>¿Olvidó su Contraseña? </button>
    <button class="registerButton two" on:click={registerOption}>¿No está registrado? Regístrese </button>
  </div>

<style>
.errMessage{
  color: red;
}
.containerForm{
  display: flex;
  flex-direction: column;
  width: 500px;
  align-items: center;
  margin: 60px auto;
  background: #f9f9f9;
  padding: 0px 10px 20px;
  box-shadow: 0px 0px 15px #d9d9d9;
  position: relative;
}
.form{
  text-align: center;
  width: 100%;
}
.btn.close{
  position: absolute;
  top: 0;
  right: 0;
}
.inputLogin{
    border: none;
    width: 90%;
    padding: 10px;
    border-radius: 1.125rem;
    box-shadow: -2px 3px 6px #dcdcdc;
    font-weight: 400;
    letter-spacing: 0.025em;
    margin-bottom: 20px;
    border: 1px solid #fff;
}
.inputLogin:focus{
  outline: none;
  border: 1px solid #3980bb;
}
.inputLogin.last{
  margin-bottom: 0px;
  width: 94%;
}
.showPass{
  margin-top: 3px;
}
.pwdSect{
  display: flex;
  width: 90%;
  align-items: center;
  justify-self: center;
  justify-content: space-between;
}
.registerButton{
  background: transparent;
  cursor: pointer;
  border: none;
  transition: all ease 300ms;
  margin-top: 15px;
}
.registerButton.one {
  margin-bottom: 0;
}
.registerButton.two {
  margin-top: 0;
}
.registerButton:hover{
  text-decoration: underline;
  color: #000;
}
</style>