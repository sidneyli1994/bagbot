<script>
    import { createEventDispatcher } from 'svelte';
    import {login } from '../store.js';

    let typePerson = ""; // Guarda si es "Estudiante", "Profesor" o "Empleado"
    let fullname = '';
    let sex = '';
    let idnumber = ''; //cedula
    let library = ''; //Cargo
    let dependence = ''; //escuela o administrativo
    let position = ''; //Cargo
    let email = '';
    let password = '';
    let validatePassword = '';
    let errMessage = '';
    let okMessage = '';
    const dispatch = createEventDispatcher();

    // Función para manejar el clic del botón de close Registro
    function handleCloseClick() {
        dispatch('closeRegister'); // Emitir un evento llamado "closeRegister" y vualve a la vista login
    }

    function resetPerson() {
        typePerson = ''; // Cambia la variable a vacio para volver a la vista de seleccion de tipo de persona
    }
    function clickButton() {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) {
          // Si el email no es correcto
            errMessage= 'El correo no es válido';
            setTimeout(() => {
                errMessage = '';
            }, 8000);
            return;
        }
        if (password != validatePassword) {
          // Si el email no es correcto
            errMessage= 'Las contraseñas no coinciden';
            setTimeout(() => {
                errMessage = '';
            }, 8000);
            return;
        }
        register();
    }
    // Función para manejar el registro
    const register = async () => {
        const response = await fetch('http://127.0.0.1:5000/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            fullname,
            email,
            sex,
            idnumber,
            password,
            library,
            typePerson,
            dependence,
            position
        })
    });

    const data = await response.json();
        if (response.ok) {
            okMessage =(`Usuario ${data.id} registrado con éxito`);
            // Llama a login con los datos registrados
            setTimeout(async () => {
                const loginMsg = await login(email, password);
            }, 3000);
        } else {
            errMessage =data.msg;
        }
    };
</script>

<div class="containerForm">
    <h2 class="title">Registro {#if typePerson != ""}- {typePerson}{/if}</h2>
    <form class="form" on:submit|preventDefault={clickButton}> 
        {#if typePerson === ""}
            <!-- Select para elegir tipo de persona-->
            <button class="btn btn-primary close" on:click={handleCloseClick}>X</button>
            <p class="typeMessage">Indique el tipo de usuario del sistema:</p>
            <select id="type" bind:value={typePerson} class="options">
                <option value="" disabled selected>Seleccione el tipo de Usuario</option>
                <option value="Profesor">Profesor</option>
                <option value="Estudiante">Estudiante</option>
                <option value="Empleado">Empleado</option>
            </select>
        {:else}
            <button class="btn btn-primary close" on:click={resetPerson}>X</button>
            <input class="inputRegister" name="fullname" type="text" bind:value={fullname} placeholder="Nombres y Apellidos" required/>
            <div class="dataSect">
                <select bind:value={sex} id="sexo" class="options data" required>
                    <option value="" disabled selected>Seleccione su sexo</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                </select>
                <input class="inputRegister data" name="idnumber" type="text" bind:value={idnumber} placeholder="Cédula - Ej:V12345678" required/>
            </div>
            <select bind:value={library} id="library" class="options" required>
                <option value="" disabled selected>Biblioteca:</option>
                <option value="BAG">Biblioteca Alonso Gamero - BAG</option>
                <option value="OTRA">Otra</option>
            </select>
            {#if typePerson === "Empleado"}
                <input class="inputRegister" name="position" type="text" bind:value={position} placeholder="Cargo que Ocupa" required/>
            {:else}
                <select bind:value={dependence} id="dependence" class="options" required>
                    <option value="" disabled selected>Seleccione su Escuela/Dependencia</option>
                    <option value="COMPUTACIÓN">COMPUTACIÓN</option>
                    <option value="MATEMÁTICA">MATEMÁTICA</option>
                    <option value="QUÍMICA">QUÍMICA</option>
                    <option value="GEOQUÍMICA">GEOQUÍMICA</option>
                    <option value="FÍSICA">FÍSICA</option>
                    <option value="BIOLOGÍA">BIOLOGÍA</option>
                    <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                    <option value="OTRA">OTRA</option>
                </select>
            {/if}
            <input class="inputRegister" name="email" type="email" bind:value={email} placeholder="Correo" required/>
            <input class="inputRegister" name="password" type="password" bind:value={password} placeholder="Contraseña" autocomplete="off" required/>
            <input class="inputRegister" name="validatePassword" type="password" bind:value={validatePassword} placeholder="Validar Contraseña" autocomplete="off" required/>
            <p class="errMessage">{errMessage}</p>
            <p class="okMessage">{okMessage}</p>
            <button class="btn btn-primary" type="submit">Registrar</button>
        {/if}
    </form>
</div>


<style>
.errMessage{
    color: red;
}
.okMessage{
    color: #1d8600;
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
.inputRegister, .options{
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
.inputRegister:focus, .options:focus{
    outline: none;
    border: 1px solid #3980bb;
}
.dataSect{
    display: flex;
    justify-content: space-between;
    width: 90%;
    justify-self: center;
}
.data{
    width: 46%;
}

</style>


