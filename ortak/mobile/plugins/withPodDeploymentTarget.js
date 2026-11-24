/**
 * Lift every CocoaPods target to the app's own minimum iOS version.
 *
 * Some pods still declare a deployment target from years ago — react-native-svg
 * ships a resource bundle at iOS 12.4 and AsyncStorage one at 13.4. Xcode used
 * to warn about that and build anyway. Xcode 27 does not: a simulator target
 * below 15.0 is a hard error,
 *
 *     The iOS Simulator deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set
 *     to 12.4, but the range of supported deployment target versions is 15.0
 *     to 27.2.x
 *
 * and the build stops before compiling a line of the app. The pods do not need
 * the old targets — the app itself requires a newer iOS than any of them — so
 * this adds a few lines to the generated Podfile's `post_install` that raise
 * any target below the app's minimum up to it. Targets already at or above it
 * are left alone.
 *
 * It is a config plugin because `ios/` is generated: a hand edit to the Podfile
 * would be gone at the next `expo prebuild`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '# ikimiz: raise pod deployment targets';

/** Matches Expo SDK 54's own minimum; no pod may sit below the app. */
const MINIMUM = '15.1';

const SNIPPET = [
  `    ${MARKER}`,
  '    installer.pods_project.targets.each do |target|',
  '      target.build_configurations.each do |build_configuration|',
  "        current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
  `        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MINIMUM}')`,
  `          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MINIMUM}'`,
  '        end',
  '      end',
  '    end',
].join('\n');

function patchPodfile(contents) {
  if (contents.includes(MARKER)) return contents;

  const anchor = /^(\s*)post_install do \|installer\|\s*$/m;
  if (!anchor.test(contents)) {
    throw new Error(
      '[withPodDeploymentTarget] The generated Podfile has no `post_install do |installer|` block to extend. ' +
        'Expo changed its Podfile template; update plugins/withPodDeploymentTarget.js to match.',
    );
  }
  return contents.replace(anchor, (line) => `${line}\n${SNIPPET}`);
}

module.exports = function withPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      fs.writeFileSync(podfile, patchPodfile(fs.readFileSync(podfile, 'utf8')));
      return cfg;
    },
  ]);
};

module.exports.patchPodfile = patchPodfile;
