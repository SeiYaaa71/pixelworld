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

  // Empêche le champ de vision de déborder hors des limites définies du monde
  clamp() {
    const visibleWidth = this.viewportWidth / this.scale;
    const visibleHeight = this.viewportHeight / this.scale;
 
    if (visibleWidth >= this.worldSize) {
      this.x = (this.worldSize - visibleWidth) / 2;
    } else {
      this.x = Math.max(0, Math.min(this.worldSize - visibleWidth, this.x));
    }
 
    if (visibleHeight >= this.worldSize) {
      this.y = (this.worldSize - visibleHeight) / 2;
    } else {
      this.y = Math.max(0, Math.min(this.worldSize - visibleHeight, this.y));
    }
  }

  // Déplace les coordonnées de la caméra proportionnellement à l'échelle courante
  pan(deltaScreenX, deltaScreenY) {
    this.x -= deltaScreenX / this.scale;
    this.y -= deltaScreenY / this.scale;
    this.clamp();
  }
 
  // Ajuste l'échelle de façon progressive en conservant le curseur comme point pivot
  zoomAt(mouseScreenX, mouseScreenY, deltaWheel) {
    const mouseWorldX = this.x + mouseScreenX / this.scale;
    const mouseWorldY = this.y + mouseScreenY / this.scale;
 
    const zoomFactor = Math.exp(-deltaWheel * 0.0015);
    const targetScale = Math.min(Math.max(this.scale * zoomFactor, this.minScale), this.maxScale);
 
    if (targetScale !== this.scale) {
      this.scale = targetScale;
      this.x = mouseWorldX - mouseScreenX / this.scale;
      this.y = mouseWorldY - mouseScreenY / this.scale;
      this.clamp();
    }
  }
}