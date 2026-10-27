package uz.opusmarket.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

/**
 * OPUS MARKET Android ilovasi: saytni to'liq ekranli WebView'da ochadi.
 * - Sayt havolalari ilova ichida, qolganlari (telefon, Telegram, to'lov tizimlari) tashqi ilovada ochiladi.
 * - "Orqaga" tugmasi avval saytdagi ochiq oynani (savat, mahsulot) yopadi, keyin sahifa tarixiga qaytadi.
 * - Internet bo'lmasa — ilova ichidagi "Internet yo'q" sahifasi.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://javohir877.github.io/OPUS-MARKET/";
    static final String HOST = "javohir877.github.io";
    static final String PATH = "/OPUS-MARKET";
    static final int FILE_REQ = 7;

    WebView web;
    ProgressBar bar;
    ValueCallback<Uri[]> fileCb;
    long backAt;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0c0708"));
        w.setNavigationBarColor(Color.parseColor("#0c0708"));

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0c0708"));
        web.setVisibility(View.INVISIBLE); // sahifa chizilguncha ochilish ekrani ko'rinib turadi
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#e10f2a")));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, dp(3));
        root.addView(bar, lp);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " OPUSApp/" + BuildInfo.VERSION);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return route(req.getUrl());
            }

            @Override
            public void onPageCommitVisible(WebView v, String url) {
                web.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                web.setVisibility(View.VISIBLE);
                bar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) {
                    v.loadUrl("file:///android_asset/offline.html");
                    web.setVisibility(View.VISIBLE);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                bar.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
                bar.setProgress(p);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQ);
                } catch (ActivityNotFoundException e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });

        // Fayl yuklab olish (masalan CSV) — brauzer orqali
        web.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String ua, String cd, String mime, long len) { openExternal(Uri.parse(url)); }
        });

        // Offline sahifadagi "Qayta urinish" tugmasi uchun
        web.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void retry() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (online()) web.loadUrl(HOME);
                        else Toast.makeText(MainActivity.this, "Internet hali yo'q", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }, "OPUSApp");

        if (state != null) web.restoreState(state);
        else open(getIntent());
    }

    void open(Intent i) {
        Uri u = i != null ? i.getData() : null;
        web.loadUrl(u != null && isOurs(u) ? u.toString() : HOME);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i.getData() != null) open(i);
    }

    boolean isOurs(Uri u) {
        String p = u.getPath();
        return "https".equals(u.getScheme()) && HOST.equals(u.getHost()) && p != null && p.startsWith(PATH);
    }

    /** true — WebView'da ochmaymiz (tashqi ilovaga beramiz) */
    boolean route(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        if (isOurs(u) || scheme.equals("file") || scheme.equals("about") || scheme.equals("data") || scheme.equals("blob")) return false;
        if (scheme.equals("intent")) {
            try {
                Intent it = Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME);
                startActivity(it);
            } catch (Exception e) {
                String fb = u.getQueryParameter("browser_fallback_url");
                if (fb != null) openExternal(Uri.parse(fb));
            }
            return true;
        }
        openExternal(u); // tel:, mailto:, tg:, t.me, click.uz, payme.uz va boshqa saytlar
        return true;
    }

    void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Bu havolani ochadigan ilova topilmadi", Toast.LENGTH_SHORT).show();
        }
    }

    boolean online() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo n = cm != null ? cm.getActiveNetworkInfo() : null;
        return n != null && n.isConnected();
    }

    @Override
    public void onBackPressed() {
        // Avval saytdagi ochiq oynani yopishga urinamiz (app.js: window.__opusBack)
        web.evaluateJavascript("(function(){try{return !!(window.__opusBack&&window.__opusBack())}catch(e){return false}})()", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String r) {
                if ("true".equals(r)) return;
                String url = web.getUrl();
                if (web.canGoBack() && url != null && !url.startsWith("file:")) { web.goBack(); return; }
                long now = System.currentTimeMillis();
                if (now - backAt < 2000) { finish(); return; }
                backAt = now;
                Toast.makeText(MainActivity.this, "Chiqish uchun yana bir marta bosing", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == FILE_REQ && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); CookieManager.getInstance().flush(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
