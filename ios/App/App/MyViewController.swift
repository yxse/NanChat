import UIKit
import Capacitor
import Security

class MyViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView!.allowsBackForwardNavigationGestures = true
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SensitiveScreenPlugin())
        bridge?.registerPluginInstance(ScrollIndicatorInsetsPlugin())
        bridge?.registerPluginInstance(AppleTranslationPlugin())
        bridge?.registerPluginInstance(NotificationKeysPlugin())
    }
}

// Lists scrolling behind a translucent header: the native scroll indicator of an overflow element spans the whole
// element and css cannot inset it. WebKit backs each scrollable element with a UIScrollView inside the web view,
// this finds the one at the element's rect (css px == points) and insets its indicator below the header.
@objc(ScrollIndicatorInsetsPlugin)
public class ScrollIndicatorInsetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScrollIndicatorInsetsPlugin"
    public let jsName = "ScrollIndicatorInsets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTopInset", returnType: CAPPluginReturnPromise),
    ]

    @objc func setTopInset(_ call: CAPPluginCall) {
        guard let x = call.getDouble("x"), let y = call.getDouble("y"),
              let width = call.getDouble("width"), let height = call.getDouble("height"),
              let top = call.getDouble("top") else {
            call.reject("x, y, width, height and top are required")
            return
        }
        let rect = CGRect(x: x, y: y, width: width, height: height)
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.resolve(["found": false])
                return
            }
            var found = false
            // document coordinates on both sides (js adds window.scrollX/Y), so a scrolled page (keyboard) still matches
            let page = webView.scrollView
            for scrollView in Self.childScrollViews(of: page) {
                guard let superview = scrollView.superview else { continue }
                var frame = superview.convert(scrollView.frame, to: page)
                if page.zoomScale != 1 {
                    frame = frame.applying(CGAffineTransform(scaleX: 1 / page.zoomScale, y: 1 / page.zoomScale))
                }
                if Self.matches(frame, rect) {
                    // the list starts under the status bar: UIKit would add the safe area on top of `top`,
                    // which already includes it (the glass header pads itself by the safe area)
                    if scrollView.automaticallyAdjustsScrollIndicatorInsets {
                        scrollView.automaticallyAdjustsScrollIndicatorInsets = false
                    }
                    var insets = scrollView.verticalScrollIndicatorInsets
                    if insets.top != CGFloat(top) {
                        insets.top = CGFloat(top)
                        scrollView.verticalScrollIndicatorInsets = insets
                    }
                    found = true
                }
            }
            call.resolve(["found": found])
        }
    }

    // the UIScrollViews WebKit creates for the overflow elements (the page's own scroll view excluded)
    private static func childScrollViews(of root: UIView) -> [UIScrollView] {
        var result: [UIScrollView] = []
        var stack: [UIView] = root.subviews
        while let view = stack.popLast() {
            if let scrollView = view as? UIScrollView {
                result.append(scrollView)
            }
            stack.append(contentsOf: view.subviews)
        }
        return result
    }

    private static func matches(_ a: CGRect, _ b: CGRect) -> Bool {
        let tolerance: CGFloat = 1.5
        return abs(a.minX - b.minX) <= tolerance && abs(a.minY - b.minY) <= tolerance
            && abs(a.width - b.width) <= tolerance && abs(a.height - b.height) <= tolerance
    }
}

// iOS cannot block screenshots. While a secret is displayed we:
// - notify JS after a screenshot so the user can be warned to delete it from Photos,
// - notify JS when the screen is recorded/mirrored so the secret can be hidden.
@objc(SensitiveScreenPlugin)
public class SensitiveScreenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SensitiveScreenPlugin"
    public let jsName = "SensitiveScreen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
    ]

    private var activeCount = 0

    public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenshotTaken),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(captureChanged),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func enable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.activeCount += 1
            self.captureChanged()
            call.resolve()
        }
    }

    @objc func disable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.activeCount = max(0, self.activeCount - 1)
            call.resolve()
        }
    }

    @objc private func screenshotTaken() {
        if activeCount > 0 {
            notifyListeners("screenshotTaken", data: ["blocked": false])
        }
    }

    @objc private func captureChanged() {
        notifyListeners("captureChanged", data: ["captured": UIScreen.main.isCaptured])
    }
}

// Stores the keys the notification service extension (NanChatNotificationService) needs to
// decrypt message previews, in a keychain group shared with it.
// Only Curve25519 decryption keys are stored (derived one way from the account keys):
// they can read messages but cannot sign blocks, so they cannot move funds.
// Keep the constants in sync with NotificationKeyStore in NotificationService.swift.
@objc(NotificationKeysPlugin)
public class NotificationKeysPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NotificationKeysPlugin"
    public let jsName = "NotificationKeys"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAccountKeys", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addSharedKeys", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setConfig", returnType: CAPPluginReturnPromise),
    ]

    private static let service = "com.nanchat.notification-keys"
    private static let accessGroup = "group.com.nanchat.app"
    private static let queue = DispatchQueue(label: "com.nanchat.notification-keys")

    /// Replaces all account keys ({address: curve25519 secret key hex}).
    @objc func setAccountKeys(_ call: CAPPluginCall) {
        let keys = Self.stringDict(call.getObject("keys"))
        Self.queue.async {
            let status = Self.write("accounts", keys)
            status == errSecSuccess ? call.resolve() : call.reject("keychain error \(status)")
        }
    }

    /// Merges group chat keys ({sharedAccount: curve25519 secret key hex}).
    @objc func addSharedKeys(_ call: CAPPluginCall) {
        let keys = Self.stringDict(call.getObject("keys"))
        Self.queue.async {
            var merged = Self.read("shared")
            merged.merge(keys) { _, new in new }
            let status = Self.write("shared", merged)
            status == errSecSuccess ? call.resolve() : call.reject("keychain error \(status)")
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        Self.queue.async {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: Self.service,
                kSecAttrAccessGroup as String: Self.accessGroup,
            ]
            let status = SecItemDelete(query as CFDictionary)
            Self.clearAvatarCache()
            status == errSecSuccess || status == errSecItemNotFound ? call.resolve() : call.reject("keychain error \(status)")
        }
    }

    /// Settings read by the extension (backend used to look up sender profile pictures).
    @objc func setConfig(_ call: CAPPluginCall) {
        if let backendUrl = call.getString("backendUrl"), !backendUrl.isEmpty {
            UserDefaults(suiteName: Self.accessGroup)?.set(backendUrl, forKey: "backendUrl")
        }
        call.resolve()
    }

    /// Profile pictures cached by the extension (see SenderAvatar.swift).
    private static func clearAvatarCache() {
        if let defaults = UserDefaults(suiteName: accessGroup) {
            for key in defaults.dictionaryRepresentation().keys where key.hasPrefix("avatar.") {
                defaults.removeObject(forKey: key)
            }
        }
        if let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: accessGroup)?
            .appendingPathComponent("Library/Caches/NotificationAvatars", isDirectory: true) {
            try? FileManager.default.removeItem(at: dir)
        }
    }

    private static func stringDict(_ object: JSObject?) -> [String: String] {
        var out: [String: String] = [:]
        object?.forEach { key, value in
            if let value = value as? String { out[key] = value }
        }
        return out
    }

    private static func baseQuery(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }

    private static func read(_ account: String) -> [String: String] {
        var query = baseQuery(account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { return [:] }
        return dict
    }

    private static func write(_ account: String, _ keys: [String: String]) -> OSStatus {
        SecItemDelete(baseQuery(account) as CFDictionary)
        if keys.isEmpty { return errSecSuccess }
        guard let data = try? JSONSerialization.data(withJSONObject: keys) else { return errSecParam }
        var query = baseQuery(account)
        query[kSecValueData as String] = data
        // readable by the extension while the device is locked (after the first unlock since boot),
        // never synced to iCloud or restored to another device
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(query as CFDictionary, nil)
    }
}
