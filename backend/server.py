from datetime import datetime, timedelta
from babel.dates import format_date
from flask_bcrypt import Bcrypt
from flask import Flask, send_file, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import inspect, text, desc
from flask_cors import CORS
from typing import List, Dict, Any
from dotenv import load_dotenv
import requests
import os
import json
import re
##Para el manejo del PDF
from io import BytesIO
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import fitz # PyMuPDF

userOption = None #variable que guarda la opcion seleccionada por el usuario para hacer la consulta a la ia
resumen_storage = {} # Almacenamiento temporal de resúmenes por nombre para el resumen del PDF
app = Flask(__name__)
CORS(app)  # Habilitar CORS

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:123456@localhost/bagucv' # Configura la URI de conexión a la base de datos PostgreSQL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Evitar que SQLAlchemy rastree modificaciones (esto mejora el rendimiento)
# Inicializa SQLAlchemy
db = SQLAlchemy(app)
app.config['JWT_SECRET_KEY'] = os.urandom(24)  #Llave secreta JWT
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=2)  #Token JWT expira a las 2h
jwt = JWTManager(app) #manejo de sesiones de usuarios
bcrypt = Bcrypt(app) #para encriptar contraseñas

load_dotenv() #carga las variables de entorno definidas en el archivo .env 
GROQ_API_KEY = os.getenv("GROQ_API_KEY")  #api de GROQ IA
print(GROQ_API_KEY)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"  #Groq url
UPLOAD_FOLDER = 'uploads' #carpeta para subir PDF
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

JSON_FILE = 'chat.json' #Ruta donde se almacenará el archivo JSON del chat

# Verificar si el archivo JSON existe, si no, crearlo vacío
if not os.path.exists(JSON_FILE):
    with open(JSON_FILE, 'w') as f:
        json.dump([], f)
        
class Consultas(db.Model):  # Definición del modelo de consultas BD
    __tablename__ = 'consultas'
    #Columnas de la tabla
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.String(255), nullable=False)
    nombre = db.Column(db.String(255), nullable=False)  
    descripcion = db.Column(db.Text, nullable=False)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())
    tipo = db.Column(db.Integer, nullable=False) #0=usuario, 1=chatbot

class UsuariosBagbot(db.Model):  # Definición del modelo de usuariosBagbot BD
    __tablename__ = 'usuarios_bagbot'
    #Columnas de la tabla
    id = db.Column(db.String(255), primary_key=True)  # Ej: U12345678
    nombre = db.Column(db.String(255), nullable=False)
    correo = db.Column(db.String(255), unique=True, nullable=False)
    sexo = db.Column(db.String(255), nullable=False)
    cedula = db.Column(db.String(255), nullable=False)
    contraseña = db.Column(db.String(255), nullable=False)
    biblioteca = db.Column(db.String(255))
    categoria = db.Column(db.String(255))
    escuela = db.Column(db.String(255))
    cargo = db.Column(db.String(255))
    fecha_registro = db.Column(db.DateTime, server_default=db.func.now())

# Reinicia el JSON con el mensaje inicial
@app.route('/reset-chat-json', methods=['POST'])
def reset_chat():
    chat = []
    with open(JSON_FILE, 'w') as f:
        json.dump(chat, f, indent=4)
    return jsonify({"status": "success", "message": "Chat reiniciado"})

#Endpoint para obtener la conversación actual del JSON
@app.route('/get-chat-json', methods=['GET'])
def get_chat():
    with open(JSON_FILE, 'r') as f:
        chat = json.load(f)
    return jsonify(chat)

#Funcion para definir las repuestas a las opciones del chatbot
def optionAnswerChat(optionChat):
    if optionChat == "📚 Información de la Biblioteca":
        return f'Seleccionaste la opción <strong>'+optionChat+'</strong> Indicame tus dudas institucionales sobre la Biblioteca Alonso Gamero por favor. Ejemplo: Dirección, Horario, Normas, Servicios ofrecidos, Historia, entre otros.'
    elif optionChat == "📖 Buscar libros o recursos":
        return f'Seleccionaste la opción <strong>'+optionChat+'</strong> ¿Buscas un libro o recurso en específico? Sé lo más específico posible, indicame el título, autor, área, año o tema y reviso si está disponible en la Biblioteca Alonso Gamero. Ejemplo: Libros de la editorial Springer.'
    elif optionChat == "🧠 Recomendaciones bibliográficas":
        return f'Seleccionaste la opción <strong>'+optionChat+'</strong> Indicame sobre que tópico te gustaría mi recomendación. Sé lo más específico posible: tema, autor, carrera o materia. ¡Así te puedo dar las mejores sugerencias!'
    elif optionChat == "📑 Crear informe o contenido":
        return f'Seleccionaste la opción <strong>'+optionChat+'</strong>, ¿Sobre qué necesitas escribir? Cuéntame el tema, para qué lo necesitas (tarea, presentación, resumen, etc.) y cuánto debe abarcar.'
    elif optionChat == "📝 Resumir un recurso PDF":
        return f'Seleccionaste la opción <strong>'+optionChat+'</strong>, Sube tu PDF de hasta 5 páginas. Te entregaré un resumen listo para descargar.'
    else:
        return f'Seleccionaste la opción <strong>'+optionChat+'</strong>, Puedes hacer cualquier pregunta relacionada con temas académicos, búsqueda de información, recursos o apoyo en tus estudios.'

#Endpoint para saber la opcion seleccionada por el usuario en Chatbox para Json
@app.route('/selected-option-chat-json', methods=['POST'])
def selected_option_chat_json():
    global userOption
    data = request.get_json()
    optionChat = data.get('option')
    userOption = optionChat  #guardamos la opcion del usuario de manera global
    with open(JSON_FILE, 'r') as f:  # Cargar la conversación existente desde el archivo JSON
        chat = json.load(f)
    if optionChat == "Ver Opciones":
        chat.append({'type': 0, 'message': 'Quiero Ver las opciones'})
        chat.append({'type': 1, 'message': '👋 Hola, mi nombre es Bagbot y soy tu asistente de biblioteca virtual, recuerda que no tengo acceso al contexto previo, es decir, <strong>no tengo memoria</strong>, por favor sé lo más claro y específico posible. Estoy aquí para ayudarte,<br>¿Qué deseas hacer hoy? <br><div class="buttonsOpt buttonsOptions"><button class="btn btn-primary" disabled>📚 Información de la Biblioteca</button><button class="btn btn-primary" disabled>📖 Buscar libros o recursos</button><button class="btn btn-primary" disabled>🧠 Recomendaciones bibliográficas</button><button class="btn btn-primary" disabled>📑 Crear informe o contenido</button><button class="btn btn-primary" disabled>📝 Resumir un recurso PDF</button><button class="btn btn-primary" disabled>❓ Hacer una consulta libre</button></div>'})
    else:
        optMessage = optionAnswerChat(optionChat)
        if len(chat) == 0:
            chat.append({'type': 1, 'message': '👋 Hola, mi nombre es Bagbot y soy tu asistente de biblioteca virtual, por favor sé lo más claro y específico posible. Estoy aquí para ayudarte,<br>¿Qué deseas hacer hoy? <br>'+optMessage})
        else:
            chat.append({'type': 1, 'message': optMessage})

    with open(JSON_FILE, 'w') as f:
        json.dump(chat, f, indent=4)
    return jsonify({"message": "Opcion Seleccionada"}), 201

#Endpoint para saber la opcion seleccionada por el usuario en Chatbox para base de datos
@app.route('/selected-option-chat-db', methods=['POST'])
def selected_option_chat_db():
    global userOption
    data = request.get_json()
    optionChat = data.get('option')
    userOption = optionChat  #guardamos la opcion del usuario de manera global
    userName = (data['name']).split()[0]
    if optionChat == "Ver Opciones":
        userMessage = 'Quiero Ver las opciones'
        bagbotMessage = '👋 Hola '+userName+', mi nombre es Bagbot y soy tu asistente de biblioteca virtual, recuerda que no tengo acceso al contexto previo, es decir, <strong>no tengo memoria</strong>, por favor sé lo más claro y específico posible. Estoy aquí para ayudarte,<br>¿Qué deseas hacer hoy? <br><div class="buttonsOpt buttonsOptions"><button class="btn btn-primary" disabled>📚 Información de la Biblioteca</button><button class="btn btn-primary" disabled>📖 Buscar libros o recursos</button><button class="btn btn-primary" disabled>🧠 Recomendaciones bibliográficas</button><button class="btn btn-primary" disabled>📑 Crear informe o contenido</button><button class="btn btn-primary" disabled>📝 Resumir un recurso PDF</button><button class="btn btn-primary" disabled>❓ Hacer una consulta libre</button></div>'
        saveOptMessageDB(data, userMessage, bagbotMessage)
    else:
        optMessage = optionAnswerChat(optionChat)
        userMessage = ''
        if data.get('first') == 1:
            bagbotMessage= '👋 Hola '+userName+', mi nombre es Bagbot y soy tu asistente de biblioteca virtual, por favor sé lo más claro y específico posible. Estoy aquí para ayudarte,<br>¿Qué deseas hacer hoy? <br>'+optMessage
            saveOptMessageDB(data, userMessage, bagbotMessage)
        else:
            saveOptMessageDB(data, userMessage, optMessage) 
    return jsonify({"message": "Opcion Seleccionada"}), 201

def saveOptMessageDB(data, userMessage, bagbotMessage):
    try:
        if userMessage != '':
            new_question = Consultas(
                usuario_id=data['userId'],
                nombre=data['name'],
                descripcion=userMessage,
                tipo=0
            )
            db.session.add(new_question)
            db.session.commit()
        new_answer = Consultas(
            usuario_id=data['userId'],
            nombre='BAGBOT',
            descripcion=bagbotMessage,
            tipo=1
        )
        db.session.add(new_answer)
        db.session.commit()
        return jsonify({"message": "Consulta guardada correctamente"}), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        print ("Error")
        return jsonify({"error": str(e)}), 500

#Endpoint para recibir mensajes de Svelte, guardarlos en el JSON y generar respuesta IA
@app.route('/send-message-json', methods=['POST'])
def send_message_json():
    global userOption
    data = request.get_json() #Obtener el mensaje enviado desde Svelte
    userMessage = data.get('message')
    with open(JSON_FILE, 'r') as f:  #Cargar la conversación existente desde el archivo JSON
        chat = json.load(f)
    chat.append({'type': 0, 'message': userMessage})  #Agregar el mensaje del usuario al JSON
    if userOption == "📖 Buscar libros o recursos":
        response = human_query(userMessage)
    else:
        prompt = promptOptions(userOption)
        response = chatIAGroq(prompt,userMessage)
    #response='holasssss'
    chat.append({'type': 1, 'message': response})
    with open(JSON_FILE, 'w') as f:
        json.dump(chat, f, indent=4)  # Guardar la conversación actualizada en el archivo JSON
    return jsonify(chat) # Devuelve la conversación completa al front para mostrarla en el chatbot

# Endpoint para guardar consulta en la bd
@app.route('/send-message-db', methods=['POST'])
def send_message_db():
    global userOption
    data = request.get_json()
    userMessage = data.get('userMessage')
    try:
        new_question = Consultas(
            usuario_id=data['userId'],
            nombre=data['name'],
            descripcion=userMessage,
            tipo=0
        )
        db.session.add(new_question)
        db.session.commit()
        if userOption == "📖 Buscar libros o recursos":
            response = human_query(userMessage)
        else:
            promptDB = promptOptions(userOption)
            response = chatIAGroq(promptDB,userMessage)
        new_answer = Consultas(
            usuario_id=data['userId'],
            nombre='BAGBOT',
            descripcion=response,
            tipo=1
        )
        db.session.add(new_answer)
        db.session.commit()
        return jsonify({"message": "Consulta guardada correctamente"}), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"error": str(e)}), 500

#Funcion para definir el prompt segun la opcion seleccionada por el usuario
def promptOptions (userOpt):
    if userOpt == "📚 Información de la Biblioteca":
        prompt = ("en el área de información institucional y únicamente puedes ofrecer información institucional sobre la Biblioteca Alonso Gamero: ubicación, horarios, normas, servicios ofrecidos, contacto, historia o cualquier otro aspecto general. "
        "No debes dar recomendaciones bibliográficas ni responder sobre contenidos académicos específicos. "
        "Restringe tus respuestas únicamente a información propia de la biblioteca."
        "No debes dar información de contacto")
    elif userOpt == "🧠 Recomendaciones bibliográficas":
        prompt = ("en el area de recomendaciones bibliograficas y solo puedes dar recomendaciones bibliográficas al usuario basadas en el tema, autor, carrera o materia que te indique. "
        "Las recomendaciones pueden incluir libros, artículos, sitios web académicos u otros recursos disponibles públicamente en internet o en bases de datos abiertas."
        "Aclara que no pertenecen necesariamente a la Biblioteca Alonso Gamero, y que estás sugiriendo recursos de carácter general. "
        "Sepáralas con un salto de línea <br> para mayor claridad. "
        "No debes afirmar que un libro está disponible en la biblioteca, ya que no tienes acceso a su catálogo. "
        "Solo puedes responder si la pregunta está relacionada con temas académicos o de aprendizaje. "
        "No respondas sobre información institucional de la biblioteca.")
    elif userOpt == "📑 Crear informe o contenido":
        prompt = ("en área de creación de informes y contenidos y únicamente puedes redactar contenido académico como informes, resúmenes, presentaciones o textos relacionados, según el tema y tipo de solicitud del usuario. "
        "Puedes adaptar el contenido según si es para una tarea, exposición o cualquier uso académico. "
        "No respondas preguntas que no estén relacionadas con contenido académico o educativo.")
    elif userOpt == "❓ Hacer una consulta libre":
        prompt = ("y solo puedes responder preguntas relacionadas con temas académicos, búsqueda de información, recursos de consulta o apoyo al estudio. "
        "No puedes brindar información institucional sobre la Biblioteca Alonso Gamero, ni responder sobre temas ajenos al ámbito académico."
        "Las recomendaciones pueden incluir libros, artículos, sitios web académicos u otros recursos disponibles públicamente en internet o en bases de datos abiertas."
        "Aclara que no pertenecen necesariamente a la Biblioteca Alonso Gamero, y que estás sugiriendo recursos de carácter general. "
        "Aclara que no pertenecen necesariamente a la Biblioteca Alonso Gamero, y que estás sugiriendo recursos de carácter general. "
        "No debes afirmar que un libro está disponible en la biblioteca, ya que no tienes acceso a su catálogo. "
        "No puedes recomendar recursos propios de la Biblioteca Alonso Gamero"
        "Mantén tus respuestas enfocadas y útiles para el aprendizaje.")
    return prompt

# Endpoint para obtener el chat almacenado en base de datos
@app.route('/get-chat-db', methods=['GET'])
def get_chat_db():
    user_id = request.args.get('user_id')
    try:
        # Obtener el rango de fecha de hoy
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        consultas = Consultas.query.filter(
        Consultas.usuario_id == user_id,
        Consultas.fecha_creacion >= today,
        Consultas.fecha_creacion < tomorrow
        ).order_by(Consultas.fecha_creacion.asc()).all()
        result = [
            {
                "id": consulta.id,
                "name": consulta.nombre,
                "type": consulta.tipo,
                "message": consulta.descripcion,
                "date": consulta.fecha_creacion.isoformat()  # formato ISO para frontend
            }
            for consulta in consultas
        ]
        return jsonify(result), 200
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

#Endpoint para inicio de sesión
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    correo = data['email']
    contraseña = data['password']
    user = UsuariosBagbot.query.filter_by(correo=correo).first()
    if not user:
        return jsonify({"message": "Usuario no registrado"}), 404
    if bcrypt.check_password_hash(user.contraseña, contraseña):
        additional_claims = {
            'nombre': user.nombre  # Incluye más información en el token
        }
        # Crear token JWT con el user_id como identidad y el nombre como dato adicional
        access_token = create_access_token(identity=user.id, additional_claims=additional_claims)
        return jsonify(access_token=access_token, id=user.id, nombre=user.nombre), 200
    else:
        return jsonify({'message': 'Contraseña incorrecta'}), 401

#Endpoint protegida para obtener datos del usuario
@app.route('/protected', methods=['GET'])
@jwt_required()
def protected():
    user_id = get_jwt_identity()
    claims = get_jwt()
    nombre = claims['nombre']
    if not user_id:
        return jsonify({"msg": "Token inválido o expirado"}), 401
    return jsonify({"id": user_id,"nombre": nombre}), 200

#Endpoint para registrar usuario
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    nombre = data.get('fullname')
    correo = data.get('email')
    sexo = data.get('sex')
    cedula = data.get('idnumber')
    contraseña = data.get('password')
    biblioteca = data.get('library')
    categoria = data.get('typePerson')
    escuela = data.get('dependence')
    cargo = data.get('position')
    hash = bcrypt.generate_password_hash(contraseña).decode('utf-8')  #encriptamos la contraseña
    if not all([nombre, correo, sexo, cedula, contraseña, biblioteca, categoria]):
        return jsonify({"msg": "Faltan datos"}), 400
    u_id = f"U-{cedula}"  # Generamos el ID
    # Verificar si el correo o id ya existen
    if UsuariosBagbot.query.filter((UsuariosBagbot.id == u_id) | (UsuariosBagbot.correo == correo)).first():
        return jsonify({"msg": "Este usuario se encuentra registrado"}), 409
    # Crear el usuario
    new_user = UsuariosBagbot(
        id=u_id,
        nombre=nombre,
        correo=correo,
        sexo=sexo,
        cedula=cedula,
        contraseña=hash,
        biblioteca=biblioteca,
        categoria=categoria,
        escuela=escuela,
        cargo=cargo
    )
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"msg": "Usuario registrado correctamente", "id": u_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al registrar usuario", "error": str(e)}), 500

#Endpoint para recuperar contraseña
@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    categoria = data.get('typePerson')
    sexo = data.get('sex')
    cedula = data.get('idnumber')
    correo = data.get('email')
    nueva_contraseña = data.get('password')
    # Validar que todos los campos estén presentes
    if not all([categoria, cedula, correo, sexo, nueva_contraseña]):
        return jsonify({"msg": "Faltan datos"}), 400
    u_id = f"U-{cedula}" # Construir el ID (ej: U12345678)
    # Buscar usuario
    user = UsuariosBagbot.query.filter_by(
        id=u_id,
        correo=correo,
        categoria=categoria,
        sexo=sexo
    ).first()
    if not user:
        return jsonify({"msg": "Datos no coinciden con ningún usuario"}), 404
    try:
        hashed_password = bcrypt.generate_password_hash(nueva_contraseña).decode('utf-8')  #Encriptar la nueva contraseña
        user.contraseña= hashed_password
        db.session.commit()
        return jsonify({"msg": "Contraseña actualizada correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar la contraseña", "error": str(e)}), 500

#Obtener historial
#Endpoint para traer las fechas únicas
@app.route('/dates', methods=['GET'])
def get_dates():
    user_id = request.args.get('user_id')
    dates = db.session.query(
        db.func.date(Consultas.fecha_creacion)
    ).filter(
        Consultas.usuario_id == user_id
    ).distinct().order_by(
        desc(db.func.date(Consultas.fecha_creacion))
    ).all()
    dates_list = []
    for d in dates:
        date_original = d[0]
        # Formato en español con Babel (ej: 21 de junio de 2025)
        date_beauty = format_date(date_original, format="d 'de' MMMM 'de' y", locale='es')
        # Capitalizar el mes: junio → Junio
        date_beauty = re.sub(
            r'(\sde\s)([a-záéíóúñ]+)(\sde\s)',
            lambda m: m.group(1) + m.group(2).capitalize() + m.group(3),
            date_beauty
        )
        dates_list.append({
            "beauty": date_beauty,   # Ej: 21 de Junio de 2025
            "original": date_original.strftime('%Y-%m-%d')  # Ej: 2025-06-21
        })
    return jsonify(dates_list)

#Endpoint para traer mensajes por fecha
@app.route('/query/<date>', methods=['GET'])
def get_query_by_date(date):
    # Filtra las consultas de esa fecha por usuario
    try:
        user_id = request.args.get('user_id')
        consultas = Consultas.query.filter(
            db.func.date(Consultas.fecha_creacion) == date,
            Consultas.usuario_id == user_id
        ).order_by(Consultas.fecha_creacion.asc()).all()
        
        result = [{
            'type': c.tipo,
            'message': c.descripcion
        } for c in consultas]
        
        return jsonify(result), 200
    except Exception as e:
        print('Error:', e)
        return jsonify({'error': str(e)}), 500

#Endpoint para hacer consultas a la iA
def chatIAGroq(prompt,userMessage):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.1-8b-instant",  #usaremos el modelo llama-3
        "messages": [
            {"role": "system", "content": ('Eres un asistente de la Biblioteca Alonso Gamero de la Facultad de Ciencias de la Universidad Central de Venezuela '+prompt+
            'Sé cordial, pero no saludes ni des la bienvenida, ya que estás en una conversación continua.'
            'Si el usuario saluda, respóndele brevemente y orienta la conversación hacia tu función.'
            'Si hace preguntas que no son de tu competencia, recuérdale amablemente cuál es tu función y oriéntalo a temas relacionados.'
            'Responde en el idioma que el usuario utiliza al preguntarte.'
            'No hagas preguntas como: "¿Necesitas ayuda con esto?" o "¿Te gustaría que te recomiende algo más?".'
            'No hagas preguntas que el usuario pueda contestar con "Si" o "No".'
            'No continúes la conversación con preguntas adicionales después de responder.'
            'Tu respuesta debe ser concreta, informativa y enfocada.'
            "Evita usar asteriscos (*) para resaltar texto o crear listas. Usa texto plano y saltos de línea con <br> para separar los elementos o párrafos y mejorar la legibilidad."
            'Evita frases genéricas de cierre con preguntas como "¿Hay algo más en lo que pueda ayudarte?".')},
            {"role": "user", "content": userMessage}
        ]
    }
    try:
        res = requests.post(GROQ_URL, json=payload, headers=headers)
        res_json = res.json()

        if "choices" in res_json:
            reply = res_json["choices"][0]["message"]["content"]
            return  (reply)
        else:
            print("Groq error:", res_json)
            return ( "Error al generar respuesta de IA."), 500
    except Exception as e:
        print("Server error:", str(e))
        return ("Error interno del servidor."), 500

#Funcion para resumir el PDF
def callGroqPDF(prompt):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": ("Eres un asistente que resume textos largos de forma clara y concisa, que incluye todas las ideas principales, pero sin exceder 800 palabras."
            "Evita usar asteriscos (*) para resaltar texto o crear listas. Usa texto plano y saltos de línea únicamente con \n para separar los elementos o párrafos y mejorar la legibilidad."
            "No agregues información que no esta en el texto que te envió el usuario"
            "Agregale un título como primera línea")},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7
    }
    response = requests.post(GROQ_URL, json=data, headers=headers )
    if response.status_code == 200:
        return response.json()['choices'][0]['message']['content']
    else:
        print("Error:", response.text)
        return "Error al generar resumen."

#Endpoint para subir el PDF
@app.route('/upload-pdf', methods=['POST'])
def upload_pdf():
    file = request.files.get('file')
    user_id = request.form.get('userID')
    loggedIn = request.form.get('loggedIn')
    is_logged_in = str(loggedIn).lower() == 'true'
    print(loggedIn)
    if not file:
        return jsonify({"error": "No se encontró el archivo."}), 400
    filename = file.filename
    try:
        pdf_file = fitz.open(stream=file.read(), filetype="pdf")
    except Exception:
        return jsonify({"error": "⚠️ El archivo no es un PDF válido."}), 400

    if pdf_file.page_count > 5:
        return jsonify({"error": "⚠️ Este PDF contiene más de 5 páginas."}), 400
    full_text = ""
    for page in pdf_file:
        full_text += page.get_text()
    pdf_file.close()
    if full_text == "":
        return jsonify({"error": "⚠️ Este PDF no contiene texto para resumir."}), 400
    resumen = callGroqPDF(full_text)  #Llama a la funcion para resumir el PDF
    resumen_storage[filename] = resumen  #Guarda el resumen temporalmente en memoria
    if not is_logged_in:
        addResumenJson (filename,resumen)
    else:
        addResumenDB (filename,resumen,user_id)
    return jsonify({
        "status": "ok",
        "filename": filename
    }), 200

#Funcion para agregar el resumen al json y mostrarlo en el chat
def addResumenJson (filename,resumen):
    resumenHTML = resumen.replace('\n', '<br>')
    with open(JSON_FILE, 'r') as f:  # Cargar la conversación existente desde el archivo JSON
        chat = json.load(f)
        chat.append({'type': 1, 'message': '✅ PDF procesado con éxito: <strong>'+filename+'</strong><br>'+resumenHTML+'<br><br><strong>Presiona el botón para descargar tu resumen.</strong>'})
    with open(JSON_FILE, 'w') as f:
        json.dump(chat, f, indent=4)
    return jsonify({"message": "PDF Procesado"}), 201

#Funcion para agregar el resumen a la BD y mostrarlo en el chat
def addResumenDB (filename,resumen, userID):
    resumenHTML = resumen.replace('\n', '<br>')
    try:
        new_answer = Consultas(
            usuario_id=userID,
            nombre='BAGBOT',
            descripcion='✅ PDF procesado con éxito: <strong>'+filename+'</strong><br>'+resumenHTML+'<br><br><strong>Presiona el botón para descargar tu resumen.</strong>',
            tipo=1
        )
        db.session.add(new_answer)
        db.session.commit()
        return jsonify({"message": "PDF Procesado"}), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"error": str(e)}), 500

#Endpoint para descargar el PDF
@app.route('/download-pdf', methods=['GET'])
def download_pdf():
    filename = request.args.get('filename')
    resumen = resumen_storage.get(filename)
    if not resumen:
        return jsonify({"error": "No se encontró el resumen para este archivo."}), 404
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        title=f"Resumen de {filename}",
        leftMargin=50,
        rightMargin=50,
        topMargin=50,
        bottomMargin=50
    )
    styles = getSampleStyleSheet()
    custom_style = ParagraphStyle(
        name='Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        leading=18  # espacio entre líneas
    )
    story = [Paragraph(line, custom_style) for line in resumen.split('\n')]
    doc.build(story)
    buffer.seek(0)
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"resumen_{filename}",
        mimetype='application/pdf'
    )

#Obtener esquema de la base de datos para generar consulta sql y buscar los elementos de la biblioteca, solo de las tablas a consultar
def schema():
    inspector = inspect(db.engine)  # Usamos el inspector de SQLAlchemy
    table_names = inspector.get_table_names()
    def get_column_details(table_name: str) -> List[str]:
        columns= inspector.get_columns(table_name)
        return [column['name'] for column in columns]
    schema_info=[]
    for table_name in table_names:
        if table_name in ['recursos_libros','recursos_tesis','recursos_publicaciones_seriadas','recursos_colec_docs']:
            table_info = [f"Table: {table_name}"]
            table_info.append("Columns:")
            table_info.extend(f" - {column}" for column in get_column_details(table_name))
            schema_info.append("\n".join(table_info))
    db.engine.dispose()
    return "\n\n".join(schema_info)

#Genero mi consulta SQL
def human_query_to_sql(human_query: str):
    # Obtenemos el esquema de la base de datos
    database_schema = schema()
    system_message = f"""
    Con el siguiente esquema de base de datos, escribe una consulta SQL que retorne la tabla en la cual se debe buscar la información requerida.
    Retorna la consulta SQL en una estructura JSON con la clave `"sql_query"`.
    Condiciones:
    - Solo puedes hacer consultas del tipo SELECT. Si el usuario solicita una acción diferente, debes responder que no está permitido.
    - **Nunca modifiques el nombre de la tabla ni le apliques funciones como UPPER o UNACCENT.**
    - Utiliza LIKE para buscar el valor, Ejemplo ('%Lopez%') 
    - Para hacer búsquedas insensibles a mayúsculas, minúsculas o acentos, aplica `UPPER(UNACCENT(...))` **solo a las columnas** dentro de la cláusula WHERE y al valor de búsqueda.  
    Ejemplo correcto:
    `SELECT * FROM recursos_libros WHERE UPPER(UNACCENT(autor)) LIKE UPPER(UNACCENT('%Lopez%')) LIMIT 15`
    - La consulta debe retornar solo un máximo de 15 filas, por lo tanto, incluye `LIMIT 15` al final.
    - No incluyas punto y coma (`;`) al final de la consulta.
    - Retorna únicamente lo que te estoy solicitando, como en el siguiente ejemplo:
    <example>{{
        "sql_query": "SELECT * FROM recursos_libros WHERE UPPER(UNACCENT(autor)) LIKE UPPER(UNACCENT('%Lopez%')) LIMIT 15",
        "original_query": "Enséñame todos los libros del autor Lopez."
    }}
    </example>
    <schema>
    {database_schema}
    </schema>
    """
    userMessage = human_query
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": userMessage}
        ]
    }
    response = requests.post(GROQ_URL, json=data, headers=headers )
    if response.status_code == 200:
        return response.json()['choices'][0]['message']['content']
    else:
        print("Error:", response.text)
        return "Error al generar consulta."

#Genero la respuesta final
def build_answer(result, human_query: str):
    system_message = f"""
    Eres un asistente bibliotecario. Dadas la pregunta del usuario y el json de la respuesta SQL de la base de datos, responde de manera clara y útil.
    Si no se obtuvieron resultados del SQL, indícale al usuario que no se encontraron registros en la biblioteca y ofrécele una información alternativa.
    Presenta cada registro del json como un ítem independiente separandolo con un salto de línea usando la etiqueta <br>.
    Usa texto plano.
    No uses asteriscos, viñetas ni listas numeradas. Evita decorar el texto.
    Si la consulta del usuario te pide eliminar o actualizar indicale que no puedes realizar esta acción.
    <user_question> 
    {human_query}
    </user_question>
    <sql_response>
    ${result} 
    </sql_response>
    """
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": system_message}
        ]
    }
    response = requests.post(GROQ_URL, json=data, headers=headers )
    if response.status_code == 200:
        return response.json()['choices'][0]['message']['content']
    else:
        print("Error:", response.text)
        return "Error al generar la respuesta."

def parse_sql_response(response_text):
    # Primero intentamos extraer el valor de sql_query con regex aunque no sea JSON válido
    try:
        match = re.search(r'"sql_query"\s*:\s*"([^"]+)"', response_text, re.DOTALL)
        if match:
            sql_query_raw = match.group(1)

            # Reemplazar secuencias problemáticas
            sql_query_cleaned = sql_query_raw.replace("\\'", "'").replace('\\"', '"').replace("\n", " ")

            return {"sql_query": sql_query_cleaned.strip()}
    except Exception as e:
        print(f"Error al parsear la respuesta: {e}")
        return None

def human_query(userQuestion):
    print (userQuestion)
    # Transforma la pregunta a sentencia SQL
    sql_query =  human_query_to_sql(userQuestion)
    print('SQL de Groq: ',sql_query)
    # Hace la consulta a la base de datos
    
    result_dict = parse_sql_response(sql_query)
    if result_dict and "SELECT" in result_dict["sql_query"].upper():
        try:
            result = execute_query(result_dict["sql_query"])
            answer = build_answer(result, userQuestion)
        except Exception as e:
            print(f"Error al ejecutar SQL: {e}")
            answer = "Hubo un problema al ejecutar la consulta SQL."
    else:
        # Si no se logró extraer o no es SELECT
        raw_text = result_dict["sql_query"] if result_dict else sql_query
        answer = build_answer(raw_text, userQuestion)

    if not answer:
        return {"error": "Falló la generación de la respuesta"}
    return answer

#Ejecuta la consulta sql en la base de datos
def execute_query(sql_query: str) -> List[Dict[str, Any]]:
    #print('Consulta:', sql_query)
    try:
        with db.engine.connect() as connection:
            result = connection.execute(text(sql_query))
            data = [dict(row._mapping) for row in result]
            db.engine.dispose()
            if not data:
                print("La consulta no devolvió resultados.")
                return []
            return data
    except SQLAlchemyError as e:
        print(f"Error al ejecutar la consulta: {e}")
        return [] # Retorna lista vacía

if __name__ == '__main__':
    app.run(debug=True, port=5000)

if __name__ == "__main__":
    app.run(debug=True)