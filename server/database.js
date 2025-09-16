const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./trivia.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Conectado a la base de datos de trivia.');
});

db.serialize(() => {
    // Si la tabla no existe, la crea.
    db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        options TEXT NOT NULL
    )`);

    // Las 15 preguntas que vamos a insertar.
    const initialQuestions = [
        { question: '¿Cuál es el río más largo del mundo?', options: 'Nilo,Amazonas,Yangtsé,Misisipi', answer: 'Amazonas' },
        { question: '¿En qué año llegó el hombre a la luna?', options: '1965,1969,1972,1980', answer: '1969' },
        { question: '¿Qué planeta es conocido como el "Planeta Rojo"?', options: 'Marte,Júpiter,Venus,Saturno', answer: 'Marte' },
        { question: '¿Cuántos huesos tiene el cuerpo humano adulto?', options: '206,300,198,212', answer: '206' },
        { question: '¿Quién pintó "La Mona Lisa"?', options: 'Van Gogh,Picasso,Miguel Ángel,Leonardo da Vinci', answer: 'Leonardo da Vinci' },
        // --- Nuevas preguntas ---
        { question: '¿En qué ciudad se encuentra la Torre Eiffel?', options: 'Londres,Roma,París,Tokio', answer: 'París' },
        { question: '¿Cuál es el océano más grande?', options: 'Atlántico,Índico,Ártico,Pacífico', answer: 'Pacífico' },
        { question: '¿Qué animal es el más grande del mundo?', options: 'Elefante,Ballena azul,Jirafa,Tiburón blanco', answer: 'Ballena azul' },
        { question: '¿Qué país es el más poblado del mundo?', options: 'Estados Unidos,India,China,Rusia', answer: 'India' },
        { question: '¿Cuál es el continente más pequeño?', options: 'Asia,Europa,Australia,África', answer: 'Australia' },
        { question: '¿Cuál es el metal más abundante en la corteza terrestre?', options: 'Hierro,Cobre,Aluminio,Oro', answer: 'Aluminio' },
        { question: '¿En qué año se fundó Google?', options: '1995,1998,2001,2004', answer: '1998' },
        { question: '¿Cuál es la capital de Japón?', options: 'Seúl,Pekín,Tokio,Bangkok', answer: 'Tokio' },
        { question: '¿Qué gas respiran las plantas?', options: 'Oxígeno,Nitrógeno,Dióxido de carbono,Metano', answer: 'Dióxido de carbono' },
        { question: '¿Cuál es el animal más rápido en tierra?', options: 'León,Guepardo,Antílope,Caballo', answer: 'Guepardo' }
    ];

    // Contamos las preguntas para no duplicarlas
    db.get('SELECT COUNT(*) AS count FROM questions', (err, row) => {
        if (row.count === 0) {
            console.log('Insertando preguntas iniciales.');
            const stmt = db.prepare('INSERT INTO questions (question, options, answer) VALUES (?, ?, ?)');
            initialQuestions.forEach(q => {
                // Validación para evitar inyecciones SQL (SQL Injection).
                stmt.run(q.question, q.options, q.answer);
            });
            stmt.finalize();
        }
    });
});

// Función para obtener preguntas aleatorias.
function getQuestions(count, callback) {
    db.all(`SELECT question, options, answer FROM questions ORDER BY RANDOM() LIMIT ?`, [count], (err, rows) => {
        if (err) {
            callback(err, null);
            return;
        }
        callback(null, rows.map(row => ({
            question: row.question,
            options: row.options.split(','),
            answer: row.answer
        })));
    });
}

// Exportar la función para usarla en nuestro servidor.
module.exports = {
    getQuestions
};
