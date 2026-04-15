const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', //Permite conexoes de qualquer lugar
        methods: ['GET', 'POST'],
        credentials: true
    }
});

let players = {};

let globalScore = { left: 0, right: 0 };

io.on('connection', (socket) => {
    
// Atribui lado (esquerdo ou direito) ao jogador
    const playerIds = Object.keys(players);
    if (playerIds.length === 0) {
        players[socket.id] = { side: 'left' };
    } else if (playerIds.length === 1) {
        players[socket.id] = { side: 'right' };
    }

    socket.emit('playerRole', players[socket.id]?.side);

    if (Object.keys(players).length >= 2) {
        io.emit('gameState', 'START');
        console.log('Partida iniciada!');
    } else {
        io.emit('gameState', 'WAITING');
    }
    
    socket.emit('syncScore', globalScore);

    console.log(`Jogador conetado: ${socket.id} - Lado: ${players[socket.id]?.side}`);

    socket.on('scored', (side) => {
        if (side === 'left') globalScore.left++;
        if (side === 'right') globalScore.right++;

        // Avisar todos os jogadores sobre a nova pontuação
        io.emit('syncScore', globalScore);
    });

    socket.on('updatePaddle', (data) => {
        socket.broadcast.emit('opponentMove', data);
    });

    socket.on('updateBall', (ballState) => {
        socket.broadcast.emit('syncBall', ballState);
    });

    socket.on('disconnect', () => {
        console.log(`Usuário desconectado: ${socket.id}`);
        delete players[socket.id];

        if (Object.keys(players).length === 0) {
            globalScore = { left: 0, right: 0 };
        }
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});