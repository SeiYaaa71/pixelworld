// Gère la position spatiale, les contraintes de limites et l'échelle de zoom de la caméra
export class Camera {
  constructor(worldSize, viewportWidth, viewportHeight) {
    this.worldSize = worldSize;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
 
    this.scale = 1.0;
    this.minScale = 0.2;
    this.maxScale = 5.0;
 
    this.x = (worldSize - viewportWidth) / 2;
    this.y = (worldSize - viewportHeight) / 2;
  }