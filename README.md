# aegis-forge-site

Site vitrine **aegis-forge.fr**, statique, heberge par GitHub Pages.

Migre le 2026-08-31 depuis un serveur Scaleway (Caddy, `/var/www/aegis-forge`)
lors de l'arret de l'infrastructure qui l'hebergeait avec un autre projet.

## Particularites

- La page d'accueil historique est `aegis-forge.html`. `index.html` en est une
  **copie** : les liens internes et les URL deja indexees continuent de fonctionner.
- `404.html` est la meme page, ce qui reproduit le `handle_errors` de Caddy.
- **`.nojekyll` est indispensable** : sans lui, Jekyll ignorerait `_shared/`
  (tout le CSS et le JS) et `.well-known/`, et le site s'afficherait sans style.
- `.htaccess` est conserve pour memoire ; il est sans effet sur GitHub Pages.
