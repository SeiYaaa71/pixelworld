// Centralise la gestion des panneaux d'interface, sélecteurs et palettes
export class UI {
    constructor(onColorChangeCallback, onToolChangeCallback) {
        this.onColorChange = onColorChangeCallback;
        this.onToolChange = onToolChangeCallback;

        this.contextMenu = document.getElementById('color-context-menu');
        this.colorPreview = document.getElementById('color-preview');
        this.btnFavorite = document.getElementById('btn-favorite');
        this.colorHexInput = document.getElementById('color-hex-input');
        this.sliderR = document.getElementById('slider-r');
        this.sliderG = document.getElementById('slider-g');
        this.sliderB = document.getElementById('slider-b');
        this.paletteContainer = document.getElementById('color-palette');
        this.favoriteContainer = document.getElementById('favorite-palette');
        this.toolButtons = document.querySelectorAll('.btn-tool');
        this.imageLoader = document.getElementById('image-loader');
        this.btnCloseContextMenu = document.getElementById('btn-select-color');

        this.refPanel = document.getElementById('reference-panel');
        this.refImage = document.getElementById('reference-image');
        this.btnToggleRefSide = document.getElementById('btn-toggle-side');
        this.btnCloseRefPanel = document.getElementById('btn-close-ref');

        this.leaderboardElement = document.getElementById('leaderboard-list');
        this.playerCountElement = document.getElementById('count');
        this.statusElement = document.getElementById('status');

        this.basePalette = [
            '#000000', '#ffffff', '#e63946', '#2a9d8f', '#e76f51',
            '#457b9d', '#1d3557', '#f4a261', '#9b5de5', '#55a630'
        ];
        this.favoriteColors = JSON.parse(localStorage.getItem('pixel_favorites') || '[]');

        this.setupListeners();
        this.buildBasePalette();
        this.buildFavoritePalette();
    }

    // Décode une chaîne brute (Hex ou RVB) en triplet numérique {r, g, b}
  parseColorString(rawText) {
    const text = rawText.trim().toLowerCase();
    const rgbMatch = text.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/);
    if (rgbMatch) {
      return {
        r: Math.min(255, parseInt(rgbMatch[1], 10)),
        g: Math.min(255, parseInt(rgbMatch[2], 10)),
        b: Math.min(255, parseInt(rgbMatch[3], 10))
      };
    }
    const hexClean = text.replace(/^#/, '');
    if (/^[0-9a-f]{6}$/.test(hexClean)) {
      return {
        r: parseInt(hexClean.slice(0, 2), 16),
        g: parseInt(hexClean.slice(2, 4), 16),
        b: parseInt(hexClean.slice(4, 6), 16)
      };
    } else if (/^[0-9a-f]{3}$/.test(hexClean)) {
      return {
        r: parseInt(hexClean[0] + hexClean[0], 16),
        g: parseInt(hexClean[1] + hexClean[1], 16),
        b: parseInt(hexClean[2] + hexClean[2], 16)
      };
    }
    return null;
  } 

    // Attache les écouteurs d'événements aux contrôles du menu contextuel
    setupListeners() {
        const updateSliders = () => {
            const redVal = Number(this.sliderR.value);
            const greenVal = Number(this.sliderG.value);
            const blueVal = Number(this.sliderB.value);
            this.applyColor(redVal, greenVal, blueVal);
        };

        this.sliderR.addEventListener('input', updateSliders);
        this.sliderG.addEventListener('input', updateSliders);
        this.sliderB.addEventListener('input', updateSliders);

        this.colorHexInput.addEventListener('input', () => {
        const parsedRgb = this.parseColorString(this.colorHexInput.value);
        if (parsedRgb) {
            this.applyColor(parsedRgb.r, parsedRgb.g, parsedRgb.b, false);
        }
        });

        this.btnFavorite.addEventListener('click', () => {
            const hexColor = this.getCurrentHexColor();
            if (!this.favoriteColors.includes(hexColor)) {
                this.favoriteColors.push(hexColor);
                if (this.favoriteColors.length > 5) this.favoriteColors.shift();
                localStorage.setItem('pixel_favorites', JSON.stringify(this.favoriteColors));
                this.buildFavoritePalette();
            }
        });

        this.toolButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                this.toolButtons.forEach((item) => item.classList.remove('active'));
                btn.classList.add('active');
                this.onToolChange({
                    type: btn.dataset.tool,
                    size: parseInt(btn.dataset.size || '1', 10)
                });
            });
        });

        this.imageLoader.addEventListener('change', (e) => {
            const selectedFile = e.target.files[0];
            if (selectedFile) {
                const fileReader = new FileReader();
                fileReader.onload = (event) => {
                    this.refImage.src = event.target.result;
                    this.refPanel.classList.remove('hidden');
                    this.hideContextMenu();
                };
                fileReader.readAsDataURL(selectedFile);
            }
        });

        this.btnToggleRefSide.addEventListener('click', () => {
            this.refPanel.classList.toggle('pos-left');
            this.refPanel.classList.toggle('pos-right');
        });

        this.btnCloseRefPanel.addEventListener('click', () => {
            this.refPanel.classList.add('hidden');
        });

        this.btnCloseContextMenu.addEventListener('click', () => {
            this.hideContextMenu();
        });
    }

    // Construit les pastilles de couleurs standards
    buildBasePalette() {
        this.paletteContainer.innerHTML = '';
        this.basePalette.forEach((hex) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = hex;
            swatch.addEventListener('click', () => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                this.applyColor(r, g, b);
            });
            this.paletteContainer.appendChild(swatch);
        });
    }

    // Construit les pastilles de couleurs enregistrées par l'utilisateur
    buildFavoritePalette() {
        this.favoriteContainer.innerHTML = '';
        this.favoriteColors.forEach((hex) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = hex;
            swatch.addEventListener('click', () => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                this.applyColor(r, g, b);
            });
            this.favoriteContainer.appendChild(swatch);
        });
    }

    // Récupère la chaîne hexadécimale de la couleur active
    getCurrentHexColor() {
        const r = Number(this.sliderR.value);
        const g = Number(this.sliderG.value);
        const b = Number(this.sliderB.value);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Synchronise les composants graphiques avec la couleur spécifiée
    applyColor(red, green, blue, updateTextInput = true) {
        this.sliderR.value = red;
        this.sliderG.value = green;
        this.sliderB.value = blue;
        this.colorPreview.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
        if (updateTextInput) {
        this.colorHexInput.value = '#' + ((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1).toUpperCase();
        }
        this.onColorChange({ r: red, g: green, b: blue });
    }

    // Ouvre le menu contextuel aux coordonnées demandées
    showContextMenu(cursorPageX, cursorPageY) {
        const menuWidth = 220;
        const menuHeight = 360;

        let posX = cursorPageX;
        let posY = cursorPageY - menuHeight;

        if (posX + menuWidth > window.innerWidth) posX = cursorPageX - menuWidth;
        if (posY < 0) posY = cursorPageY;

        this.contextMenu.style.left = `${posX}px`;
        this.contextMenu.style.top = `${posY}px`;
        this.contextMenu.classList.remove('hidden');
    }

    // Masque le menu contextuel
    hideContextMenu() {
        this.contextMenu.classList.add('hidden');
    }

    // Remplace la liste ordonnée des meilleurs joueurs
    updateLeaderboardDisplay(topPlayersList) {
        this.leaderboardElement.innerHTML = '';
        topPlayersList.forEach((player) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `${player.username} : <span>${player.count}</span>`;
            this.leaderboardElement.appendChild(listItem);
        });
    }

    // Affiche le nombre de personnes connectées
    updatePlayerCountDisplay(playerCount) {
        this.playerCountElement.textContent = playerCount;
    }

    // Met à jour le libellé d'état du réseau
    updateNetworkStatus(statusLabel, statusColor) {
        this.statusElement.textContent = statusLabel;
        this.statusElement.style.color = statusColor;
    }
}