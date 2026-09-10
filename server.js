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
function detectLocalIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName of Object.keys(networkInterfaces)) {
    for (const iface of networkInterfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}