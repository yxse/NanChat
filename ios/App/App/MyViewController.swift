import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView!.allowsBackForwardNavigationGestures = true
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SensitiveScreenPlugin())
        bridge?.registerPluginInstance(ScrollIndicatorInsetsPlugin())
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
