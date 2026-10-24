import Cocoa
import WebKit

// probe — load a URL at a given CSS size, run a JS expression, print JSON.
//   probe <url> <width> <height> <jsFile|-> [settleSeconds]
// Local QA harness for the site (overflow scans, a11y audit, click flows).

final class Delegate: NSObject, WKNavigationDelegate {
    var done = false
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) { done = true }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { done = true }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { done = true }
}

func spin(_ cond: @escaping () -> Bool, _ seconds: TimeInterval) {
    let deadline = Date().addingTimeInterval(seconds)
    while !cond() && Date() < deadline {
        RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.03))
    }
}

func jsonString(_ any: Any?) -> String {
    guard let any = any else { return "null" }
    if JSONSerialization.isValidJSONObject(any),
       let d = try? JSONSerialization.data(withJSONObject: any, options: [.withoutEscapingSlashes]) {
        return String(data: d, encoding: .utf8) ?? "encode-failed"
    }
    return String(describing: any)
}

let a = CommandLine.arguments
guard a.count >= 4, let url = URL(string: a[1]),
      let W = Int(a[2]), let H = Int(a[3]) else {
    FileHandle.standardError.write("usage: probe <url> <w> <h> <js|-> [settle]\n".data(using: .utf8)!)
    exit(2)
}
let jsFile = a[4]
let settle = a.count > 5 ? (Double(a[5]) ?? 1.2) : 1.2

_ = NSApplication.shared
NSApp.setActivationPolicy(.prohibited)

let cfg = WKWebViewConfiguration()
cfg.websiteDataStore = .nonPersistent()
let d = Delegate()
let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: W, height: H), configuration: cfg)
wv.navigationDelegate = d
wv.load(URLRequest(url: url))
spin({ d.done }, 25)
spin({ false }, settle)

if jsFile != "-" {
    let code = (try? String(contentsOfFile: jsFile, encoding: .utf8)) ?? "(()=>'no-js-file')()"
    var done = false
    var payload = "js-error"
    wv.callAsyncJavaScript("return (" + code + ")", arguments: [:], in: nil, in: .defaultClient) { result in
        switch result {
        case .success(let res): payload = jsonString(res)
        case .failure(let err): payload = "JSERR: \(err.localizedDescription)"
        }
        done = true
    }
    spin({ done }, 40)
    print(payload)
}
exit(0)
