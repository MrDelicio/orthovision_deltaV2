# OrthoVisionΔ Web v0.9.1 ParallaxeVivanteΔ corrigée

Base : v0.8.1 ReliefPurΔ.

## Nouveau mode

```text
PARALLAXE VIVANTE
```

Cette vue ne mesure pas la distance en mètres.

Elle lit une profondeur relative :

```text
proche
moyen
loin / fond
```

à partir du mouvement relatif des zones quand la caméra bouge légèrement.

## Principe

```text
image caméra
↓
zones lumineuses
↓
mémoire précédente des zones
↓
déplacement local approximatif
↓
mouvement global de caméra
↓
écart relatif
↓
ParallaxeVivanteΔ
```

Lecture :

```text
bleu
= fond / loin / faible parallaxe

vert
= moyen

orange / rouge
= proche / mouvement relatif fort

noir
= pas assez d’information
```

## Important

```text
Ce n’est pas une vraie distance métrique.
Ce n’est pas du GPS.
Ce n’est pas du LiDAR.
Ce n’est pas une reconstruction 3D.
```

Pour que la vue fonctionne, il faut bouger doucement la caméra :

```text
petit mouvement gauche/droite
petit mouvement haut/bas
pas un grand shake rapide
```

## Fichiers

```text
index.html
style.css
js/orthovision-state.js
js/orthovision-core.js
js/orthovision-views.js
js/orthovision-audio.js
js/orthovision-ui.js
```


## v0.9.1 — Correction ParallaxeVivanteΔ

La v0.9 lisait trop vite et trop partout.

v0.9.1 change la règle :

```text
pas de tenue locale
→ pas de lecture de parallaxe

zone faible / bruitée
→ noir

zone tenue + mouvement relatif cohérent
→ profondeur relative
```

Donc la vue ne cherche plus à colorer toute l'image.

Elle cherche plutôt :

```text
présence tenue
bord lisible
trace locale
écart au mouvement global
cohérence de voisinage
```

Affichage :

```text
noir
= ignoré / pas assez d'information

bleu
= fond / loin / faible parallaxe

vert
= moyen

jaune / orange / rouge
= proche / mouvement relatif fort
```

Important :

```text
il faut bouger doucement la caméra
un petit mouvement gauche/droite ou haut/bas
pas de shake rapide
```
