# L'ŒIL DE PARIS — Simulation de vols de vélos

## Explication

Ce projet fais guise de support bonus pour une présentation à l'oral en cours d'Anglais.
L'oral avait pour but de, trouver une startup du MIT et l'adapter à une autre ville, tout en s'improvisant startup.
Le sujet choisis était [Bike Tra|ffi|cking](https://senseable.mit.edu/bike-trafficking/), et nous avons choisi la ville de Paris.

## Structure du projet

```
oeil-de-paris/
├── index.html               ← Point d'entrée HTML (Vite)
├── vite.config.js           ← Configuration Vite
├── package.json
└── src/
    ├── main.js              ← Orchestrateur principal
    ├── style.css
    ├── core/
    │   ├── engine.js        ← Three.js : scène, caméra, renderer, lumières
    │   └── controls.js      ← Clavier AZERTY + fly-to
    ├── paris/
    │   ├── city.js          ← Paris procédural (grille Haussmann, Seine, monuments)
    │   └── heatmap.js       ← Couche heatmap (InstancedMesh, additive blending)
    ├── simulation/
    │   ├── thefts.js        ← Génération de données de vols
    │   └── montecarlo.js    ← 100 simulations Monte Carlo
    ├── ui/
    │   ├── clusters.js      ← Badges HTML clusters cliquables
    │   ├── minimap.js       ← Mini-carte 2D Canvas
    │   └── hud.js           ← HUD DOM + compteur FPS
    └── utils/
        ├── geo.js           ← Projection géo → world coords
        └── rng.js           ← Générateur pseudo-aléatoire (LCG)
```

## Installation & lancement

```bash
# 1. Installer les dépendances (Node.js requis)
npm install

# 2. Démarrer le serveur de dev Vite (avec HMR)
npm run dev
# → http://localhost:5173  (ouvre automatiquement)

# 3. Build de production
npm run build
# → dossier dist/ prêt à déployer
```

## Contrôles (clavier AZERTY)

| Touche | Action             |
|--------|--------------------|
| Z      | Avancer            |
| S      | Reculer            |
| Q      | Strafe gauche      |
| D      | Strafe droite      |
| E      | Monter             |
| A      | Descendre          |
| SHIFT  | Sprint (×3)        |
| CLIC   | Capturer la souris |
| ÉCHAP  | Libérer la souris  |

## Optimisations FPS

- **Merge géométries** : tous les bâtiments d'un même type = 1 seul draw call
- **InstancedMesh** : heatmap, marqueurs, fenêtres = 0 draw call par objet
- **Pas de shadowMap** sur le tissu urbain procédural
- **Clusters throttlés** à 10fps (calcul coûteux hors GPU)
- **Fog exponentiel** pour culler naturellement les objets lointains
- **pixelRatio limité** à 2 (évite les écrans 4K de tuer les perfs)

## Technologies

- **Vite 5** — dev server, HMR, bundling (Three.js en chunk séparé)
- **Three.js r160** — rendu WebGL
- **Canvas 2D** — minimap, histogrammes
- Zéro dépendance externe hormis Three.js
