# Description du projet 

à completer

# Taches

# Cahier des charges technique - Grille de pixels collaborative (Temps réel)

## 1. Objectif général
Développer une application web collaborative en temps réel (type *r/place*) sur réseau local, permettant à plusieurs utilisateurs de dessiner simultanément sur une toile partagée de 1 000 × 1 000 pixels.

---

## 2. Spécifications fonctionnelles

* **Toile de dessin :**
  * Dimensions fixes : 1 000 × 1 000 pixels.
  * Gamme de couleurs : spectre RGB complet (`#000000` à `#FFFFFF`).
  * Outils utilisateur : sélecteur de couleur, zoom et déplacement (pan), affichage des coordonnées sous le curseur.
* **Interaction joueur :**
  * Poser un pixel d'une couleur choisie d'un simple clic.
  * Gestion d'un temps de recharge (*cooldown*, 1 à 3 secondes entre deux poses) anti-spam.
* **Temps réel :**
  * Latence de mise à jour inférieure à 200 ms sur le réseau local.
  * Tout pixel posé par un joueur apparaît immédiatement sur l'écran des autres participants.
* **Persistance (sauvegarde) :**
  * Sauvegarde automatique de l'état de la grille sur le stockage du serveur toutes les 60 secondes.
  * Restauration automatique du dessin au lancement du serveur.

---

## 3. Spécifications techniques

* **Environnement réseau :** Réseau local (LAN) avec un PC désigné comme serveur hôte.
* **Stockage en mémoire :** Toile conservée en mémoire vive (RAM) côté serveur (~3 à 4 Mo).
* **Communication :**
  * Connexion initiale : téléchargement direct de l'état complet de la grille.
  * Flux continu : protocole bidirectionnel (WebSockets) pour transmettre les micro-paquets : `(X, Y, Couleur)`.
* **Frontend :** Rendu via l'élément HTML5 Canvas pour garantir la fluidité à 1 000 × 1 000.

---

## 4. Découpage des tâches

### Fonctionnalité 1 : Moteur de rendu et navigation (Client / Frontend)

* **Tâche 1.1 : Affichage de la toile Canvas**
  * Créer le conteneur HTML5 Canvas configuré à 1 000 × 1 000 pixels.
  * Implémenter le rendu de l'état initial reçu à la connexion (dessiner l'ensemble des pixels).
  * Implémenter la mise à jour ciblée (redessiner un unique pixel sans rafraîchir toute la toile).

* **Tâche 1.2 : Navigation sur la grille (Zoom & Déplacement)**
  * Gérer le déplacement à la souris (clic droit ou molette maintenue pour glisser).
  * Gérer le zoom centré sur le curseur avec la molette de la souris.
  * Contraindre la caméra pour éviter de sortir du cadre de la grille.

* **Tâche 1.3 : Détection précise du curseur**
  * Convertir les coordonnées écran de la souris en coordonnées réelles de la grille (0 à 999).
  * Afficher un curseur virtuel (surbrillance ou contour) sur le pixel survolé.

---

### Fonctionnalité 2 : Contrôles joueur et interface utilisateur (Client / Frontend)

* **Tâche 2.1 : Sélection des couleurs et coordonnées**
  * Intégrer un sélecteur de couleur HTML (`<input type="color">`) supportant `#000000` à `#FFFFFF`.
  * Créer une palette rapide d'accès (raccourcis pour 8 à 10 couleurs courantes).
  * Afficher dans un coin de l'écran les coordonnées actuelles (X, Y) du pixel visé.

* **Tâche 2.2 : Gestion de l'action de pose (clic joueur)**
  * Détecter le clic gauche sur un pixel.
  * Vérifier localement si le temps de recharge est écoulé avant d'émettre l'action.
  * Pré-colorier le pixel immédiatement sur l'écran du joueur (mise à jour optimiste).

* **Tâche 2.3 : Indicateur visuel de temps de recharge (Cooldown)**
  * Bloquer le clic gauche pendant la durée du cooldown.
  * Afficher une jauge ou un compte à rebours visuel jusqu'au prochain clic disponible.

---

### Fonctionnalité 3 : Serveur temps réel et communication réseau (Backend)

* **Tâche 3.1 : Serveur Web et gestion des connexions**
  * Initialiser le serveur HTTP pour distribuer les fichiers frontend aux PC du réseau local.
  * Monter le serveur WebSocket pour accepter les connexions simultanées.
  * Définir le protocole des messages : format initial (grille complète) et format d'action (`x, y, couleur`).

* **Tâche 3.2 : Traitement et diffusion des pixels**
  * Réceptionner le message d'un joueur posant un pixel.
  * Valider les données reçues (coordonnées entre 0 et 999, code couleur valide).
  * Vérifier le cooldown côté serveur pour empêcher la triche ou le spam.
  * Mettre à jour l'état de la grille en mémoire vive.
  * Re-diffuser immédiatement le micro-paquet `{x, y, couleur}` à tous les autres clients.

---

### Fonctionnalité 4 : Gestion de la mémoire et persistance (Backend / Stockage)

* **Tâche 4.1 : Structure de la grille en mémoire vive (RAM)**
  * Allouer le tableau mémoire représentant les 1 000 × 1 000 pixels dès le démarrage.
  * Développer la fonction d'écriture rapide : modification directe de la valeur à l'index `(x, y)`.
  * Développer la fonction d'exportation du tableau complet pour les nouveaux arrivants.

* **Tâche 4.2 : Sauvegarde sur disque**
  * Programmer une routine récurrente (toutes les 60 secondes) qui copie la grille mémoire vers un fichier `grid.bin`.
  * Gérer l'écriture de secours à l'arrêt manuel du serveur (interception de `Ctrl+C`).

* **Tâche 4.3 : Restauration au démarrage**
  * Vérifier la présence du fichier de sauvegarde lors du lancement.
  * Si le fichier existe : charger son contenu en mémoire vive.
  * Si le fichier n'existe pas : initialiser une toile blanche par défaut.

---

### Fonctionnalité 5 : Déploiement local et tests d'intégration

* **Tâche 5.1 : Configuration du réseau local (LAN)**
  * Récupérer l'adresse IP locale du PC serveur (ex. `192.168.1.XX`).
  * Ouvrir le port d'écoute choisi dans le pare-feu du serveur.
  * Vérifier l'accès depuis les navigateurs des autres ordinateurs.

* **Tâche 5.2 : Test de charge et latence**
  * Tester le dessin simultané à 6 personnes pour vérifier la latence (< 200 ms).
  * Tester la coupure brutale et le redémarrage du serveur pour valider la persistance.

# ADRs

## ADR_001: Choix de la technologie pour le projet

### Contexte:
Pour commencer le projet on doit établir les technologies que l'on va utiliser. Le projet va être sur un site donc il faut choisir le language qui va être utilisé. Ils faut que tout les membres puissent utilisaient cette technologie. On a pensé à utiliser React JS mais pas tout les membres du groupe avaient les connaissances nécessaires pour l'utiliser. De plus, on a décidé de ne pas utiliser d'SQL car faire les demandes à chaque tour seraient trop lent et l'utilisation de WebSocket étaient plus optimisés pour notre site.

### Décision

Pour les languages, on a décider d'utiliser Golang, JS, HTML et CSS. De plus, on va aussi utiliser WebSocket.

### Conséquences
Le site va devoir rester relativement simple sans React et sans une base de données mais elle sera plus facile a crée pour nous.



# Playbook en cas de problème 

En cas d'erreur trouver dans le code d'une autre personne ou tout simplement une erreur que la personne ne sait pas résoudre: 

 - Il doit ouvrir et créer une issue sur GitHub qu'une autre personne pourrait aller intéragir avec 
 - Si l'équipe ne peut pas résoudre le problème il faudrait chercher de l'aide éxterieur.