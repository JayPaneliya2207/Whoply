/**
 * Prints a new key pair for phone notifications (Web Push).
 *
 *   npm run push:keys            (on a live server: npm run push:keys:prod)
 *
 * Put the three lines in the API's .env (deploy/.env on the server) and
 * restart the API. Make them ONCE and keep them: changing the keys later
 * silently switches notifications off on every device until its owner turns
 * them on again.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('# Phone notifications (Web Push) — keep these, never change them');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@your-domain.com   # your real support email');
