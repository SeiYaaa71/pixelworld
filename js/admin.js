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

    setupLogs() {
        setupAdminLogs(this.socket);
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

// Gère l'affichage des logs en temps réel dans le panneau hôte
export function setupAdminLogs(socket) {
    const logListElement = document.getElementById('admin-log-list');
    if (!logListElement) return;

    socket.on('admin_log', (entry) => {
        const li = document.createElement('li');
        const isBan = entry.action.includes('BAN');

        li.innerHTML = `
      <span class="log-time">[${entry.time}]</span> 
      <span class="log-user">${entry.username}</span> : 
      <span class="${isBan ? 'log-ban' : 'log-action'}">${entry.action}</span> 
      ${entry.details}
    `;

        logListElement.prepend(li);

        // Conserve les 50 dernières entrées pour éviter de saturer le DOM
        if (logListElement.children.length > 50) {
            logListElement.removeChild(logListElement.lastChild);
        }
    });
}