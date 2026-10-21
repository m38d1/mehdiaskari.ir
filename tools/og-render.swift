import Cocoa
import WebKit

// og-render — load an HTML card in a WKWebView at an exact CSS size and save
// a PNG of exactly that pixel size (used by tools/make-og.py).
//
//   swiftc -O tools/og-render.swift -o /tmp/og-render
//   /tmp/og-render <url> <width> <height> <out.png>
//
// The 1200x630 output is the Open Graph / Twitter card size. The card pages
// live under tools/og-cards/ and are served by the local http.server, so the
// site's own Vazirmatn woff2 files resolve and Persian shaping is rendered by
// the real WebKit text engine.

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

let args = CommandLine.arguments
guard args.count >= 5, let url = URL(string: args[1]),
      let W = Int(args[2]), let H = Int(args[3]) else {
    FileHandle.standardError.write("usage: og-render <url> <w> <h> <out.png>\n".data(using: .utf8)!)
    exit(2)
}
let out = args[4]

_ = NSApplication.shared
NSApp.setActivationPolicy(.prohibited)

let cfg = WKWebViewConfiguration()
cfg.websiteDataStore = .nonPersistent()
let d = Delegate()
let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: W, height: H), configuration: cfg)
wv.navigationDelegate = d
wv.load(URLRequest(url: url))
spin({ d.done }, 25)

// wait for webfonts, then freeze any transition so the capture is stable
var fonts = false
wv.evaluateJavaScript("""
  (function(){
    document.documentElement.style.setProperty('--settle','0');
    var st = document.createElement('style');
    st.textContent = '*{animation:none !important;transition:none !important}';
    document.head.appendChild(st);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function(){ document.documentElement.classList.add('fonts-ok'); });
    } else { document.documentElement.classList.add('fonts-ok'); }
  })(); 1
""") { _, _ in fonts = true }
spin({ fonts }, 5)
var ready = false
wv.evaluateJavaScript("document.documentElement.classList.contains('fonts-ok')") { res, _ in
    ready = (res as? Bool) ?? false
}
spin({ ready }, 10)
spin({ false }, 0.4)

var wrote = false
let sc = WKSnapshotConfiguration()
sc.rect = NSRect(x: 0, y: 0, width: W, height: H)
sc.snapshotWidth = NSNumber(value: W)
wv.takeSnapshot(with: sc) { img, err in
    if let img = img, let tiff = img.tiffRepresentation,
       let bmp = NSBitmapImageRep(data: tiff),
       let png = bmp.representation(using: .png, properties: [:]) {
        try? png.write(to: URL(fileURLWithPath: out))
        wrote = true
    } else {
        FileHandle.standardError.write("snapshot failed: \(String(describing: err))\n".data(using: .utf8)!)
    }
}
spin({ wrote }, 20)
exit(wrote ? 0 : 1)
