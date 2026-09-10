// Administre l'interface hôte et les interactions de modération
export class Admin {
    constructor(socketInstance) {
        this.socket = socketInstance;
        this.adminBadgeElement = document.getElementById('admin-badge');
        this.adminPanelElement = document.getElementById('admin-panel');
        this.adminUserListElement = document.getElementById('admin-user-list');
    }
    // Affiche les contrôles dédiés si le client est identifié comme hôte
    enableAdminPrivileges() {
        this.adminBadgeElement.classList.remove('hidden');
        this.adminPanelElement.classList.remove('hidden');
    }

    // Réécrit la liste des joueurs connectés avec le bouton de bannissement
    renderUsersList(connectedUsersList) {
        this.adminUserListElement.innerHTML = '';
        connectedUsersList.forEach((user) => {
            if (user.id === this.socket.id) return;

            const listItem = document.createElement('li');
            listItem.innerHTML = `
<span>${user.username || 'Anonyme'} <small>(${user.ip})</small></span>
<button class="btn-ban" data-id="${user.id}">Bannir</button>
      `;

            listItem.querySelector('.btn-ban').addEventListener('click', () => {
                if (confirm(`Bannir définitivement ${user.username || 'ce joueur'} ?`)) {
                    this.socket.emit('admin_ban_user', user.id);
                }
            });

            this.adminUserListElement.appendChild(listItem);
        });
    }
}