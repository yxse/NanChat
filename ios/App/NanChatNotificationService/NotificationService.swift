import Foundation
import Security
import UserNotifications

// Decrypts chat message previews before iOS displays the notification, and shows the
// sender's profile picture (iOS 15+ communication notification).
//
// The server sends a visible push (`mutable-content: 1`) with a generic body ("New message")
// plus the encrypted message in the data payload. If the decryption key is available and the
// message decrypts, the body is replaced with the plaintext; otherwise the generic notification
// is shown untouched, so a notification is never lost.
class NotificationService: UNNotificationServiceExtension {
    private let lock = NSLock()
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            contentHandler(request.content)
            return
        }
        lock.lock()
        self.contentHandler = contentHandler
        bestAttemptContent = content
        lock.unlock()
        let userInfo = content.userInfo

        if let chatId = userInfo["chatId"] as? String, !chatId.isEmpty {
            content.threadIdentifier = chatId // group notifications per chat, as the app does
        }
        // sticker messages aren't encrypted: content is "Sticker" and stickerId the image URL
        let stickerUrl = MessagePreview.stickerUrl(userInfo: userInfo)
        if let preview = stickerUrl != nil ? MessagePreview.stickerBody(userInfo: userInfo) : MessagePreview.decrypt(userInfo: userInfo) {
            content.body = preview
        }

        // only chat messages have a sender to show (communication notification, iOS 15+)
        var avatarAccount: String?
        if #available(iOSApplicationExtension 15.0, *), userInfo["chatId"] is String {
            avatarAccount = userInfo["fromAccount"] as? String
        }

        // avatar and sticker are downloaded in parallel
        let group = DispatchGroup()
        let resultLock = NSLock()
        var avatar: Data?
        var sticker: UNNotificationAttachment?
        if let fromAccount = avatarAccount {
            group.enter()
            SenderAvatar.load(address: fromAccount, pictureUrl: userInfo["fromProfilePicture"] as? String) { data in
                resultLock.lock(); avatar = data; resultLock.unlock()
                group.leave()
            }
        }
        if let stickerUrl = stickerUrl {
            group.enter()
            SenderAvatar.stickerAttachment(stickerUrl) { attachment in
                resultLock.lock(); sticker = attachment; resultLock.unlock()
                group.leave()
            }
        }
        group.notify(queue: .global()) {
            resultLock.lock()
            let avatarData = avatar, stickerAttachment = sticker
            resultLock.unlock()
            if let stickerAttachment = stickerAttachment {
                self.lock.lock()
                content.attachments = [stickerAttachment]
                self.lock.unlock()
            }
            guard #available(iOSApplicationExtension 15.0, *), avatarAccount != nil else {
                self.deliver(content)
                return
            }
            CommunicationNotification.update(content, userInfo: userInfo, avatar: avatarData) { updated in
                self.deliver(Self.withAttachment(updated, stickerAttachment))
            }
        }
    }

    /// Makes sure the sticker survives the communication notification update.
    private static func withAttachment(_ content: UNNotificationContent, _ attachment: UNNotificationAttachment?) -> UNNotificationContent {
        guard let attachment = attachment, content.attachments.isEmpty,
              let copy = content.mutableCopy() as? UNMutableNotificationContent else { return content }
        copy.attachments = [attachment]
        return copy
    }

    override func serviceExtensionTimeWillExpire() {
        // Deliver whatever we have (decrypted body, no avatar at worst) before the system kills us.
        lock.lock()
        let content = bestAttemptContent
        lock.unlock()
        if let content = content { deliver(content) }
    }

    /// Calls the content handler at most once.
    private func deliver(_ content: UNNotificationContent) {
        lock.lock()
        let handler = contentHandler
        contentHandler = nil
        lock.unlock()
        handler?(content)
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

    /// Sticker messages aren't encrypted (content is "Sticker"): the image URL comes in `stickerId`.
    static func stickerUrl(userInfo: [AnyHashable: Any]) -> String? {
        guard let url = userInfo["stickerId"] as? String, url.hasPrefix("https://") else { return nil }
        return url
    }

    static func stickerBody(userInfo: [AnyHashable: Any]) -> String {
        if (userInfo["type"] as? String) == "group", let name = userInfo["fromAccountName"] as? String, !name.isEmpty {
            return "\(name): Sticker"
        }
        return "Sticker"
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
