// Centralise la gestion des panneaux d'interface, sélecteurs et palettes
export class UI {
    constructor(onColorChangeCallback, onToolChangeCallback) {
        this.onColorChange = onColorChangeCallback;
        this.onToolChange = onToolChangeCallback;

        this.contextMenu = document.getElementById('color-context-menu');
        this.colorPreview = document.getElementById('color-preview');
        this.btnFavorite = document.getElementById('btn-favorite');
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