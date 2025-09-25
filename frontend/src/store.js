import { writable } from 'svelte/store';

export const user = writable(null);
export const userid = writable(null);
export const token = writable(null);
export const isLoggedIn = writable(false);
export const showOptions = writable(true); //Mostrar o no, las opciones del chatbot
export const selectedOption = writable(null); //Opcion seleccionada

    // Función para manejar el inicio de sesión
export async function login(email, password) {
    const response = await fetch('http://127.0.0.1:5000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (response.ok) {
        localStorage.setItem('jwt_token', result.access_token);  // Guardar token
        let fullname= result.nombre;
        token.set(result.access_token)
        user.set(fullname);
        userid.set(result.id);
        isLoggedIn.set(true);
        window.location.reload();
    } else {
        return result.message;
    }
}