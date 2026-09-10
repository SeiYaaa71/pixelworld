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