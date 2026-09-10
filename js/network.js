// Gère l'ensemble des communications réseau Socket.io et leurs abonnements
export class Network {
  constructor(callbacks) {
    this.socket = io();
    this.callbacks = callbacks;
    this.registerEventSubscriptions();
  }
 
  // Lie chaque événement reçu du serveur à son traitement client
  registerEventSubscriptions() {
    this.socket.on('connect', () => this.callbacks.onConnected());
    this.socket.on('disconnect', () => this.callbacks.onDisconnected());
    this.socket.on('player_count', (count) => this.callbacks.onPlayerCount(count));
    this.socket.on('init_board', (boardData) => this.callbacks.onBoardInit(boardData));
    this.socket.on('pixel_updated', (pixelData) => this.callbacks.onPixelUpdate(pixelData));
    this.socket.on('pixels_batch_updated', (batchData) => this.callbacks.onBatchUpdate(batchData));
    this.socket.on('leaderboard_update', (leaderboard) => this.callbacks.onLeaderboardUpdate(leaderboard));
    this.socket.on('role_assignment', (roleData) => this.callbacks.onRoleAssigned(roleData));
    this.socket.on('admin_user_list', (usersList) => this.callbacks.onAdminUsersList(usersList));
 
    this.socket.on('banned', () => {
      alert('Vous avez été banni de cette session par l\'hôte.');
      window.location.reload();
    });
 
    this.socket.on('connect_error', (error) => {
      if (error.message === 'BANNED') {
        document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:100px;">Accès refusé : votre adresse IP est bannie.</h1>';
      }
    });
  }
 
}