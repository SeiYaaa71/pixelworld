// Administre l'interface hôte et les interactions de modération
export class Admin {
  constructor(socketInstance) {
    this.socket = socketInstance;
    this.adminBadgeElement = document.getElementById('admin-badge');
    this.adminPanelElement = document.getElementById('admin-panel');
    this.adminUserListElement = document.getElementById('admin-user-list');
  }
 
}