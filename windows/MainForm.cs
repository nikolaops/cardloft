using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Cardloft
{
    sealed class MainForm : Form
    {
        const string AppName = "Cardloft";
        const string AppHost = "app.cardloft";
        const string WebView2DownloadUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

        // Mirrors the Ctrl/Cmd+N "New Ticket" menu item of the macOS host.
        const string KeyboardShortcuts =
            "document.addEventListener('keydown', function (event) {" +
            "  if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'n') {" +
            "    event.preventDefault();" +
            "    if (window.cardloftNewTicket) window.cardloftNewTicket();" +
            "  }" +
            "});";

        static readonly string WorkspacePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), AppName, "workspace.json");

        static readonly string WebViewDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName, "WebView2");

        readonly WebView2 webView = new WebView2 { Dock = DockStyle.Fill };
        readonly JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

        public MainForm()
        {
            Text = AppName;
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = LogicalToDeviceUnits(new Size(980, 660));

            var preferred = LogicalToDeviceUnits(new Size(1380, 860));
            var workingArea = Screen.PrimaryScreen.WorkingArea;
            Size = new Size(
                Math.Min(preferred.Width, workingArea.Width * 9 / 10),
                Math.Min(preferred.Height, workingArea.Height * 9 / 10));

            Controls.Add(webView);
            Load += async (sender, args) => await InitializeWebViewAsync();
        }

        async Task InitializeWebViewAsync()
        {
            try
            {
                var environment = await CoreWebView2Environment.CreateAsync(null, WebViewDataPath);
                await webView.EnsureCoreWebView2Async(environment);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                var answer = MessageBox.Show(this,
                    "Cardloft needs the Microsoft Edge WebView2 Runtime, which is missing on this PC.\n\nOpen the download page now?",
                    AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Error);
                if (answer == DialogResult.Yes) OpenExternal(WebView2DownloadUrl);
                Close();
                return;
            }

            var resources = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resources");
            if (!File.Exists(Path.Combine(resources, "index.html")))
            {
                MessageBox.Show(this,
                    "The application resources are missing. Please reinstall the app.",
                    "Cardloft could not start", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }

            var core = webView.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDefaultScriptDialogsEnabled = false;
            core.ScriptDialogOpening += OnScriptDialogOpening;
            core.WebMessageReceived += OnWebMessageReceived;
            core.NavigationStarting += OnNavigationStarting;
            core.NewWindowRequested += (sender, args) =>
            {
                args.Handled = true;
                OpenExternal(args.Uri);
            };
            core.SetVirtualHostNameToFolderMapping(AppHost, resources, CoreWebView2HostResourceAccessKind.Deny);

            var bootstrap = KeyboardShortcuts;
            var savedWorkspace = SavedWorkspaceJson();
            if (savedWorkspace != null) bootstrap += "window.__CARDLOFT_DATA__ = " + savedWorkspace + ";";
            await core.AddScriptToExecuteOnDocumentCreatedAsync(bootstrap);

            core.Navigate("https://" + AppHost + "/index.html");
        }

        void OnScriptDialogOpening(object sender, CoreWebView2ScriptDialogOpeningEventArgs args)
        {
            // Show the dialog after the event returns so WebView2 is not blocked re-entrantly.
            var deferral = args.GetDeferral();
            BeginInvoke(new Action(() =>
            {
                using (deferral)
                {
                    if (args.Kind == CoreWebView2ScriptDialogKind.Confirm)
                    {
                        var answer = MessageBox.Show(this, args.Message, "Confirm deletion",
                            MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2);
                        if (answer == DialogResult.Yes) args.Accept();
                    }
                    else if (args.Kind == CoreWebView2ScriptDialogKind.Alert)
                    {
                        MessageBox.Show(this, args.Message, AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
                        args.Accept();
                    }
                }
            }));
        }

        void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            if (!IsAppUri(args.Source)) return;

            string json;
            try { json = args.TryGetWebMessageAsString(); }
            catch (ArgumentException) { return; }
            if (!IsValidJson(json)) return;

            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(WorkspacePath));
                var temporaryPath = WorkspacePath + ".tmp";
                File.WriteAllText(temporaryPath, json);
                if (File.Exists(WorkspacePath)) File.Replace(temporaryPath, WorkspacePath, null);
                else File.Move(temporaryPath, WorkspacePath);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }

        void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs args)
        {
            if (IsAppUri(args.Uri)) return;
            args.Cancel = true;
            OpenExternal(args.Uri);
        }

        string SavedWorkspaceJson()
        {
            try
            {
                if (!File.Exists(WorkspacePath)) return null;
                var workspace = serializer.DeserializeObject(File.ReadAllText(WorkspacePath));
                return workspace == null ? null : serializer.Serialize(workspace);
            }
            catch (Exception exception) when (exception is IOException || exception is ArgumentException ||
                                              exception is InvalidOperationException || exception is UnauthorizedAccessException)
            {
                return null;
            }
        }

        bool IsValidJson(string json)
        {
            try { return serializer.DeserializeObject(json) != null; }
            catch (ArgumentException) { return false; }
            catch (InvalidOperationException) { return false; }
        }

        static bool IsAppUri(string uri) =>
            Uri.TryCreate(uri, UriKind.Absolute, out var parsed) &&
            parsed.Scheme == Uri.UriSchemeHttps &&
            string.Equals(parsed.Host, AppHost, StringComparison.OrdinalIgnoreCase);

        static void OpenExternal(string uri)
        {
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed)) return;
            if (parsed.Scheme != Uri.UriSchemeHttps && parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeMailto) return;
            try { Process.Start(new ProcessStartInfo(parsed.AbsoluteUri) { UseShellExecute = true }); }
            catch (Exception) { }
        }
    }
}
