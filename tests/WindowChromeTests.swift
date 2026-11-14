import AppKit
import WebKit

private final class WindowDragSpy: EditorWindow {
  var receivedDrag: NSEvent?
  override func performDrag(with event: NSEvent) { receivedDrag = event }
}

func runWindowChromeTests() throws {
  try exerciseWindowChrome(allowsGlass: true)
  try exerciseWindowChrome(allowsGlass: false)
}

private func exerciseWindowChrome(allowsGlass: Bool) throws {
  _ = NSApplication.shared
  let window = WindowDragSpy(
    contentRect: NSRect(x: 0, y: 0, width: 900, height: 640),
    styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
    backing: .buffered, defer: false)
  window.isReleasedWhenClosed = false
  window.titleVisibility = .hidden
  window.titlebarAppearsTransparent = true
  let webView = WKWebView(frame: window.contentView!.bounds)
  window.setEditorWebView(webView, allowsGlass: allowsGlass)
  defer { window.close() }

  func event(_ point: NSPoint, type: NSEvent.EventType = .leftMouseDown) -> NSEvent {
    NSEvent.mouseEvent(with: type, location: webView.convert(point, to: nil),
      modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
      windowNumber: window.windowNumber, context: nil, eventNumber: 1,
      clickCount: 1, pressure: 1)!
  }
  func expect(_ condition: Bool, _ name: String) throws {
    guard condition else { throw NativeFailure("FAIL: " + name) }
    print("PASS: " + name)
  }
  try expect(!window.isOpaque && webView.value(forKey: "drawsBackground") as? Bool == false,
    "native chrome keeps the web view and window background transparent")
  if #available(macOS 26.0, *), allowsGlass {
    guard let glass = window.contentView as? NSGlassEffectView else { throw NativeFailure("Missing native glass container") }
    try expect(glass.contentView === webView && glass.style == .regular && window.workspaceMaterial == "macos-glass",
      "macOS 26 embeds the actual web view inside regular native glass")
  } else {
    guard let effect = window.contentView as? NSVisualEffectView else { throw NativeFailure("Missing legacy material container") }
    try expect(effect.subviews.contains(webView) && effect.material == .underWindowBackground && effect.blendingMode == .behindWindow && window.workspaceMaterial == "macos",
      "older macOS retains the behind-window material fallback")
  }
  for size in [NSSize(width: 900, height: 640), NSSize(width: 660, height: 500), NSSize(width: 1380, height: 960)] {
    window.setContentSize(size)
    try expect(webView.frame.size == window.contentView!.bounds.size,
      "web content follows native material resizing: \(size)")
    for x in [CGFloat(100), webView.bounds.midX, webView.bounds.maxX - 10] {
      try expect(window.startsTitleBarDrag(event(NSPoint(x: x, y: 14))), "title and blank title bar start native dragging: \(x), \(size)")
    }
    for point in [NSPoint(x: 150, y: 45), NSPoint(x: size.width / 2, y: 120), NSPoint(x: 30, y: size.height - 20), NSPoint(x: 2, y: 14), NSPoint(x: 100, y: 2)] {
      try expect(!window.startsTitleBarDrag(event(point)), "document, controls and resize edges do not start window dragging: \(point), \(size)")
    }
  }
  for type in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] {
    let button = window.standardWindowButton(type)!
    let point = webView.convert(NSPoint(x: button.bounds.midX, y: button.bounds.midY), from: button)
    try expect(!window.startsTitleBarDrag(event(point)), "macOS window button remains interactive: \(type.rawValue)")
  }
  try expect(!window.startsTitleBarDrag(event(NSPoint(x: 450, y: 14), type: .rightMouseDown)), "right-click does not start window dragging")
  let mouseDown = event(NSPoint(x: 450, y: 14))
  window.sendEvent(mouseDown)
  try expect(window.receivedDrag === mouseDown, "window dispatch forwards the original title-bar mouse event to AppKit dragging")
}
