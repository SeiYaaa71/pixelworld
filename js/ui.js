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