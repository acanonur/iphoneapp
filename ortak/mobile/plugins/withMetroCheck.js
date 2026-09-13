/**
 * Fail a debug build early, and legibly, when Metro is not running.
 *
 * A debug build embeds no JavaScript. It asks the Metro bundler for the bundle
 * at launch, and React Native finds Metro by probing
 * http://localhost:8081/status: see `guessPackagerHost` in
 * RCTBundleURLProvider.mm, which returns nil when that probe fails. A nil host
 * means a nil bundle URL, and the app dies on a red screen reading
 *
 *     No script URL provided
 *     unsanitizedScriptURLString = (null)
 *
 * which says nothing about a bundler. `npx expo run:ios` starts Metro as part
 * of the run so it never comes up there, but pressing Run in Xcode does not,
 * and Expo's template carries no "Start Packager" build phase to make up for
 * the difference.
 *
 * This phase does the same probe the app will do, at build time, and turns a
 * confusing runtime failure into a build error naming the fix. It starts
 * nothing: launching a bundler from a build phase means either driving
 * Terminal through AppleScript (which prompts for automation permission) or
 * leaving a background process Xcode may reap, and a plain check has neither
 * failure mode.
 *
 * Release builds embed the bundle and are skipped.
 */
const { withXcodeProject } = require('@expo/config-plugins');

const PHASE_NAME = 'Check Metro is running';

const SHELL_SCRIPT = [
  'if [ "$CONFIGURATION" != "Debug" ]; then',
  '  exit 0',
  'fi',
  '',
  'PORT="${RCT_METRO_PORT:-8081}"',
  'STATUS=$(curl --silent --max-time 3 "http://localhost:$PORT/status" 2>/dev/null || true)',
  '',
  'if [ "$STATUS" = "packager-status:running" ]; then',
  '  exit 0',
  'fi',
  '',
  'echo "error: Metro is not running on port $PORT, and a Debug build has no JavaScript of its own."',
  'echo "error: Open a separate terminal, run: cd $SRCROOT/.. && npx expo start"',
  'echo "error: Leave it running, then build again. (Or skip Xcode entirely: npx expo run:ios)"',
  'exit 1',
].join('\n');

module.exports = function withMetroCheck(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;

    // Config plugins re-run on every prebuild, and `--clean` is not guaranteed,
    // so adding blindly would stack duplicate phases.
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const already = Object.values(phases).some(
      (phase) => phase && typeof phase === 'object' && phase.name === `"${PHASE_NAME}"`,
    );
    if (already) return cfg;

    const target = project.getFirstTarget();
    project.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, target.uuid, {
      shellPath: '/bin/sh',
      shellScript: SHELL_SCRIPT,
    });

    return cfg;
  });
};
