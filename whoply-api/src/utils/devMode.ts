/**
 * "Is this a developer's machine or a test run?" — the only place the fixed
 * test OTP, the OTP in API replies and the other test conveniences are allowed.
 *
 * NODE_ENV alone is not enough: a live server started without it (or with a
 * copied dev .env) reads as "development", and would hand out sign-in codes.
 * So it must ALSO be talking to a database on this same machine. A live
 * server uses a remote database (Atlas), which fails this check whatever
 * NODE_ENV says.
 */
const LOCAL_DB = /^mongodb:\/\/(?:[^@/]*@)?(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?]|$)/i;

export const isLocalDb = (uri: string = process.env.MONGODB_URI || 'mongodb://localhost:27017/whoply'): boolean => LOCAL_DB.test(uri);

export const isDevMode = (): boolean => process.env.NODE_ENV !== 'production' && isLocalDb();

/**
 * The password of the demo logins the seed creates. The repository is public,
 * so outside dev mode nobody may sign in with it — even if demo data ever
 * reached a live database.
 */
export const DEMO_PASSWORD = 'whoply123';
