# KimiDesk 🟣

**Kimi**, une petite mascotte qui se balade en permanence sur ton bureau Windows.

![état](https://img.shields.io/badge/Kimi-toujours_là-8b7cf6)

## Ce qu'elle fait

- 🐱 Un petit chat animé (sprites dans le dossier `sprites/`).
- 📍 Apparaît **en bas à droite** de l'écran et reste tranquillement posé là.
- 😴 Dort de temps en temps dans son carton (petits `Zzz`).
- ✋ **Attrape-le à la souris** et lâche-le : il retombe avec un petit rebond.
- 📐 **Taille réglable** : clic droit → *Taille* (Mini → Géant), ou raccourcis
  **`Ctrl+Alt+↑` / `Ctrl+Alt+↓`** pour l'agrandir / le réduire. La taille choisie est mémorisée.
- 🖱️ **Clic droit** sur lui : *Va dormir* / *Réveille-toi* / *Taille* / *Masquer* / *Quitter*.
- 🙈 **`Ctrl+Alt+K`** : masque / réaffiche Kimi instantanément (raccourci global).
- 🔔 Icône dans la zone de notification (à côté de l'horloge) pour le piloter ou le fermer.
- 👻 Toujours au-dessus des autres fenêtres, et les clics passent à travers les zones
  vides : il ne gêne jamais ton travail.

## Démarrer

**Le plus simple :** double-clique sur **`start.bat`**.

Ou en ligne de commande :

```bash
npm install   # la première fois seulement
npm start
```

## Lancer au démarrage de Windows (optionnel)

1. Appuie sur `Win + R`, tape `shell:startup`, valide.
2. Glisse un raccourci vers `start.bat` dans le dossier qui s'ouvre.

Kimi se réveillera à chaque ouverture de session.

## Personnaliser

Tout est dans `src/` :

| Fichier | Rôle |
|---|---|
| `main.js` | La « cervelle » : déplacements, physique, états, menus. Règle la vitesse, la gravité, etc. en haut du fichier. |
| `index.html` | La structure de la mascotte (sprite + ombre + Zzz). |
| `styles.css` | Les sprites et leurs animations (découpage des frames, vitesses). |
| `renderer.js` | Gère l'attrape/lâche et le clic droit. `ART_FACES_LEFT` inverse l'orientation si besoin. |

Les images sont dans `sprites/` : `Idle.png` (10 frames, état posé) et
`IdleInBox.png` (sommeil, 4 frames). Le découpage des frames est défini dans `styles.css`.
(`Walking.png` n'est plus utilisé : son découpage était irrégulier, la marche a été retirée.)

Quelques réglages utiles en haut de `src/main.js` :

```js
const GRAVITY  = 0.9;   // force de chute quand on le lâche
const BASE_WIN = 160;   // taille de référence (échelle 1) ; la taille réelle = BASE_WIN × échelle
```

La taille en jeu se règle directement depuis Kimi (clic droit → *Taille*, ou `Ctrl+Alt+↑/↓`)
et est sauvegardée dans `settings.json` (dossier de données de l'app).

## Créer un exécutable partageable

```bash
npm run dist
```

Ça génère **`dist/KimiDesk.exe`** : un exécutable portable autonome (~70 Mo).
Il suffit de partager ce seul fichier — pas d'installation, double-clic et Kimi apparaît.

> Note : la construction se fait avec `signAndEditExecutable: false` (pas de signature ni
> d'icône personnalisée sur l'exe), ce qui évite d'avoir besoin du mode développeur Windows.

## Note technique

Si tu lances Electron depuis un environnement où `ELECTRON_RUN_AS_NODE=1` est défini,
`require('electron')` renvoie une chaîne et l'app plante au démarrage. `start.bat`
neutralise déjà cette variable ; un terminal normal n'est pas concerné.

---

Fait avec ❤️ — amuse-toi bien avec Kimi.
