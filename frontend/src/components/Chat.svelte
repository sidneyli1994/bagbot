<script>
    import History from "./History.svelte";
    import Chatbox from "./Chatbox.svelte";
    
    let selectedDate = null; // Fecha seleccionada en history
    let locked = false;      // Bloquear input/botón cuando se selecciona historial
    // Función para comparar si la fecha seleccionada es hoy
    function isToday(date) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        return date === today;
    }
  // Handler cuando se selecciona una fecha
    function handleDateSelected(date) {
        selectedDate = date;
        locked = !isToday(date);// Bloquea Chatbox para evitar nuevas consultas solo si la fecha no es hoy
    }
</script>

<div class="container">
    <div class="left-panel">
        <History on:selectedDate={(e) => handleDateSelected(e.detail)} />
    </div>
    <div class="right-panel">
        <Chatbox {selectedDate} {locked}  />
    </div>
</div>

<style>
.container{
	display: flex;
	justify-content: center;
}
.left-panel {
	width: 20%;
}
.right-panel {
	display: flex;
	justify-content: center;
	flex: 80;
}
</style>