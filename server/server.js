const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { getQuestions } = require('./database');
const rateLimit = require('express-rate-limit');

// Rate limiter: limit repeated requests to root route.
const rootLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let currentQuestionIndex = 0;
let questions = [];
let scores = {};
let timer = 15;
let timerInterval;

// Nuevo: Un conjunto para rastrear qué jugadores han respondido a la pregunta actual.
let playersAnswered = new Set();

// Servir el archivo HTML principal cuando se accede a la ruta raíz.
app.get('/', rootLimiter, (req, res) => {
    // Asegúrate de que index.html esté en la carpeta principal,
    // fuera de la carpeta 'trivia-server'.
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Servir los archivos estáticos de tu juego (como el HTML y CSS)
app.use(express.static(path.join(__dirname, '..')));

// Endpoint para obtener preguntas (API).
app.get('/api/questions', async (req, res) => {
    const count = Math.min(parseInt(req.query.count) || 5, 20);
    getQuestions(count, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'No se pudieron cargar las preguntas.' });
        }
        res.json(rows);
    });
});

// ******************************************************
// *** WebSockets: La magia para el tiempo real. ***
// ******************************************************
wss.on('connection', ws => {
    // Asignar un ID único a cada jugador (esto es una simplificación).
    ws.player_id = Math.random().toString(36).substring(7);
    console.log(`Nuevo jugador conectado: ${ws.player_id}`);
    
    ws.on('message', message => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'answer') {
                handleAnswer(ws, parsedMessage);
            }
        } catch (e) {
            console.error('Mensaje recibido no es un JSON válido:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Jugador desconectado: ${ws.player_id}`);
        // Si el jugador desconectado ha respondido, elimínalo del set
        playersAnswered.delete(ws.player_id);
    });

    // Notificar al jugador que se unió.
    ws.send(JSON.stringify({ type: 'message', text: `¡Bienvenido al juego! Tu ID de jugador es: ${ws.player_id}` }));

    if (wss.clients.size === 1) {
        startGame();
    }
});

function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

function startGame() {
    console.log('Iniciando el juego.');
    currentQuestionIndex = 0;
    scores = {};
    getQuestions(5, (err, rows) => {
        if (err) {
            console.error('Error cargando preguntas:', err.message);
            return;
        }
        questions = rows;
        if (questions.length > 0) {
            nextQuestion();
        } else {
            console.log('No hay preguntas para empezar el juego.');
        }
    });
}

function nextQuestion() {
    // Nuevo: Reinicia el conjunto de jugadores que han respondido para la nueva pregunta
    playersAnswered.clear();

    if (currentQuestionIndex >= questions.length) {
        endGame();
        return;
    }

    const questionData = questions[currentQuestionIndex];
    timer = 15;
    
    broadcast({
        type: 'new_question',
        question: questionData.question,
        options: questionData.options,
        timer: timer
    });

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer--;
        broadcast({ type: 'timer_tick', time: timer });
        if (timer <= 0) {
            console.log('Tiempo agotado. Pasando a la siguiente pregunta.');
            clearInterval(timerInterval);
            broadcast({ type: 'message', text: '¡Tiempo agotado!' });
            setTimeout(() => {
                currentQuestionIndex++;
                nextQuestion();
            }, 2000);
        }
    }, 1000);
}

function handleAnswer(ws, message) {
    const { question, answer } = message.payload;
    const playerId = ws.player_id;

    // Nuevo: Si el jugador ya ha respondido, ignora el mensaje.
    if (playersAnswered.has(playerId)) {
        return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    // Nuevo: Marca al jugador como que ha respondido.
    playersAnswered.add(playerId);

    if (currentQuestion.answer === answer) {
        if (!scores[playerId]) {
            scores[playerId] = 0;
        }
        scores[playerId]++;
        ws.send(JSON.stringify({ type: 'answer_result', result: 'correct' }));
    } else {
        ws.send(JSON.stringify({ type: 'answer_result', result: 'wrong' }));
    }
    
    // Nuevo: Comprueba si todos los jugadores han respondido.
    if (playersAnswered.size === wss.clients.size) {
        console.log('Todos los jugadores han respondido. Pasando a la siguiente pregunta.');
        // Detiene el temporizador y avanza la pregunta.
        clearInterval(timerInterval);
        setTimeout(() => {
            currentQuestionIndex++;
            nextQuestion();
        }, 1000); // Pequeña pausa para que los jugadores vean el resultado.
    }
}

function endGame() {
    broadcast({ type: 'game_over', scores });
    setTimeout(startGame, 2500);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de trivia iniciado en http://localhost:${PORT}`);
});
