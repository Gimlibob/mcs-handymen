# MCS Handymen — Site Web

Site vitrine mobile-first pour **MCS Handymen** (Manvel, Iowa Colony & Rosharon, TX), construit avec **Next.js 16 (App Router) + Tailwind CSS 4**. Objectif : générer des demandes de soumission avec photos plutôt que des appels téléphoniques.

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Pour un build de production :

```bash
npm run build
npm run start
```

## Structure du projet

```
app/
  layout.js          → polices, balises SEO/Open Graph, structure HTML
  page.js            → assemble toutes les sections de la page
  globals.css        → couleurs (noir/or), thème Tailwind
components/
  Header.js          → menu mobile + bouton "Send Project Photos"
  Hero.js            → titre principal + boutons d'action
  Services.js        → grille des 10 services
  HowItWorks.js       → les 3 étapes
  Gallery.js          → placeholder "Before & After Gallery"
  QuoteSection.js     → conteneur de la section formulaire
  QuoteForm.js        → LE formulaire (validation + upload photos)
  FacebookSection.js  → section "Follow MCS Handymen"
  Footer.js           → pied de page
  Logo.js             → logo texte provisoire (voir plus bas)
  icons/FacebookIcon.js → icône Facebook (lucide-react n'a pas d'icônes de marque)
lib/
  site-config.js     → **toutes les valeurs à modifier sont ici**
public/images/       → logo, images
```

## 1. Remplacer le lien Facebook

Ouvrez `lib/site-config.js` et remplacez :

```js
export const FACEBOOK_URL = "https://www.facebook.com/";
```

par votre vraie URL, par exemple :

```js
export const FACEBOOK_URL = "https://www.facebook.com/mcshandymen";
```

Ce lien est utilisé automatiquement partout : header (menu), Hero, section "Follow MCS Handymen" et le footer. **Vous n'avez besoin de le changer qu'à cet endroit.**

## 2. Remplacer l'adresse courriel de secours

Dans le même fichier `lib/site-config.js` :

```js
export const BACKUP_EMAIL = "contact@mcshandymen.com";
```

Remplacez par votre vraie adresse (par exemple `mcshandymen.tx@gmail.com` ou `quotes@mcshandymen.com`). Elle apparaît dans le footer et dans le message d'erreur du formulaire (si l'envoi échoue).

## 3. Ajouter votre vrai logo

Le logo actuel (`components/Logo.js`) est un **logo texte provisoire** (icône marteau + "MCS HANDYMEN" en or) — l'image fournie dans la conversation était en fait une capture d'écran d'un autre site (référence de structure/mise en page), pas votre logo. Aucun fichier logo n'a été transmis.

Pour l'ajouter :

1. Placez votre fichier logo (fond transparent ou foncé de préférence) dans `public/images/`, par exemple `public/images/logo.png`.
2. Remplacez le contenu de `components/Logo.js` par :

```jsx
import Image from "next/image";

export default function Logo({ className = "" }) {
  return (
    <Image
      src="/images/logo.png"
      alt="MCS Handymen"
      width={160}
      height={48}
      className={className}
      priority
    />
  );
}
```

## 4. Connecter le formulaire (recevoir les demandes + photos par courriel)

Le formulaire (`components/QuoteForm.js`) **n'envoie jamais de clé API depuis le navigateur** — il envoie les données (texte + photos) par requête `fetch` vers une URL de service tierce définie dans une variable d'environnement.

### Option recommandée : Formspree (gratuit, gère les photos)

1. Allez sur [formspree.io](https://formspree.io) et créez un compte gratuit.
2. Créez un nouveau formulaire avec comme adresse de réception **votre courriel** (celui remplacé à l'étape 2).
3. Formspree vous donne une URL du type `https://formspree.io/f/xxxxxxxx`.
4. Créez un fichier `.env.local` à la racine du projet (copiez `.env.local.example`) et ajoutez :

```
NEXT_PUBLIC_FORM_ENDPOINT=https://formspree.io/f/xxxxxxxx
```

5. Redémarrez le serveur (`npm run dev`) ou redéployez. C'est tout — les soumissions et les photos jointes arriveront dans votre boîte courriel.

> Limite du plan gratuit Formspree : 50 soumissions/mois et pièces jointes limitées en taille. Passez à un plan payant si le volume augmente.

### Autre option : Web3Forms (gratuit, clé publique uniquement)

1. Créez un compte sur [web3forms.com](https://web3forms.com) et obtenez votre **clé d'accès publique**.
2. Dans `.env.local` :

```
NEXT_PUBLIC_FORM_ENDPOINT=https://api.web3forms.com/submit
```

3. Ouvrez `components/QuoteForm.js` et ajoutez votre clé au `FormData` envoyé (juste avant l'appel `fetch`) :

```js
payload.append("access_key", "VOTRE_CLE_PUBLIQUE_ICI");
```

Cette clé est **publique par conception** (elle ne permet que d'envoyer vers votre formulaire) — c'est pourquoi elle peut être visible côté client sans risque, contrairement à une clé secrète.

### Où l'endpoint est utilisé dans le code

La variable `NEXT_PUBLIC_FORM_ENDPOINT` est lue une seule fois, dans `lib/site-config.js` :

```js
export const FORM_ENDPOINT = process.env.NEXT_PUBLIC_FORM_ENDPOINT || "";
```

Tant que `.env.local` n'est pas configuré, le formulaire affiche automatiquement le message de repli :
*« Sorry, we couldn't send your request right now. Please email your project description and photos directly to [votre courriel] »* — donc rien ne se perd, mais configurez l'endpoint avant la mise en ligne pour une expérience optimale.

### Déploiement (Vercel, Netlify, etc.)

Ajoutez la variable d'environnement `NEXT_PUBLIC_FORM_ENDPOINT` dans les paramètres de votre hébergeur (ex. Vercel → Project Settings → Environment Variables), avec la même valeur que dans `.env.local`.

## 5. Ajouter vos vraies photos "Avant/Après"

La section `components/Gallery.js` affiche pour l'instant "Project photos coming soon." Quand vous aurez vos propres photos de projets terminés :

1. Ajoutez-les dans `public/images/gallery/`.
2. Remplacez le contenu du bloc placeholder dans `components/Gallery.js` par une grille d'images (`next/image`).

Aucune fausse photo, faux témoignage ou fausse note n'a été ajouté, comme demandé.

## Personnalisation additionnelle

- **Services affichés** : liste modifiable dans `SERVICES` (`lib/site-config.js`).
- **Villes du menu déroulant** : `SERVICE_CITIES`.
- **Fourchettes de budget** : `BUDGET_RANGES`.
- **Couleurs** : variables CSS dans `app/globals.css` (`--gold`, `--gold-bright`, `--background`, etc.).
- **Limites d'upload de photos** (nombre de fichiers, taille max) : constantes en haut de `components/QuoteForm.js`.

## Notes techniques

- Aucun numéro de téléphone n'apparaît nulle part sur le site (header, footer, boutons).
- Aucune clé API secrète n'est exposée côté client — seule une URL d'endpoint public (Formspree/Web3Forms) est utilisée.
- Accessibilité de base : labels associés à chaque champ, `aria-invalid`/messages d'erreur liés, navigation clavier (focus visible), lien "Skip to main content", contrastes élevés (texte clair/or sur fond noir).
- SEO : balises `title`, `meta description`, Open Graph et Twitter Card configurées dans `app/layout.js`.
- Le formulaire fonctionne même sans JavaScript activé pour la navigation, mais l'envoi (fetch + validation) nécessite JavaScript, comme c'est standard sur ce type de formulaire avec upload de fichiers.
