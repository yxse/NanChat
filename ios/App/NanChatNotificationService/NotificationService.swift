import Foundation
import Security
import UserNotifications

// Decrypts chat message previews before iOS displays the notification.
//
// The server sends a visible push (`mutable-content: 1`) with a generic body ("New message")
// plus the encrypted message in the data payload. If the decryption key is available and the
// message decrypts, the body is replaced with the plaintext; otherwise the generic notification
// is shown untouched, so a notification is never lost.
class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }
        bestAttemptContent = content
        let userInfo = content.userInfo

        if let chatId = userInfo["chatId"] as? String, !chatId.isEmpty {
            content.threadIdentifier = chatId // group notifications per chat, as the app does
        }
        if let preview = MessagePreview.decrypt(userInfo: userInfo) {
            content.body = preview
        }
        contentHandler(content)
        self.contentHandler = nil
    }

    override func serviceExtensionTimeWillExpire() {
        // Deliver whatever we have (the generic body at worst) before the system kills us.
        if let contentHandler = contentHandler, let content = bestAttemptContent {
            contentHandler(content)
        }
        contentHandler = nil
    }
}

enum MessagePreview {
    /// Plaintext body for a chat message push, or nil to keep the server's body.
    static func decrypt(userInfo: [AnyHashable: Any]) -> String? {
        guard let message = userInfo["message"] as? String, !message.isEmpty,
              let fromAccount = userInfo["fromAccount"] as? String else { return nil }
        let isGroup = (userInfo["type"] as? String) == "group"

        let keyHex: String?
        if isGroup {
            guard let sharedAccount = userInfo["sharedAccount"] as? String else { return nil }
            keyHex = NotificationKeyStore.sharedKeys()[keyId(sharedAccount)]
        } else {
            guard let toAccount = userInfo["toAccount"] as? String else { return nil }
            keyHex = NotificationKeyStore.accountKeys()[keyId(toAccount)]
        }
        guard let keyHex = keyHex, let key = NanoBox.bytes(fromHex: keyHex),
              let text = NanoBox.open(message, senderAddress: fromAccount, recipientCurveSecretKey: key),
              !text.isEmpty else { return nil }

        if isGroup, let name = userInfo["fromAccountName"] as? String, !name.isEmpty {
            return "\(name): \(text)"
        }
        return text
    }

    /// Keys are indexed by the address without its ticker prefix (see addressKeyId in notificationKeys.ts).
    static func keyId(_ address: String) -> String {
        guard let underscore = address.lastIndex(of: "_") else { return address }
        return String(address[address.index(after: underscore)...])
    }
}

/// Read side of the keys written by the app's NotificationKeys plugin (MyViewController.swift).
/// Keep the constants in sync with it.
enum NotificationKeyStore {
    static let service = "com.nanchat.notification-keys"
    static let accessGroup = "group.com.nanchat.app"

    static func accountKeys() -> [String: String] { read("accounts") }
    static func sharedKeys() -> [String: String] { read("shared") }

    private static func read(_ account: String) -> [String: String] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { return [:] }
        return dict
    }
}
