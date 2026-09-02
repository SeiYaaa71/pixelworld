import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Distribue les fichiers du dossier public
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`Joueur connecté : ${socket.id}`);

  // Réception de la pose d'un pixel
  socket.on('PLACE_PIXEL', (data) => {
    // Diffuse le pixel à tous les autres clients connectés
    socket.broadcast.emit('PIXEL_UPDATE', data);
  });

  socket.on('disconnect', () => {
    console.log(`Joueur déconnecté : ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur prêt sur http://localhost:${PORT}`);
});