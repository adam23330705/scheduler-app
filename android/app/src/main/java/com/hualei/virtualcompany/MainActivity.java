package com.hualei.virtualcompany;

import android.os.Bundle;
import android.webkit.WebView;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        // 不调用super（默认行为是退出APP）
        // 改为调用JS函数处理返回逻辑
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.post(() -> {
                webView.evaluateJavascript(
                    "if(typeof 处理返回键==='function'){处理返回键()}else{console.log('返回键处理函数未找到')}",
                    null
                );
            });
        }
    }
}
