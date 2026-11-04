import Foundation
import UIKit
import SwiftUI
import NaturalLanguage
import Capacitor
#if canImport(Translation)
import Translation
#endif

// On-device translation with Apple's Translation framework (iOS 18+).
// Models are shared with the system Translate app and managed in iOS Settings.
//
// TranslationSession can only be obtained from the SwiftUI `.translationTask`
// modifier, so a 1x1 invisible SwiftUI view is attached to the bridge view
// controller and translation jobs are run through it one at a time.
@objc(AppleTranslationPlugin)
public class AppleTranslationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleTranslationPlugin"
    public let jsName = "AppleTranslation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSupportedLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        #if canImport(Translation)
        if #available(iOS 18.0, *) {
            call.resolve(["available": true])
            return
        }
        #endif
        call.resolve(["available": false])
    }

    @objc func getSupportedLanguages(_ call: CAPPluginCall) {
        #if canImport(Translation)
        if #available(iOS 18.0, *) {
            Task {
                let languages = await LanguageAvailability().supportedLanguages
                let codes = Set(languages.compactMap { $0.languageCode?.identifier })
                call.resolve(["languages": Array(codes).sorted()])
            }
            return
        }
        #endif
        call.resolve(["languages": []])
    }

    @objc func translate(_ call: CAPPluginCall) {
        #if canImport(Translation)
        if #available(iOS 18.0, *) {
            guard let text = call.getString("text"), !text.isEmpty,
                  let target = call.getString("targetLanguage") else {
                call.reject("text and targetLanguage are required")
                return
            }
            let interactive = call.getBool("interactive") ?? false
            Task { @MainActor in
                do {
                    let result = try await self.runTranslation(text: text, target: target, interactive: interactive)
                    call.resolve(["text": result as Any])
                } catch {
                    call.reject(error.localizedDescription, nil, error)
                }
            }
            return
        }
        #endif
        call.unavailable("Apple Translation requires iOS 18")
    }

    #if canImport(Translation)
    @available(iOS 18.0, *)
    @MainActor
    private func runTranslation(text: String, target: String, interactive: Bool) async throws -> String? {
        let recognizer = NLLanguageRecognizer()
        recognizer.processString(text)
        guard let detected = recognizer.dominantLanguage, detected != .undetermined else { return nil }

        let source = Locale.Language(identifier: detected.rawValue)
        // ML Kit-style codes from JS: "zh" means Simplified Chinese
        let targetLanguage = Locale.Language(identifier: target == "zh" ? "zh-Hans" : target)
        if source.languageCode == targetLanguage.languageCode { return nil }

        switch await LanguageAvailability().status(from: source, to: targetLanguage) {
        case .unsupported:
            return nil
        case .supported:
            // languages not downloaded yet: the system shows a download sheet,
            // only allowed when the user asked for the translation
            if !interactive { return nil }
        case .installed:
            break
        @unknown default:
            break
        }

        guard let host = TranslationHost.shared(attachingTo: bridge?.viewController) else {
            throw NSError(domain: "AppleTranslation", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "no view controller to host translation"])
        }
        return try await host.translate(text, from: source, to: targetLanguage)
    }
    #endif
}

#if canImport(Translation)
@available(iOS 18.0, *)
@MainActor
final class TranslationHost: ObservableObject {
    private static var instance: TranslationHost?

    struct Job {
        let text: String
        let source: Locale.Language
        let target: Locale.Language
        let continuation: CheckedContinuation<String, Error>
    }

    @Published var configuration: TranslationSession.Configuration?
    private var queue: [Job] = []
    private var running = false
    private var hostingController: UIHostingController<TranslationHostView>?

    static func shared(attachingTo parent: UIViewController?) -> TranslationHost? {
        if let instance { return instance }
        guard let parent else { return nil }
        let host = TranslationHost()
        let controller = UIHostingController(rootView: TranslationHostView(host: host))
        controller.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
        controller.view.backgroundColor = .clear
        controller.view.isUserInteractionEnabled = false
        parent.addChild(controller)
        parent.view.addSubview(controller.view)
        controller.didMove(toParent: parent)
        host.hostingController = controller
        instance = host
        return host
    }

    func translate(_ text: String, from source: Locale.Language, to target: Locale.Language) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            queue.append(Job(text: text, source: source, target: target, continuation: continuation))
            if !running { startNext() }
        }
    }

    // Points the SwiftUI task at the language pair of the next job
    private func startNext() {
        guard let job = queue.first else {
            running = false
            return
        }
        running = true
        if var config = configuration, config.source == job.source, config.target == job.target {
            config.invalidate() // same pair: re-run the task with a fresh session
            configuration = config
        } else {
            configuration = TranslationSession.Configuration(source: job.source, target: job.target)
        }
    }

    // Called by `.translationTask` with a session for the current configuration
    func run(session: TranslationSession) async {
        while let job = queue.first,
              job.source == configuration?.source,
              job.target == configuration?.target {
            queue.removeFirst()
            do {
                let response = try await session.translate(job.text)
                job.continuation.resume(returning: response.targetText)
            } catch {
                job.continuation.resume(throwing: error)
            }
        }
        // let SwiftUI finish this task before changing the configuration
        DispatchQueue.main.async { self.startNext() }
    }
}

@available(iOS 18.0, *)
struct TranslationHostView: View {
    @ObservedObject var host: TranslationHost

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .translationTask(host.configuration) { session in
                await host.run(session: session)
            }
    }
}
#endif
