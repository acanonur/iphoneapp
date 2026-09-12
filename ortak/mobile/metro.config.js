// Metro needs two things to bundle this project.
//
//  1. ../shared sits outside the project folder, and Metro refuses to read from
//     there unless the folder is listed in watchFolders.
//  2. Both ../shared and this app write their imports for Node's ESM resolver,
//     so relative specifiers carry explicit ".js" extensions that actually
//     point at ".ts"/".tsx" files. TypeScript understands that convention;
//     Metro does not, so the extension is stripped before resolving.
//
// The rewrite deliberately covers *both* source trees. Scoping it to ../shared
// alone was a bug: every screen in app/ imports its own modules the same way
// (`../../src/store/useStore.js`), so bundling failed on the first screen that
// pulled one in. It stays away from node_modules, where a ".js" specifier means
// a real file and stripping it could pick a different module.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'shared');
const sourceRoots = [projectRoot, sharedRoot];

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(sharedRoot, 'node_modules'),
];

const defaultResolveRequest = config.resolver.resolveRequest;
const NODE_MODULES = `${path.sep}node_modules${path.sep}`;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath ?? '';
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  const isOwnSource =
    !origin.includes(NODE_MODULES) &&
    sourceRoots.some((root) => origin === root || origin.startsWith(root + path.sep));

  if (isOwnSource && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -'.js'.length), platform);
    } catch {
      // A specifier that really does name a .js file falls through unchanged.
    }
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
