// KAYA — Copyright (c) 2026 Relies Production. All rights reserved.
package com.ramdeep.kaya;

import android.Manifest;
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
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
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
import java.util.Locale;
import java.util.Map;

/**
 * KAYA's native shell. The app UI ships inside the APK (assets/www) and is
 * served from a private https origin so ES modules, WebAssembly and the camera
 * all work exactly like a secure website — fully offline.
 */
public class MainActivity extends Activity {

    private static final String TAG = "KAYA";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_CAMERA = 41;
    private static final int REQ_FILE = 42;
    private static final int REQ_NOTIFY = 43;

    private WebView web;
    private PermissionRequest pendingPermission;
    private ValueCallback<Uri[]> fileCallback;
    private TextToSpeech tts;
    private boolean ttsReady;
    private int utterance;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#0C0A12"));
        getWindow().setNavigationBarColor(Color.parseColor("#0C0A12"));

        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0C0A12"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        float scale = getResources().getConfiguration().fontScale;
        s.setTextZoom(Math.round(Math.max(85f, Math.min(115f, scale * 100f))));
        s.setUserAgentString(s.getUserAgentString() + " KAYA/" + versionName());

        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status != TextToSpeech.SUCCESS) return;
                int r = tts.setLanguage(new Locale("en", "IN"));
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.US);
                ttsReady = true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "KayaNative");
        web.setWebViewClient(new ShellClient());
        web.setWebChromeClient(new ShellChrome());

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
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
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Hardware back closes sheets and screens inside the app before exiting. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.KayaBack && window.KayaBack()) ? 'handled' : 'exit'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value == null || !value.contains("handled")) {
                    moveTaskToBack(true);
                }
            }
        });
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "1.0.0";
        }
    }

    // ---------------------------------------------------------------- assets

    private static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("woff2", "font/woff2");
        MIME.put("wasm", "application/wasm");
        MIME.put("task", "application/octet-stream");
        MIME.put("mp3", "audio/mpeg");
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
            headers.put("Access-Control-Allow-Origin", "*");
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
            return null;
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme();
            if (HOST.equals(uri.getHost())) return false;
            if (scheme.equals("https") && uri.getHost() != null && uri.getHost().endsWith("razorpay.com")) return false;
            try {
                if (scheme.equals("intent")) {
                    Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    try {
                        startActivity(intent);
                    } catch (ActivityNotFoundException e) {
                        String fallback = intent.getStringExtra("browser_fallback_url");
                        if (fallback != null) view.loadUrl(fallback);
                    }
                    return true;
                }
                // UPI apps, mail, phone and every other site open outside the app
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "No app found to open this link", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
    }

    // ---------------------------------------------------------------- camera & files

    private class ShellChrome extends WebChromeClient {
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    boolean wantsCamera = false;
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                    }
                    if (!wantsCamera || !HOST.equals(request.getOrigin().getHost())) {
                        request.deny();
                        return;
                    }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingPermission = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                }
            });
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                startActivityForResult(params.createIntent(), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.d(TAG, m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
            return true;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_NOTIFY) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            web.evaluateJavascript("window.KayaNotifyResult && window.KayaNotifyResult(" + ok + ")", null);
            return;
        }
        if (requestCode != REQ_CAMERA || pendingPermission == null) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            pendingPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingPermission.deny();
            Toast.makeText(this, R.string.camera_needed, Toast.LENGTH_LONG).show();
        }
        pendingPermission = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
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
        public void share(String title, String text) {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_SUBJECT, title);
            send.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(send, getString(R.string.share_backup)));
        }

        @JavascriptInterface
        public void openUrl(String url) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException e) {
                Log.w(TAG, "No activity for " + url);
            }
        }

        /** Native text-to-speech: Android WebView has no speechSynthesis. */
        @JavascriptInterface
        public void speak(String text, boolean urgent, float rate) {
            if (!ttsReady || tts == null || text == null) return;
            tts.setSpeechRate(Math.max(0.5f, Math.min(1.6f, rate)));
            tts.speak(text, urgent ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, "kaya" + (utterance++));
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (tts != null) tts.stop();
        }

        @JavascriptInterface
        public boolean canSpeak() {
            return ttsReady;
        }

        @SuppressWarnings("deprecation")
        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) v.vibrate(Math.max(5, Math.min(1000, ms)));
        }

        /** Next 7 days of reminders as JSON [{at, title, body}] — shown even when the app is closed. */
        @JavascriptInterface
        public void setReminders(String json) {
            ReminderReceiver.save(MainActivity.this, json == null ? "[]" : json);
        }

        @JavascriptInterface
        public void testReminder(String title, String body) {
            ReminderReceiver.notify(MainActivity.this, title, body, 4242);
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            if (Build.VERSION.SDK_INT >= 33) {
                return checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }

        @JavascriptInterface
        public void requestNotifications() {
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIFY);
                    }
                });
            }
        }

        @JavascriptInterface
        public String version() {
            return versionName() + " (" + Build.VERSION.SDK_INT + ")";
        }
    }
}
