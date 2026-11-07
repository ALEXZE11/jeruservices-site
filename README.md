# Site JeruServices

Site public de JeruServices (ménage à domicile à Jérusalem), hébergé gratuitement sur GitHub Pages.
Pages statiques, sans outil de construction : on modifie les fichiers et on pousse, c'est en ligne en une minute.

## Où sont les choses
- `index.html` accueil · `zones.html` zones couvertes · `intervenant.html` devenir intervenant · `confidentialite.html`
- `assets/site.js` : **réglages** en haut du fichier (numéro WhatsApp, langues proposées).
- `assets/style.css` : apparence commune.

## Langues
Chaque texte existe en plusieurs blocs : `data-l="fr"`, `data-l="en"` (et plus tard `data-l="he"`).
Seul le bloc de la langue choisie s'affiche. L'hébreu (droite à gauche) est prêt côté technique mais masqué :
pour l'activer, ajouter un bloc `data-l="he" lang="he"` à côté de chaque bloc `en`, puis ajouter `"he"` dans
`langues` de `assets/site.js`.

## Ajouter une page
Copier une page existante (en-tête et pied de page compris), changer le contenu, ajouter le lien dans le menu
(`<nav class="nav">`) de toutes les pages.

## Règle
Uniquement des informations vraies : pas de faux avis, pas de prix non confirmés, pas de photos de personnes.
