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