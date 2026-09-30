/**
 * `seed` and `seed:reset` delete every shop, bill and customer before loading
 * demo data. They are for testing — never on a live server by accident.
 */
export function refuseOnLiveDatabase(script: string): void {
    if (process.env.NODE_ENV === 'production' && process.env.I_UNDERSTAND_THIS_WIPES_THE_DATABASE !== 'yes') {
        console.error(`❌ ${script} deletes every shop, bill and customer. It is for testing only, so it won't run with NODE_ENV=production.`);
        console.error('   On a new live server use `npm run setup:prod` instead (creates the plans and your admin login, nothing else).');
        process.exit(1);
    }
}
