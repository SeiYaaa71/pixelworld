# Pixel World
 
Une application web collaborative de pixel art en temps réel inspirée de r/place, développée en JavaScript avec Node.js, Express, Socket.IO et HTML5 Canvas.
 
Le projet permet à un hôte de déployer un serveur sur son réseau local (LAN). N'importe quel appareil connecté au même réseau peut rejoindre la partie via son navigateur, choisir un pseudo et contribuer à une fresque géante partagée.
 
---
 
## Fonctionnalités
 
### 🌐 Réseau & Multijoueur
- **Hébergement LAN simplifié :** détection automatique et affichage de l'adresse IP locale dès le lancement du serveur.
- **Synchronisation en direct :** chaque pixel posé est immédiatement diffusé à tous les clients connectés via WebSockets (Socket.IO).
- **Compteur de joueurs :** mise à jour temps réel des utilisateurs en ligne.
 
### 🎨 Canvas & Outils de dessin
- **Grille massive :** monde de 400 × 400 blocs (4 000 × 4 000 px), chaque case mesurant 10 × 10 px.
- **Contrôles caméra :** déplacement fluide (*pan*) à la souris (clic gauche glissé) ou au pavé tactile (deux doigts), zoom centré sous le curseur (molette ou pincement tactile).
- **Seuil anti-tremblement :** zone tampon de 12 px pour différencier un clic franc d'un glissement de caméra.
- **Menu contextuel (clic droit) :**
  - Sélecteur RVB dynamique avec prévisualisation.
  - Palette rapide de 10 couleurs prédéfinies.
  - Sauvegarde de couleurs favorites persistantes dans le navigateur (`localStorage`).
  - Outils de formes géométriques rapides (carrés 3×3, 5×5, 10×10 et cercles de rayon 2 ou 4) avec prévisualisation translucide.
- **Protection anti-griefing :** interdiction de poser une forme si la zone ciblée n'est pas composée à plus de 50 % de pixels vierges.
- **Modèle de référence :** importateur d'image local côté client, affiché dans un volet flottant basculable à gauche ou à droite de l'écran.
 
### 🏆 Compétition & Persistance
- **Classement (Top 10) :** comptabilisation du nombre de pixels posés par pseudo et mise à jour en direct.
- **Sauvegarde binaire (`board.bin`) :** persistance de la grille complète sur le disque dur, rechargée automatiquement au redémarrage du serveur.
- **Sauvegarde JSON (`scores.json`) :** conservation des scores cumulés de chaque joueur.
 
### 🛡️ Administration & Modération (Hôte)
- **Détection automatique :** le client se connectant depuis la machine hôte (`localhost`) reçoit les privilèges administrateur.
- **Panneau de modération :** visualisation de la liste des joueurs connectés (pseudos et adresses IP).
- **Bannissement par IP :** déconnexion forcée immédiate et blocage définitif d'accès au niveau du middleware réseau.
 
---
 
## Architecture du code
 
```text
pixelworld/
├── css/
│   └── style.css          # Feuilles de style (modale, menu contextuel, hud)
├── js/
│   ├── admin.js           # Logique du panneau d'administration et kick/ban
│   ├── board.js           # Moteur du canvas, buffer binaire local et rendu 2D
│   ├── camera.js          # Calculs de translation, zoom et limites de vue
│   ├── main.js            # Orchestration des entrées utilisateur et événements
│   ├── network.js         # Interface réseau Socket.IO côté client
│   └── ui.js              # Gestion du DOM, sélecteurs de couleur et palettes
├── .gitignore             # Exclusion des dépendances et fichiers de sauvegarde
├── index.html             # Structure HTML unique
├── package.json           # Dépendances et scripts Node.js (ES Modules)
└── server.js              # Serveur Express & Socket.IO, persistance et logique hôte
```

## Architectural Decision Records (ADRs)

### ADR_001 : Choix de la technologie pour le projet

* **Contexte :**
  Pour commencer le projet, nous devons établir les technologies utilisées. Le projet étant une application web, il faut choisir un langage maîtrisé par tous les membres. L'utilisation de React JS a été écartée car certains membres ne possédaient pas les connaissances nécessaires. De plus, nous avons décidé de ne pas utiliser SQL car effectuer des requêtes en base à chaque pixel posé serait trop lent ; l'utilisation de WebSockets est plus optimisée pour notre cas d'usage.
* **Décision :**
  Utiliser Go, JavaScript, HTML, CSS et WebSockets.
* **Conséquences :**
  Le site reste simple, sans framework lourd et sans BDD, ce qui facilite son développement et optimise sa vitesse.

---

## Playbook d'incident

En cas d'erreur trouvée dans le code d'un autre membre ou d'un problème non résolu :

1. Ouvrir et créer une **Issue** sur GitHub afin qu'un autre membre puisse intervenir.
2. Si l'équipe ne parvient pas à résoudre le problème, solliciter une aide extérieure.
