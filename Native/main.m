#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate>
@property(strong) NSWindow *window;
@property(strong) WKWebView *webView;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    [self installMenu];

    NSURL *iconURL = [[NSBundle mainBundle] URLForResource:@"AppIcon" withExtension:@"png"];
    if (iconURL) {
        NSApp.applicationIconImage = [[NSImage alloc] initWithContentsOfURL:iconURL];
    }

    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    configuration.websiteDataStore = [WKWebsiteDataStore defaultDataStore];
    [configuration.userContentController addScriptMessageHandler:self name:@"storage"];

    NSString *savedWorkspace = [self savedWorkspaceJSON];
    if (savedWorkspace.length > 0) {
        NSString *bootstrap = [NSString stringWithFormat:@"window.__LOCAL_TICKETING_DATA__ = %@;", savedWorkspace];
        WKUserScript *script = [[WKUserScript alloc] initWithSource:bootstrap
                                                     injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                                  forMainFrameOnly:YES];
        [configuration.userContentController addUserScript:script];
    }

    self.webView = [[WKWebView alloc] initWithFrame:NSMakeRect(0, 0, 1280, 800)
                                      configuration:configuration];
    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;

    NSRect frame = NSMakeRect(0, 0, 1380, 860);
    NSWindowStyleMask style = NSWindowStyleMaskTitled |
                              NSWindowStyleMaskClosable |
                              NSWindowStyleMaskMiniaturizable |
                              NSWindowStyleMaskResizable;
    self.window = [[NSWindow alloc] initWithContentRect:frame
                                             styleMask:style
                                               backing:NSBackingStoreBuffered
                                                 defer:NO];
    self.window.title = @"Local Ticketing";
    self.window.titlebarAppearsTransparent = NO;
    self.window.movableByWindowBackground = YES;
    self.window.minSize = NSMakeSize(980, 660);
    self.window.contentView = self.webView;
    [self.window center];
    [self.window makeKeyAndOrderFront:nil];

    NSURL *indexURL = [[NSBundle mainBundle] URLForResource:@"index" withExtension:@"html"];
    NSURL *resourceURL = [[NSBundle mainBundle] resourceURL];
    if (indexURL && resourceURL) {
        [self.webView loadFileURL:indexURL allowingReadAccessToURL:resourceURL];
    } else {
        NSAlert *alert = [[NSAlert alloc] init];
        alert.messageText = @"Local Ticketing could not start";
        alert.informativeText = @"The application resources are missing. Please reinstall the app.";
        [alert runModal];
    }

    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)webView:(WKWebView *)webView
    runJavaScriptAlertPanelWithMessage:(NSString *)message
                      initiatedByFrame:(WKFrameInfo *)frame
                     completionHandler:(void (^)(void))completionHandler {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"Local Ticketing";
    alert.informativeText = message;
    [alert addButtonWithTitle:@"OK"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
        completionHandler();
    }];
}

- (void)webView:(WKWebView *)webView
    runJavaScriptConfirmPanelWithMessage:(NSString *)message
                        initiatedByFrame:(WKFrameInfo *)frame
                       completionHandler:(void (^)(BOOL result))completionHandler {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.alertStyle = NSAlertStyleWarning;
    alert.messageText = @"Confirm deletion";
    alert.informativeText = message;
    [alert addButtonWithTitle:@"Delete"];
    [alert addButtonWithTitle:@"Cancel"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
        completionHandler(response == NSAlertFirstButtonReturn);
    }];
}

- (void)userContentController:(WKUserContentController *)userContentController
      didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.name isEqualToString:@"storage"] || ![message.body isKindOfClass:[NSString class]]) {
        return;
    }

    NSString *json = (NSString *)message.body;
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    if (!data || ![NSJSONSerialization JSONObjectWithData:data options:0 error:nil]) {
        return;
    }

    NSURL *fileURL = [self workspaceFileURL];
    [[NSFileManager defaultManager] createDirectoryAtURL:[fileURL URLByDeletingLastPathComponent]
                             withIntermediateDirectories:YES
                                              attributes:nil
                                                   error:nil];
    [data writeToURL:fileURL options:NSDataWritingAtomic error:nil];
}

- (NSURL *)workspaceFileURL {
    NSURL *applicationSupport = [[[NSFileManager defaultManager]
        URLsForDirectory:NSApplicationSupportDirectory
               inDomains:NSUserDomainMask] firstObject];
    return [[applicationSupport URLByAppendingPathComponent:@"LocalTicketing" isDirectory:YES]
        URLByAppendingPathComponent:@"workspace.json"];
}

- (NSString *)savedWorkspaceJSON {
    NSData *data = [NSData dataWithContentsOfURL:[self workspaceFileURL]];
    if (!data) { return nil; }
    id object = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (!object) { return nil; }
    NSData *safeData = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
    return [[NSString alloc] initWithData:safeData encoding:NSUTF8StringEncoding];
}

- (void)newTicket:(id)sender {
    [self.webView evaluateJavaScript:@"window.ticketingNewTicket && window.ticketingNewTicket();"
                   completionHandler:nil];
}

- (void)reloadApp:(id)sender {
    [self.webView reload];
}

- (void)installMenu {
    NSMenu *menuBar = [[NSMenu alloc] init];

    NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
    NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"Local Ticketing"];
    [appMenu addItemWithTitle:@"About Local Ticketing" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Hide Local Ticketing" action:@selector(hide:) keyEquivalent:@"h"];
    [appMenu addItemWithTitle:@"Quit Local Ticketing" action:@selector(terminate:) keyEquivalent:@"q"];
    appMenuItem.submenu = appMenu;
    [menuBar addItem:appMenuItem];

    NSMenuItem *fileMenuItem = [[NSMenuItem alloc] init];
    NSMenu *fileMenu = [[NSMenu alloc] initWithTitle:@"File"];
    NSMenuItem *newItem = [[NSMenuItem alloc] initWithTitle:@"New Ticket"
                                                     action:@selector(newTicket:)
                                              keyEquivalent:@"n"];
    newItem.target = self;
    [fileMenu addItem:newItem];
    [fileMenu addItem:[NSMenuItem separatorItem]];
    [fileMenu addItemWithTitle:@"Close" action:@selector(performClose:) keyEquivalent:@"w"];
    fileMenuItem.submenu = fileMenu;
    [menuBar addItem:fileMenuItem];

    NSMenuItem *editMenuItem = [[NSMenuItem alloc] init];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Edit"];
    [editMenu addItemWithTitle:@"Undo" action:@selector(undo:) keyEquivalent:@"z"];
    [editMenu addItemWithTitle:@"Redo" action:@selector(redo:) keyEquivalent:@"Z"];
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"Cut" action:@selector(cut:) keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"Copy" action:@selector(copy:) keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"Paste" action:@selector(paste:) keyEquivalent:@"v"];
    [editMenu addItemWithTitle:@"Select All" action:@selector(selectAll:) keyEquivalent:@"a"];
    editMenuItem.submenu = editMenu;
    [menuBar addItem:editMenuItem];

    NSMenuItem *viewMenuItem = [[NSMenuItem alloc] init];
    NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"View"];
    NSMenuItem *reloadItem = [[NSMenuItem alloc] initWithTitle:@"Reload"
                                                        action:@selector(reloadApp:)
                                                 keyEquivalent:@"r"];
    reloadItem.target = self;
    [viewMenu addItem:reloadItem];
    viewMenuItem.submenu = viewMenu;
    [menuBar addItem:viewMenuItem];

    NSApp.mainMenu = menuBar;
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        application.delegate = delegate;
        application.activationPolicy = NSApplicationActivationPolicyRegular;
        [application run];
    }
    return 0;
}
