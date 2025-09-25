<script>
    let bagbot_avatar = './assets/bagbot.png';
</script>

<div class="container">
    <img class="avatar" src={bagbot_avatar} alt="avatar" />
    <div class="mainMessage">
        <h1 class="title">Hola, mi nombre es Bagbot, por favor ingresa desde un dispositivo de escritorio para acceder a mis funcionalidades.</h1>
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
    margin-right: 15px;
}
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-top: 25px;
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
font-size: 22px;
line-height: 28px;
text-align: center;
font-weight: bold;
background: linear-gradient(270deg, #050036, #133b9e, #5092d9, #61abff);
background-size: 600% 600%;
background-clip: text;
-webkit-text-fill-color: transparent;
animation: colorChange 6s ease infinite;
margin: 15px;
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