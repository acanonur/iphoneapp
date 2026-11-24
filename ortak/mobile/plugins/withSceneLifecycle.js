/**
 * Adopt the UIScene lifecycle, which iOS 27 requires.
 *
 * Expo SDK 54's app template is the older shape: the app delegate makes the
 * window itself and there is no scene delegate. Built with the iOS 27 SDK, an
 * app like that does not get a warning — UIKit stops it at launch, in
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, before the
 * first frame. The icon appears on the home screen and tapping it does nothing.
 *
 * Adopting scenes properly is the job of a newer Expo SDK. Until this app moves
 * to one, this plugin does the smallest thing that satisfies the requirement:
 *
 *  1. declares one window scene in Info.plist, with a scene delegate;
 *  2. adds that delegate to AppDelegate.swift. It does not build anything of
 *     its own — React Native has already made the window and mounted the app
 *     in it by the time a scene connects — it just hands that window to the
 *     scene so it is shown.
 *
 * One behaviour moves with it. Under scenes, a link that opens the app
 * (`ortak://join?…`, a share) arrives at the scene delegate instead of the app
 * delegate, so the delegate forwards it. A link that *launches* the app is
 * forwarded a moment after start-up, once JavaScript is listening; React
 * Native's `getInitialURL` only knows about the old launch path.
 *
 * Delete this plugin when the Expo SDK is upgraded past the point where its
 * own template adopts scenes.
 */
const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const MARKER = '// ikimiz: scene lifecycle';

const SCENE_DELEGATE = `
${MARKER}
// Added by plugins/withSceneLifecycle.js — see that file for why.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let window = appDelegate.window
    else { return }

    // React Native made this window in didFinishLaunching; show it in the scene.
    window.windowScene = windowScene
    window.makeKeyAndVisible()
    self.window = window

    // A link that launched the app: deliver it once JavaScript is listening.
    if let url = connectionOptions.urlContexts.first?.url {
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
        _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
      }
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }
}
`;

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error(
        '[withSceneLifecycle] Expected a Swift AppDelegate. Expo changed its template; ' +
          'check whether it now adopts scenes itself, in which case remove this plugin.',
      );
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${SCENE_DELEGATE}`;
    }
    return cfg;
  });
};
