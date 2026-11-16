import Foundation
import Security

/// What the app keeps where it survives the app itself: the access key of the
/// user's server, and the name this phone goes by there. iOS keeps Keychain
/// items when an app is deleted, so a reinstalled app is still the same
/// phone to its server — with its tasks, and its answered calls.
enum Keychain {
    private static let service = "yaver.server"
    private static let keyAccount = "accessKey"

    private static func query(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    static func read(_ account: String) -> String {
        var lookup = query(account)
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(lookup as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let value = String(data: data, encoding: .utf8)
        else { return "" }
        return value
    }

    static func save(_ value: String, as account: String) {
        SecItemDelete(query(account) as CFDictionary)
        guard !value.isEmpty, let data = value.data(using: .utf8) else { return }
        var item = query(account)
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(item as CFDictionary, nil)
    }

    static func readKey() -> String { read(keyAccount) }

    static func saveKey(_ key: String) { save(key, as: keyAccount) }
}
