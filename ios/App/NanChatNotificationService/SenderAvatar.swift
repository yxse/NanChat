import CryptoKit
import Foundation
import Intents
import UIKit
import UserNotifications

/// Loads a sender's profile picture for a notification.
///
/// Picture URL: `fromProfilePicture` in the push if the server sends it, otherwise the public
/// `GET /account` endpoint (the same one the app uses), cached for a day. The image is fetched
/// through the image proxy as a small PNG and cached on disk in the App Group container.
enum SenderAvatar {
    static let appGroup = "group.com.nanchat.app"
    static let defaultBackendUrl = "https://api.nanchat.com"
    private static let urlCacheTTL: TimeInterval = 24 * 60 * 60
    private static let size = 192

    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    static var cacheDirectory: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("Library/Caches/NotificationAvatars", isDirectory: true)
    }

    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 12
        return URLSession(configuration: config)
    }()

    static func load(address: String, pictureUrl: String?, completion: @escaping (Data?) -> Void) {
        if let pictureUrl = pictureUrl, !pictureUrl.isEmpty {
            image(for: pictureUrl, completion: completion)
            return
        }
        let id = MessagePreview.keyId(address)
        let urlKey = "avatar.\(id)"
        let timeKey = "avatar.\(id).ts"
        if let cached = defaults?.string(forKey: urlKey),
           let time = defaults?.object(forKey: timeKey) as? Double,
           Date().timeIntervalSince1970 - time < urlCacheTTL {
            cached.isEmpty ? completion(nil) : image(for: cached, completion: completion)
            return
        }
        let backend = defaults?.string(forKey: "backendUrl") ?? defaultBackendUrl
        guard let url = URL(string: "\(backend)/account?account=nano_\(id)") else {
            completion(nil)
            return
        }
        session.dataTask(with: url) { data, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode
            var picture = ""
            if status == 200, let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                picture = (json["profilePicture"] as? [String: Any])?["url"] as? String ?? ""
            } else if status != 404 { // 404 = unknown account, i.e. no picture
                completion(nil) // network/server error: don't cache, try again next time
                return
            }
            defaults?.set(picture, forKey: urlKey) // "" = no picture, so we don't ask again for a day
            defaults?.set(Date().timeIntervalSince1970, forKey: timeKey)
            picture.isEmpty ? completion(nil) : image(for: picture, completion: completion)
        }.resume()
    }

    private static func image(for source: String, completion: @escaping (Data?) -> Void) {
        let digest = SHA256.hash(data: Data(source.utf8)).map { String(format: "%02x", $0) }.joined()
        let file = cacheDirectory?.appendingPathComponent("\(digest).png")
        if let file = file, let data = try? Data(contentsOf: file) {
            completion(data)
            return
        }
        guard let url = proxiedUrl(source) else {
            completion(nil)
            return
        }
        session.dataTask(with: url) { data, response, _ in
            guard let data = data, (response as? HTTPURLResponse)?.statusCode == 200,
                  UIImage(data: data) != nil else {
                completion(nil)
                return
            }
            if let file = file {
                try? FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
                try? data.write(to: file, options: .atomic)
            }
            completion(data)
        }.resume()
    }

    /// Same proxy as ProfilePicture.tsx, resized and converted to PNG (INImage can't decode webp/gif reliably).
    private static func proxiedUrl(_ source: String) -> URL? {
        // equivalent of JS encodeURI
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: ";,/?:@&=+$-_.!~*'()#")
        guard let encoded = source.addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
        return URL(string: "https://i.nanwallet.com/unsafe/rs::\(size)/plain/\(encoded)@png")
    }
}

/// iOS 15+ communication notification: shows the sender's avatar like a messaging app.
/// Requires the Communication Notifications capability on the app target and
/// INSendMessageIntent in the extension's IntentsSupported / the app's NSUserActivityTypes.
@available(iOSApplicationExtension 15.0, *)
enum CommunicationNotification {
    static func update(_ content: UNMutableNotificationContent, userInfo: [AnyHashable: Any],
                       avatar: Data?, completion: @escaping (UNNotificationContent) -> Void) {
        guard let fromAccount = userInfo["fromAccount"] as? String else {
            completion(content)
            return
        }
        let isGroup = (userInfo["type"] as? String) == "group"
        let chatId = userInfo["chatId"] as? String
        let senderName = (userInfo["fromAccountName"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? content.title

        let sender = INPerson(
            personHandle: INPersonHandle(value: fromAccount, type: .unknown),
            nameComponents: nil,
            displayName: senderName,
            image: avatar.map { INImage(imageData: $0) },
            contactIdentifier: nil,
            customIdentifier: fromAccount
        )
        var recipients: [INPerson]?
        if isGroup {
            // iOS treats the conversation as a group when there is more than one recipient
            let me = INPerson(
                personHandle: INPersonHandle(value: userInfo["toAccount"] as? String ?? "me", type: .unknown),
                nameComponents: nil, displayName: nil, image: nil, contactIdentifier: nil,
                customIdentifier: nil, isMe: true
            )
            recipients = [me, sender]
        }
        let intent = INSendMessageIntent(
            recipients: recipients,
            outgoingMessageType: .outgoingMessageText,
            content: content.body,
            speakableGroupName: isGroup && !content.title.isEmpty ? INSpeakableString(spokenPhrase: content.title) : nil,
            conversationIdentifier: chatId,
            serviceName: nil,
            sender: sender,
            attachments: nil
        )
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate { _ in
            // keeps the original content (decrypted body included) if iOS refuses the update,
            // e.g. when the capability is missing
            let updated = (try? content.updating(from: intent)) ?? content
            completion(updated)
        }
    }
}
