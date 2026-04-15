import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// IMPORTANTE: Se for jogar em PCs diferentes na mesma rede, 
// troque 'localhost' pelo seu IP (ex: 'http://192.168.1.6:3001')
const socket = io("https://ping-pong-multiplayer-1.onrender.com");
const bounceSound = new Audio('/bounce.mp3');

function App() {
  const canvasRef = useRef(null);
  const [role, setRole] = useState(null); // 'left' ou 'right'
  const [score, setScore] = useState({ left: 0, right: 0 });
  const [gameStarted, setGameStarted] = useState(false);
  const [error, setError] = useState(null);

  const paddleY = useRef(250);
  const opponentY = useRef(250);
  const ball = useRef({ x: 400, y: 300, dx: 5, dy: 5 });

  useEffect(() => {
    socket.on('playerRole', (res) => setRole(res));
    socket.on('opponentMove', (data) => { opponentY.current = data.y; });
    socket.on('syncBall', (data) => { ball.current = data; });
    socket.on('syncScore', (newScore) => { setScore(newScore); });

    socket.on('gameState', (state) => { 
      if (state === 'START') setGameStarted(true);
      else setGameStarted(false);
    });
    socket.on("connect_error", (err) => {
      setError("Servidor offline ou inacessível.");
    });
    socket.on("error", (err) => {
      setError(`Erro: ${err}`);
    });
    socket.on("connect", () => {
      setError(null);
    });


    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Função auxilia para tocar o som 
    const playBounce = () => {
      bounceSound.currentTime = 0;
      bounceSound.play().catch(() => {});
    };

    const update = () => {
      if (role === 'left' && gameStarted) {
        ball.current.x += ball.current.dx;
        ball.current.y += ball.current.dy;

        // Colisão teto e chão
        if (ball.current.y <= 10 || ball.current.y >= 590) {
          ball.current.dy *= -1;
          playBounce();
        }

        // Colisão Raquete
        if (ball.current.x <= 30 && ball.current.y >= paddleY.current && ball.current.y <= paddleY.current + 100) {
          ball.current.dx = Math.abs(ball.current.dx);
          playBounce();
        }
        if (ball.current.x >= 770 && ball.current.y >= opponentY.current && ball.current.y <= opponentY.current + 100) {
          ball.current.dx = -Math.abs(ball.current.dx);
          playBounce();
        }
        
        // Pontuação
        if (ball.current.x < 0) {
          socket.emit('scored', 'right');
          resetBall();
        } else if (ball.current.x > 800) {
          socket.emit('scored', 'left');
          resetBall();
        }
        // Sincrunizar a bola com o player da direita
        socket.emit('updateBall', ball.current);
      }
    };

    const resetBall = () => {
      ball.current = { x: 400, y: 300, dx: 5, dy: 5 };
    };

    const draw = () => {
      // Fundo
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 800, 600);

      // Divisão Central
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.setLineDash([15, 15]);
      ctx.beginPath();
      ctx.moveTo(400, 0); ctx.lineTo(400, 600); ctx.stroke();

      //Reseta bilho
      ctx.setLineDash([]);

      // Configuração Global de Neon
      ctx.shadowBlur = 15; // Intensidade do brilho

      // Minha raquete
      const myX = role === 'left' ? 10 : 780;
      ctx.fillStyle = '#ff00ff';
      ctx.shadowColor = '#00ffff';
      ctx.fillRect(myX, paddleY.current, 10, 100);

      // Raquete oponente 
      const oppX = role === 'left' ? 780 : 10;
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#ff00ff';
      ctx.fillRect(oppX, opponentY.current, 10, 100);

      // Bola
      ctx.beginPath();
      ctx.arc(ball.current.x, ball.current.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ff00';
      ctx.fill();

      ctx.shadowBlur = 0; // Desliga o brilho para outros elementos
    };
    
    let animationId;
    const loop = () => {
      update();
      draw();
      animationId = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(animationId);
      socket.off('playerRole');
      socket.off('opponentMove');
      socket.off('syncBall');
      socket.off('syncScore');
      socket.off('gameState');
    }; 
  }, [role, gameStarted]);

  const handleMouseMove = (e) => {
    const react = canvasRef.current.getBoundingClientRect();
    const y = e.clientY - react.top - 50;
    paddleY.current = y;
    socket.emit('updatePaddle', { y });
  };

  return (
    <div style={{ 
        background: '#050505',
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: '#fff',
        fontFamily: '"Courier New", Courier, monospace', 
      }}>
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          backgroundColor: '#ff4d4d',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          fontWeight: 'bold',
          boxShadow: '0 0 15px rgba(255, 77, 77, 0.5)',
          zIndex: 1000,
          border: '2px solid white'
        }}>
          ⚠️ {error}
        </div>
      )}
      <h2 style={{ textShadow: '0 0 10px #fff', color: '#00ffff' }}>Ping Pong Multiplayer</h2>
      <p>{role ? `Você está na ${role === 'left' ? 'ESQUERDA' : 'DIREITA'}` : 'Aguardando Conexão...'}</p>
      <div style={{ display: 'flex', gap: '50px', fontSize: '2rem', marginBottom: '10px' }}>
        <div>Esquerda: {score.left}</div>
        <div>Direita: {score.right}</div>
      </div>
      <div style={{ marginBottom: '10px', color: gameStarted ? '#00ff00' : '#ffcc00' }}>
        {gameStarted ? "🎮 PARTIDA EM ANDAMENTO" : "⏳ AGUARDANDO OPONENTE..."}
      </div>
      <canvas
        ref={canvasRef}
        width="800"
        height="600"
        onMouseMove={handleMouseMove}
        style={{ 
          border: '5px solid #fff',
          borderRadius: '4px', 
          cursor: 'none', 
          background: '#000',
          boxShadow: '0 0 20px rgba(255, 255, 255, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.2)',
        }}
        
      />
    </div>
  );
}

export default App;
