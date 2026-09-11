import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const app = express();
const server = http.createServer(app);
const io = new Server(server);
 
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
 
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const GRID_CELLS = 400;
const TOTAL_PIXELS = GRID_CELLS * GRID_CELLS;
const BOARD_FILE_PATH = path.join(__dirname, 'board.bin');
const SCORES_FILE_PATH = path.join(__dirname, 'scores.json');
 
const pixelBoardData = new Uint32Array(TOTAL_PIXELS);
let playerScores = {};
const bannedIpAddresses = new Set();
const activeUsersRegistry = new Map();
 
// Charge l'état binaire de la grille depuis le stockage local
function loadBoardStorage() {
  if (fs.existsSync(BOARD_FILE_PATH)) {
    const buffer = fs.readFileSync(BOARD_FILE_PATH);
    const loadedData = new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    pixelBoardData.set(loadedData);
  }
}
 
// Charge les totaux de pixels par joueur depuis le fichier JSON
function loadScoresStorage() {
  if (fs.existsSync(SCORES_FILE_PATH)) {
    try {
      playerScores = JSON.parse(fs.readFileSync(SCORES_FILE_PATH, 'utf-8'));
    } catch (error) {
      console.error('Erreur de lecture des scores :', error);
    }
  }
}

// Écrit l'intégralité du tableau binaire sur le disque
function persistBoardToDisk() {
  fs.writeFile(BOARD_FILE_PATH, Buffer.from(pixelBoardData.buffer), (err) => {
    if (err) console.error('Erreur sauvegarde board :', err);
  });
}
 
// Écrit le dictionnaire des scores dans le fichier JSON
function persistScoresToDisk() {
  fs.writeFile(SCORES_FILE_PATH, JSON.stringify(playerScores, null, 2), (err) => {
    if (err) console.error('Erreur sauvegarde scores :', err);
  });
}
 
// Extrait et trie les 10 meilleurs scores
function computeTopLeaderboard() {
  return Object.entries(playerScores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .slice(0, 10)
    .map(([username, pixelCount]) => ({ username, count: pixelCount }));
}
 
// Récupère l'adresse IPv4 locale de la machine hôte
// Récupère l'adresse IPv4 locale physique réelle sur Windows en ciblant le sous-réseau actif
function detectLocalIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  const ignoredPatterns = /(loopback|virtual|wsl|vethernet|vmware|tap|tun|docker)/i;
  const fallbackCandidates = [];

  for (const [interfaceName, addresses] of Object.entries(networkInterfaces)) {
    if (ignoredPatterns.test(interfaceName)) continue;

    for (const addressInfo of addresses) {
      if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
        // Cible ton sous-réseau exact en priorité
        if (addressInfo.address.startsWith('10.6.0.')) {
          return addressInfo.address;
        }
        if (addressInfo.address.startsWith('192.168.') || addressInfo.address.startsWith('10.')) {
          fallbackCandidates.unshift(addressInfo.address);
        } else {
          fallbackCandidates.push(addressInfo.address);
        }
      }
    }
  }

  return fallbackCandidates[0] || 'localhost';
}

// Transmet la liste actualisée des joueurs connectés aux administrateurs
function broadcastConnectedUsersToAdmins() {
  const usersPayload = Array.from(activeUsersRegistry.entries()).map(([socketId, user]) => ({
    id: socketId,
    username: user.username,
    ip: user.ip
  }));
  io.to('admin_room').emit('admin_user_list', usersPayload);
}
 
loadBoardStorage();
loadScoresStorage();
 
io.use((socket, next) => {
  const clientIp = socket.handshake.address.replace(/^.*:/, '');
  if (bannedIpAddresses.has(clientIp)) {
    return next(new Error('BANNED'));
  }
  next();
});
 
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address.replace(/^.*:/, '');
  const isHost = (clientIp === '127.0.0.1' || clientIp === 'localhost' || clientIp === '::1');
 
  io.emit('player_count', io.engine.clientsCount);
  socket.emit('init_board', Array.from(pixelBoardData));
  socket.emit('leaderboard_update', computeTopLeaderboard());
  socket.emit('role_assignment', { isHost });
 
  if (isHost) {
    socket.join('admin_room');
    broadcastConnectedUsersToAdmins();
  }
 
  socket.on('register_username', (username) => {
    activeUsersRegistry.set(socket.id, { username, ip: clientIp });
    broadcastConnectedUsersToAdmins();
  });
 
  socket.on('admin_ban_user', (targetSocketId) => {
    if (!isHost) return;
    const targetUser = activeUsersRegistry.get(targetSocketId);
    if (targetUser) {
      bannedIpAddresses.add(targetUser.ip);
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('banned');
        targetSocket.disconnect(true);
      }
    }
  });

    socket.on('set_pixel', (data) => {
    const { x, y, color, username } = data;
    if (x >= 0 && x < GRID_CELLS && y >= 0 && y < GRID_CELLS && username) {
      pixelBoardData[y * GRID_CELLS + x] = color;
      playerScores[username] = (playerScores[username] || 0) + 1;
 
      io.emit('pixel_updated', { x, y, color });
      io.emit('leaderboard_update', computeTopLeaderboard());
      persistBoardToDisk();
      persistScoresToDisk();
    }
  });

  socket.on('set_pixels_batch', (data) => {
    const { pixels, username } = data;
    if (!Array.isArray(pixels) || !username) return;
 
    const validatedPixels = [];
    for (const pixel of pixels) {
      if (pixel.x >= 0 && pixel.x < GRID_CELLS && pixel.y >= 0 && pixel.y < GRID_CELLS) {
        pixelBoardData[pixel.y * GRID_CELLS + pixel.x] = pixel.color;
        validatedPixels.push(pixel);
      }
    }
 
    if (validatedPixels.length > 0) {
      playerScores[username] = (playerScores[username] || 0) + validatedPixels.length;
      io.emit('pixels_batch_updated', validatedPixels);
      io.emit('leaderboard_update', computeTopLeaderboard());
      persistBoardToDisk();
      persistScoresToDisk();
    }
  });
 
  socket.on('disconnect', () => {
    activeUsersRegistry.delete(socket.id);
    broadcastConnectedUsersToAdmins();
    io.emit('player_count', io.engine.clientsCount);
  });
});
 
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  const hostIp = detectLocalIpAddress();
  console.log(`Accès local hôte : http://localhost:${PORT}`);
  console.log(`Accès réseau joueurs : http://${hostIp}:${PORT}`);
});
