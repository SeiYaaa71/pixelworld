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

  // Récupère la couleur décomposée en {r, g, b} d'une cellule donnée (ou null si vierge)
  getPixelRgb(gridX, gridY) {
    const rawVal = this.pixelBuffer[gridY * this.gridDimension + gridX];
    if (rawVal === 0) return null;

    const colorVal = rawVal - 1;
    const r = (colorVal >> 16) & 255;
    const g = (colorVal >> 8) & 255;
    const b = colorVal & 255;

    return { r, g, b };
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

    // Vérifie si la zone ciblée contient une majorité absolue de cases vierges
 // Vérifie qu'aucune couleur existante ne domine strictement la zone ciblée
  evaluateAntiGriefingRatio(targetCells) {
    const colorCounts = new Map();

    for (const cell of targetCells) {
      const color = this.pixelBuffer[cell.y * this.gridDimension + cell.x];
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }

    const half = targetCells.length / 2;
    for (const count of colorCounts.values()) {
      if (count > half) {
        return false;
      }
    }

    return true;
  }
 
  // Dessine l'ensemble des éléments visibles dans l'espace caméra
  render(camera, hoveredCell, activeTool, activeColorRgb) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.scale(camera.scale, camera.scale);
    this.ctx.translate(-camera.x, -camera.y);
 
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.worldSize, this.worldSize);
 
    const minCol = Math.max(0, Math.floor(camera.x / this.cellSize));
    const maxCol = Math.min(this.gridDimension, Math.ceil((camera.x + this.canvas.width / camera.scale) / this.cellSize));
    const minRow = Math.max(0, Math.floor(camera.y / this.cellSize));
    const maxRow = Math.min(this.gridDimension, Math.ceil((camera.y + this.canvas.height / camera.scale) / this.cellSize));
 
    for (let row = minRow; row < maxRow; row++) {
      for (let col = minCol; col < maxCol; col++) {
        const storedValue = this.pixelBuffer[row * this.gridDimension + col];
        if (storedValue !== 0) {
          const rawHex = (storedValue - 1).toString(16).padStart(6, '0');
          this.ctx.fillStyle = `#${rawHex}`;
          this.ctx.fillRect(col * this.cellSize, row * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
 
    if (hoveredCell && activeTool.type !== 'pixel') {
      const previewCells = this.computeShapeCells(hoveredCell.x, hoveredCell.y, activeTool);
      this.ctx.fillStyle = `rgba(${activeColorRgb.r}, ${activeColorRgb.g}, ${activeColorRgb.b}, 0.4)`;
      for (const cell of previewCells) {
        this.ctx.fillRect(cell.x * this.cellSize, cell.y * this.cellSize, this.cellSize, this.cellSize);
      }
    }
 
    if (camera.scale >= 0.6) {
      this.ctx.strokeStyle = '#e0e0e0';
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      for (let col = minCol; col <= maxCol; col++) {
        const coordX = col * this.cellSize;
        this.ctx.moveTo(coordX, minRow * this.cellSize);
        this.ctx.lineTo(coordX, maxRow * this.cellSize);
      }
      for (let row = minRow; row <= maxRow; row++) {
        const coordY = row * this.cellSize;
        this.ctx.moveTo(minCol * this.cellSize, coordY);
        this.ctx.lineTo(maxCol * this.cellSize, coordY);
      }
      this.ctx.stroke();
    }
 
    this.ctx.strokeStyle = '#e63946';
    this.ctx.lineWidth = 2 / camera.scale;
    this.ctx.strokeRect(0, 0, this.worldSize, this.worldSize);
 
    this.ctx.restore();
  }
}