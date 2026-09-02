// Établit la connexion avec le serveur Socket.io
const socket = io();

socket.on('connect', () => {
  console.log('Connecté au serveur !');
});

// Écoute les pixels posés par les autres joueurs
socket.on('PIXEL_UPDATE', (data) => {
  console.log('Nouveau pixel reçu :', data);
});