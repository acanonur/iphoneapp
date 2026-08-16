// Metro needs two things to bundle ../shared:
//
//  1. It sits outside this project's folder, and Metro refuses to read from
//     there unless the folder is listed in watchFolders.
//  2. Its imports are written for Node's ESM resolver, so they carry explicit
//     ".js" extensions that actually point at ".ts" files. TypeScript
//     understands that convention; Metro does not, so the extension is stripped
//     for those files only. Restricting the rewrite to importers inside
//     ../shared keeps it away from real .js files in node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(sharedRoot, 'node_modules'),
];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath ?? '';
  const isShared = origin.startsWith(sharedRoot);
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (isShared && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    return resolve(context, moduleName.slice(0, -'.js'.length), platform);
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
