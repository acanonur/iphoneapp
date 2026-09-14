/**
 * App config, as JavaScript so it can read the environment.
 *
 * The only reason this is not `app.json` is `ORTAK_SERVER_URL`: baking the
 * server address in at build time is what lets the first screen stop asking for
 * it. Set it when you build and nobody is ever asked:
 *
 *   ORTAK_SERVER_URL=http://192.168.2.56:8788 npx expo run:ios
 *
 * Leave it unset and the app still works — it just asks the person starting the
 * project where their server is, once, under "Where this is stored". The person
 * *joining* is never asked either way, because the invite carries the address.
 */

const config = require('./app.base.json').expo;

module.exports = () => {
  const defaultServerUrl = (process.env.ORTAK_SERVER_URL ?? '').trim();

  return {
    ...config,
    extra: {
      ...config.extra,
      // Set only when there is one. Expo's config normalisation rewrites a null
      // here into an empty object, which is truthy and would read back as a
      // configured server that is not there.
      ...(defaultServerUrl ? { defaultServerUrl } : {}),
    },
  };
};
