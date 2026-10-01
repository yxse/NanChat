import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView!.allowsBackForwardNavigationGestures = true
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SensitiveScreenPlugin())
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
