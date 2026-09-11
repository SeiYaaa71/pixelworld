// Point d'entrée principal : coordonne les entrées utilisateur, le rendu et le réseau
import { Camera } from './camera.js';
import { Board } from './board.js';
import { UI } from './ui.js';
import { Admin } from './admin.js';
import { Network } from './network.js';

const canvasElement = document.getElementById('gameCanvas');
const loginModalElement = document.getElementById('login-modal');
const usernameInputElement = document.getElementById('username-input');
const btnLoginElement = document.getElementById('btn-login');
const gameContainerElement = document.getElementById('game-container');

const WORLD_PIXEL_SIZE = 4000;
const GRID_DIMENSION = 400;
const DRAG_MOVE_THRESHOLD = 40;

let currentUsername = '';
let activeRgbColor = { r: 0, g: 0, b: 0 };
let currentActiveTool = { type: 'pixel', size: 1 };
let currentHoveredCell = null;
let overlayConfig = null;
let hasConfirmedOverwrite = false;

let isMouseDragging = false;
let hasExceededDragThreshold = false;
let dragOriginScreenX = 0;
let dragOriginScreenY = 0;
let mousePressScreenX = 0;
let mousePressScreenY = 0;

const camera = new Camera(WORLD_PIXEL_SIZE, canvasElement.width, canvasElement.height);
const board = new Board(canvasElement, GRID_DIMENSION, WORLD_PIXEL_SIZE);

const ui = new UI(
  (newRgbColor) => {
    activeRgbColor = newRgbColor;
    refreshDisplay();
  },
  (newToolConfiguration) => {
    currentActiveTool = newToolConfiguration;
  }
);

let adminModule = null;

const network = new Network({
  onConnected: () => ui.updateNetworkStatus('En ligne', '#4caf50'),
  onDisconnected: () => ui.updateNetworkStatus('Déconnecté', '#f44336'),
  onPlayerCount: (count) => ui.updatePlayerCountDisplay(count),
  onBoardInit: (initialBoardData) => {
    board.loadState(initialBoardData);
    refreshDisplay();
  },
  onPixelUpdate: (pixelUpdate) => {
    board.setPixel(pixelUpdate.x, pixelUpdate.y, pixelUpdate.color);
    refreshDisplay();
  },
  onBatchUpdate: (batchUpdates) => {
    board.setBatch(batchUpdates);
    refreshDisplay();
  },
  onLeaderboardUpdate: (leaderboardData) => ui.updateLeaderboardDisplay(leaderboardData),
  onRoleAssigned: (roleInfo) => {
    if (roleInfo.isHost) {
      adminModule = new Admin(network.socket);
      adminModule.enableAdminPrivileges();
      adminModule.setupLogs();
    }
  },
  onAdminUsersList: (connectedUsersList) => {
    if (adminModule) adminModule.renderUsersList(connectedUsersList);
  }
});
// Valide la saisie du joueur et débloque le canvas
function handlePlayerLogin() {
  const trimmedName = usernameInputElement.value.trim();
  if (trimmedName.length >= 3 && trimmedName.length <= 20) {
    currentUsername = trimmedName;
    network.sendUsernameRegistration(currentUsername);
    loginModalElement.style.display = 'none';
    gameContainerElement.classList.remove('blurred');
    document.body.style.overflow = 'auto';
    refreshDisplay();
  }
}
// Convertit la couleur RGB en valeur encodée (0 si blanc pur pour simuler une case vierge)
function getEncodedColorValue() {
  if (activeRgbColor.r === 255 && activeRgbColor.g === 255 && activeRgbColor.b === 255) {
    return 0;
  }
  const numericHex = (activeRgbColor.r << 16) | (activeRgbColor.g << 8) | activeRgbColor.b;
  return numericHex + 1;
}
// Exécute la pose de pixel ou de forme avec validation de sécurité
// Exécute la pose de pixel ou de forme avec confirmation en cas de dépassement du seuil
function executeCanvasToolPlacement(targetCell) {
  if (!currentUsername || !targetCell) return;

  const encodedColor = getEncodedColorValue();

  if (currentActiveTool.type === 'pixel') {
    network.sendSinglePixelPlacement(targetCell.x, targetCell.y, encodedColor, currentUsername);
    return;
  }

  const targetedCellsList = board.computeShapeCells(targetCell.x, targetCell.y, currentActiveTool);
  if (targetedCellsList.length === 0) return;

  // Vérifie la zone dominante uniquement si l'utilisateur n'a pas encore validé
  if (!hasConfirmedOverwrite && !board.evaluateAntiGriefingRatio(targetedCellsList)) {
    const confirmChoice = confirm(
      "Attention : cette zone contient un dessin dominant (> 50 %). " +
      "Veux-tu l'écraser ? (Cet avertissement ne sera plus affiché pour cette session)"
    );

    if (!confirmChoice) return;
    hasConfirmedOverwrite = true;
  }

  const batchPayload = targetedCellsList.map((cell) => ({
    x: cell.x,
    y: cell.y,
    color: encodedColor
  }));
  network.sendBatchPixelPlacement(batchPayload, currentUsername);
}

canvasElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  const isTouchpadHorizontalPan = Math.abs(event.deltaX) > Math.abs(event.deltaY) && !event.ctrlKey;

  if (isTouchpadHorizontalPan) {
    camera.x += event.deltaX / camera.scale;
    camera.clamp();
  } else {
    const canvasBounds = canvasElement.getBoundingClientRect();
    const mouseX = event.clientX - canvasBounds.left;
    const mouseY = event.clientY - canvasBounds.top;
    camera.zoomAt(mouseX, mouseY, event.deltaY);
  }
  refreshDisplay();
}, { passive: false });

canvasElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();

  // Détecte la case sous le clic droit
  const clickedCell = board.screenToGridCoordinates(event.clientX, event.clientY, camera);
  if (clickedCell) {
    const cellRgb = board.getPixelRgb(clickedCell.x, clickedCell.y);
    // Si la case a une couleur, on synchronise les curseurs et la couleur active
    if (cellRgb) {
      ui.applyColor(cellRgb.r, cellRgb.g, cellRgb.b);
    }
  }

  ui.showContextMenu(event.pageX, event.pageY);
});

canvasElement.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    ui.hideContextMenu();
    isMouseDragging = true;
    hasExceededDragThreshold = false;
    dragOriginScreenX = event.clientX;
    dragOriginScreenY = event.clientY;
    mousePressScreenX = event.clientX;
    mousePressScreenY = event.clientY;
  }
});

window.addEventListener('mousemove', (event) => {
  if (event.target === canvasElement) {
    currentHoveredCell = board.screenToGridCoordinates(event.clientX, event.clientY, camera);
  } else {
    currentHoveredCell = null;
  }

  if (!isMouseDragging) {
    if (currentHoveredCell) {
      refreshDisplay();
    }
    return;
  }

  const distanceMoved = Math.hypot(event.clientX - mousePressScreenX, event.clientY - mousePressScreenY);

  if (!hasExceededDragThreshold) {
    if (distanceMoved > DRAG_MOVE_THRESHOLD) {
      hasExceededDragThreshold = true;
      dragOriginScreenX = event.clientX;
      dragOriginScreenY = event.clientY;
      canvasElement.style.cursor = 'grabbing';
    } else {
      return;
    }
  }

  const deltaX = event.clientX - dragOriginScreenX;
  const deltaY = event.clientY - dragOriginScreenY;

  camera.pan(deltaX, deltaY);

  dragOriginScreenX = event.clientX;
  dragOriginScreenY = event.clientY;

  refreshDisplay();
});

window.addEventListener('mouseup', (event) => {
  if (!isMouseDragging) return;

  const distanceMoved = Math.hypot(event.clientX - mousePressScreenX, event.clientY - mousePressScreenY);

  if (!hasExceededDragThreshold && distanceMoved <= DRAG_MOVE_THRESHOLD && event.target === canvasElement) {
    const clickedCell = board.screenToGridCoordinates(event.clientX, event.clientY, camera);
    executeCanvasToolPlacement(clickedCell);
  }

  isMouseDragging = false;
  hasExceededDragThreshold = false;
  canvasElement.style.cursor = 'default';
  refreshDisplay();
});

window.addEventListener('mousedown', (event) => {
  if (!ui.contextMenu.contains(event.target) && event.target !== canvasElement) {
    ui.hideContextMenu();
  }
});

btnLoginElement.addEventListener('click', handlePlayerLogin);
usernameInputElement.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handlePlayerLogin();
});

// Rafraîchit l'affichage complet du canvas avec les options courantes
function refreshDisplay() {
  board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor, overlayConfig);
}

ui.onOverlayImageLoaded = (imageElement) => {
  const aspectRatio = imageElement.height / imageElement.width;
  const initialWidth = 50;
  overlayConfig = {
    element: imageElement,
    aspectRatio,
    opacity: 0.5,
    gridWidth: initialWidth,
    gridHeight: Math.round(initialWidth * aspectRatio),
    gridX: 0,
    gridY: 0
  };
  refreshDisplay();
};

ui.onOverlayConfigChanged = (newSettings) => {
  if (!newSettings) {
    overlayConfig = null;
  } else if (overlayConfig) {
    overlayConfig.opacity = newSettings.opacity;
    overlayConfig.gridWidth = newSettings.gridWidth;
    overlayConfig.gridHeight = Math.round(newSettings.gridWidth * overlayConfig.aspectRatio);
    overlayConfig.gridX = newSettings.gridX;
    overlayConfig.gridY = newSettings.gridY;
  }
  refreshDisplay();
};

canvasElement.style.cursor = 'default';
refreshDisplay();