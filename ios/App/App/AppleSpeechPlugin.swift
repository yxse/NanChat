import Foundation
import AVFoundation
import Speech
import Capacitor

// On-device transcription of voice messages with Apple's speech recognition.
// Apple's recognizers need the language up front: it is detected with Whisper in JS
// (see services/transcription.service.ts), Whisper also transcribes the languages iOS can't.
//
// iOS 26+: SpeechAnalyzer + SpeechTranscriber (models managed by the system, downloaded on first use).
// Older: SFSpeechRecognizer, restricted to on-device recognition so audio never leaves the device.
// Audio comes from JS as base64 16 kHz mono 16-bit PCM and stays in memory (messages are end-to-end encrypted).
@objc(AppleSpeechPlugin)
public class AppleSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleSpeechPlugin"
    public let jsName = "AppleSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSupportedLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribe", returnType: CAPPluginReturnPromise),
    ]

    private static let sampleRate = 16000.0

    // language codes ("en", "fr", "zh"...) that can be transcribed on device
    @objc func getSupportedLanguages(_ call: CAPPluginCall) {
        Task {
            let codes = Set(await Self.supportedLocales().compactMap(Self.languageCode))
            call.resolve(["languages": Array(codes).sorted()])
        }
    }

    @objc func transcribe(_ call: CAPPluginCall) {
        guard let base64 = call.getString("audio"), let pcm = Data(base64Encoded: base64),
              let language = call.getString("language") else {
            call.reject("audio and language are required")
            return
        }
        Task {
            do {
                guard let locale = Self.locale(for: language, in: await Self.supportedLocales()) else {
                    call.reject("language not supported on device: \(language)")
                    return
                }
                guard let buffer = Self.makeBuffer(pcm) else {
                    call.reject("invalid audio")
                    return
                }
                let text: String
                #if compiler(>=6.2)
                if #available(iOS 26.0, *) {
                    text = try await Self.transcribeWithAnalyzer(buffer, locale: locale)
                } else {
                    text = try await Self.transcribeWithRecognizer(buffer, locale: locale)
                }
                #else
                text = try await Self.transcribeWithRecognizer(buffer, locale: locale)
                #endif
                call.resolve(["text": text])
            } catch {
                call.reject(error.localizedDescription, nil, error)
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Locales                                                             */
    /* ------------------------------------------------------------------ */

    private static func supportedLocales() async -> [Locale] {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            return await SpeechTranscriber.supportedLocales
        }
        #endif
        return SFSpeechRecognizer.supportedLocales().filter {
            SFSpeechRecognizer(locale: $0)?.supportsOnDeviceRecognition == true
        }
    }

    // A language has several locales (en-US, en-GB...): the user's own one first, then the current region
    private static func locale(for language: String, in locales: [Locale]) -> Locale? {
        let candidates = locales.filter { languageCode($0) == language }
        let normalize = { (id: String) in id.replacingOccurrences(of: "_", with: "-").lowercased() }
        for preferred in Locale.preferredLanguages {
            if let match = candidates.first(where: { normalize($0.identifier) == normalize(preferred) }) {
                return match
            }
        }
        if let region = regionCode(Locale.current),
           let match = candidates.first(where: { regionCode($0) == region }) {
            return match
        }
        return candidates.sorted { $0.identifier < $1.identifier }.first
    }

    private static func languageCode(_ locale: Locale) -> String? {
        if #available(iOS 16.0, *) { return locale.language.languageCode?.identifier }
        return locale.languageCode
    }

    private static func regionCode(_ locale: Locale) -> String? {
        if #available(iOS 16.0, *) { return locale.region?.identifier }
        return locale.regionCode
    }

    /* ------------------------------------------------------------------ */
    /* Audio                                                               */
    /* ------------------------------------------------------------------ */

    private static func makeBuffer(_ pcm: Data) -> AVAudioPCMBuffer? {
        let frames = pcm.count / 2
        guard frames > 0,
              let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)),
              let samples = buffer.floatChannelData?[0] else { return nil }
        pcm.withUnsafeBytes { raw in
            let ints = raw.bindMemory(to: Int16.self)
            for i in 0..<frames { samples[i] = Float(Int16(littleEndian: ints[i])) / 32768 }
        }
        buffer.frameLength = AVAudioFrameCount(frames)
        return buffer
    }

    private static func convert(_ buffer: AVAudioPCMBuffer, to format: AVAudioFormat) throws -> AVAudioPCMBuffer {
        if buffer.format == format { return buffer }
        guard let converter = AVAudioConverter(from: buffer.format, to: format) else {
            throw error("unsupported audio format")
        }
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * format.sampleRate / buffer.format.sampleRate) + 1024
        guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
            throw error("could not allocate audio")
        }
        var consumed = false
        var conversionError: NSError?
        let status = converter.convert(to: output, error: &conversionError) { _, inputStatus in
            if consumed {
                inputStatus.pointee = .endOfStream
                return nil
            }
            consumed = true
            inputStatus.pointee = .haveData
            return buffer
        }
        if status == .error { throw conversionError ?? error("audio conversion failed") }
        return output
    }

    private static func error(_ message: String) -> NSError {
        NSError(domain: "AppleSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    /* ------------------------------------------------------------------ */
    /* iOS 26+: SpeechAnalyzer                                             */
    /* ------------------------------------------------------------------ */

    #if compiler(>=6.2)
    @available(iOS 26.0, *)
    private static func transcribeWithAnalyzer(_ buffer: AVAudioPCMBuffer, locale: Locale) async throws -> String {
        let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [])
        // the language model is shared with the system and downloaded once
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await request.downloadAndInstall()
        }
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
        let input = try format.map { try convert(buffer, to: $0) } ?? buffer

        let results = Task {
            var text = ""
            for try await result in transcriber.results {
                text += String(result.text.characters)
            }
            return text
        }
        let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
        continuation.yield(AnalyzerInput(buffer: input))
        continuation.finish()
        do {
            try await analyzer.start(inputSequence: stream)
            try await analyzer.finalizeAndFinishThroughEndOfInput()
        } catch {
            results.cancel()
            throw error
        }
        return try await results.value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    #endif

    /* ------------------------------------------------------------------ */
    /* Older iOS: SFSpeechRecognizer (on device only)                      */
    /* ------------------------------------------------------------------ */

    private static func authorize() async -> Bool {
        if SFSpeechRecognizer.authorizationStatus() == .notDetermined {
            await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { _ in continuation.resume() }
            }
        }
        return SFSpeechRecognizer.authorizationStatus() == .authorized
    }

    private static func transcribeWithRecognizer(_ buffer: AVAudioPCMBuffer, locale: Locale) async throws -> String {
        guard await authorize() else { throw error("speech recognition not authorized") }
        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.supportsOnDeviceRecognition else {
            throw error("on-device recognition unavailable for \(locale.identifier)")
        }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true // never send the audio to Apple's servers
        request.shouldReportPartialResults = false
        if #available(iOS 16.0, *) { request.addsPunctuation = true }
        request.append(buffer)
        request.endAudio()

        return try await withCheckedThrowingContinuation { continuation in
            var finished = false
            var task: SFSpeechRecognitionTask?
            task = recognizer.recognitionTask(with: request) { result, error in
                if finished { return }
                if let error {
                    finished = true
                    continuation.resume(throwing: error)
                } else if let result, result.isFinal {
                    finished = true
                    continuation.resume(returning: result.bestTranscription.formattedString)
                }
                if finished { task = nil } // keeps the task alive until the result
            }
        }
    }
}
