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
const DRAG_MOVE_THRESHOLD = 12;
 
let currentUsername = '';
let activeRgbColor = { r: 0, g: 0, b: 0 };
let currentActiveTool = { type: 'pixel', size: 1 };
let currentHoveredCell = null;
 
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
    board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
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
    board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
  },
  onPixelUpdate: (pixelUpdate) => {
    board.setPixel(pixelUpdate.x, pixelUpdate.y, pixelUpdate.color);
    board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
  },
  onBatchUpdate: (batchUpdates) => {
    board.setBatch(batchUpdates);
    board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
  },
  onLeaderboardUpdate: (leaderboardData) => ui.updateLeaderboardDisplay(leaderboardData),
  onRoleAssigned: (roleInfo) => {
    if (roleInfo.isHost) {
      adminModule = new Admin(network.socket);
      adminModule.enableAdminPrivileges();
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
    board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
  }
}
// Convertit la couleur RGB courante vers son format numérique encodé
function getEncodedColorValue() {
  const numericHex = (activeRgbColor.r << 16) | (activeRgbColor.g << 8) | activeRgbColor.b;
  return numericHex + 1;
}
 // Exécute la pose de pixel ou de forme avec validation de sécurité
function executeCanvasToolPlacement(targetCell) {
  if (!currentUsername || !targetCell) return;
 
  const encodedColor = getEncodedColorValue();
 
  if (currentActiveTool.type === 'pixel') {
    network.sendSinglePixelPlacement(targetCell.x, targetCell.y, encodedColor, currentUsername);
    return;
  }
 
  const targetedCellsList = board.computeShapeCells(targetCell.x, targetCell.y, currentActiveTool);
  if (targetedCellsList.length === 0) return;
 
  if (!board.evaluateAntiGriefingRatio(targetedCellsList)) {
    alert('Zone protégée : pour utiliser une forme, plus de 50 % des pixels ciblés doivent être vierges.');
    return;
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
  board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
}, { passive: false });
 
canvasElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
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
      board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
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
 
  board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
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
  board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);
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
 
canvasElement.style.cursor = 'default';
board.render(camera, currentHoveredCell, currentActiveTool, activeRgbColor);