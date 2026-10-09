package com.ramdeep.knowyourmind;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Know Your Mind's native shell. The app ships inside the APK (assets/www)
 * and is served from a private https origin, so it runs fully offline.
 *
 * Privacy: FLAG_SECURE blocks screenshots and hides the app's content in the
 * recent-apps screen; backups are off in the manifest; the WebView never
 * logs page content.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        setBars(false);

        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#F2ECE1"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        float scale = getResources().getConfiguration().fontScale;
        s.setTextZoom(Math.round(Math.max(85f, Math.min(130f, scale * 100f))));
        s.setUserAgentString(s.getUserAgentString() + " KnowYourMind/" + versionName());

        web.addJavascriptInterface(new Bridge(), "MindNative");
        web.setWebViewClient(new ShellClient());
        web.setWebChromeClient(new WebChromeClient()); // default dialogs for confirm()/prompt()

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    private void setBars(boolean dark) {
        int c = Color.parseColor(dark ? "#12141B" : "#F2ECE1");
        getWindow().setStatusBarColor(c);
        getWindow().setNavigationBarColor(c);
        if (Build.VERSION.SDK_INT >= 23) {
            int flags = dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26 && !dark) flags |= 0x00000010; // View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR (API 26)
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
        if (web != null) web.setBackgroundColor(c);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Hardware back closes screens inside the app before leaving it. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.MindBack && window.MindBack()) ? 'handled' : 'exit'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value == null || !value.contains("handled")) moveTaskToBack(true);
            }
        });
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "0.1.0";
        }
    }

    private void open(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        Intent i = scheme.equals("tel") ? new Intent(Intent.ACTION_DIAL, uri) : new Intent(Intent.ACTION_VIEW, uri);
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show();
        }
    }

    // ---------------------------------------------------------------- assets

    private static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("woff2", "font/woff2");
    }

    private WebResourceResponse serveAsset(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        if (path.contains("..")) return notFound();
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        try {
            InputStream in = getAssets().open("www" + path, AssetManager.ACCESS_STREAMING);
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Cache-Control", "no-cache");
            boolean text = mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("svg+xml");
            return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private class ShellClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (HOST.equals(uri.getHost())) return serveAsset(uri);
            return null; // the AI guide's own server, if configured
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            if (HOST.equals(uri.getHost())) return false;
            // crisis lines (tel:, sms:) and every outside link open in their own app
            open(uri);
            return true;
        }
    }

    // ---------------------------------------------------------------- JS bridge

    private class Bridge {
        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public void setDark(final boolean dark) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setBars(dark);
                }
            });
        }

        /** "Export my data": hands the JSON to the share sheet (Files, Drive, email…). */
        @JavascriptInterface
        public void shareFile(String name, String text, String mime) {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_SUBJECT, name);
            send.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(send, getString(R.string.share_export)));
        }

        @JavascriptInterface
        public void openUrl(String url) {
            open(Uri.parse(url));
        }

        @SuppressWarnings("deprecation")
        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) v.vibrate(Math.max(5, Math.min(400, ms)));
        }

        @JavascriptInterface
        public String version() {
            return versionName() + " (" + Build.VERSION.SDK_INT + ")";
        }
    }
}
