/**
 * `seed` and `seed:reset` delete every shop, bill and customer before loading
 * demo data. They are for testing — never on a live server by accident.
 */
import { isLocalDb } from '../utils/devMode.js';

export function refuseOnLiveDatabase(script: string): void {
    if (process.env.I_UNDERSTAND_THIS_WIPES_THE_DATABASE === 'yes') return;
    const live = process.env.NODE_ENV === 'production';
    // A dev PC whose .env points at the live database is the other way to wipe it by accident.
    const remote = !isLocalDb();
    if (!live && !remote) return;
    console.error(`❌ ${script} deletes every shop, bill and customer. It is for testing only, so it won't run ${live ? 'with NODE_ENV=production' : 'against a database that is not on this computer (check MONGODB_URI)'}.`);
    console.error('   On a new live server use `npm run setup:prod` instead (creates the plans and your admin login, nothing else).');
    process.exit(1);
}
