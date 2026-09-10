// Encapsule les données binaires de la grille et les méthodes de rendu graphique
export class Board {
  constructor(canvasElement, gridDimension, totalWorldSize) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.gridDimension = gridDimension;
    this.worldSize = totalWorldSize;
    this.cellSize = totalWorldSize / gridDimension;
    this.pixelBuffer = new Uint32Array(gridDimension * gridDimension);
  }
 
  // Injecte un lot de données dans le buffer local
  loadState(pixelArray) {
    this.pixelBuffer.set(pixelArray);
  }
 
  // Modifie la couleur d'une coordonnée spécifique
  setPixel(gridX, gridY, encodedColor) {
    this.pixelBuffer[gridY * this.gridDimension + gridX] = encodedColor;
  }

  // Modifie une collection de pixels simultanément
  setBatch(pixelsList) {
    for (const pixel of pixelsList) {
      this.pixelBuffer[pixel.y * this.gridDimension + pixel.x] = pixel.color;
    }
  }
 
  // Convertit des coordonnées d'écran en indices de cellule de grille
  screenToGridCoordinates(screenX, screenY, camera) {
    const canvasRect = this.canvas.getBoundingClientRect();
    const relativeX = screenX - canvasRect.left;
    const relativeY = screenY - canvasRect.top;
 
    const worldCoordX = camera.x + relativeX / camera.scale;
    const worldCoordY = camera.y + relativeY / camera.scale;
 
    const cellCol = Math.floor(worldCoordX / this.cellSize);
    const cellRow = Math.floor(worldCoordY / this.cellSize);
 
    if (cellCol >= 0 && cellCol < this.gridDimension && cellRow >= 0 && cellRow < this.gridDimension) {
      return { x: cellCol, y: cellRow };
    }
    return null;
  }
 
  // Génère la liste des cases couvertes par un outil géométrique
  computeShapeCells(centerGridX, centerGridY, activeTool) {
    const targetCells = [];
    if (activeTool.type === 'pixel') {
      targetCells.push({ x: centerGridX, y: centerGridY });
    } else if (activeTool.type === 'square') {
      const radiusOffset = Math.floor(activeTool.size / 2);
      for (let deltaY = -radiusOffset; deltaY <= radiusOffset; deltaY++) {
        for (let deltaX = -radiusOffset; deltaX <= radiusOffset; deltaX++) {
          const currentX = centerGridX + deltaX;
          const currentY = centerGridY + deltaY;
          if (currentX >= 0 && currentX < this.gridDimension && currentY >= 0 && currentY < this.gridDimension) {
            targetCells.push({ x: currentX, y: currentY });
          }
        }
      }
    } else if (activeTool.type === 'circle') {
      const radius = activeTool.size;
      for (let deltaY = -radius; deltaY <= radius; deltaY++) {
        for (let deltaX = -radius; deltaX <= radius; deltaX++) {
          if (deltaX * deltaX + deltaY * deltaY <= radius * radius) {
            const currentX = centerGridX + deltaX;
            const currentY = centerGridY + deltaY;
            if (currentX >= 0 && currentX < this.gridDimension && currentY >= 0 && currentY < this.gridDimension) {
              targetCells.push({ x: currentX, y: currentY });
            }
          }
        }
      }
    }
    return targetCells;
  }