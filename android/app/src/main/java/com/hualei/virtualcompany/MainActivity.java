package com.hualei.virtualcompany;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.view.KeyEvent;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 13+ 手势导航返回拦截
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerCallback(
                getMainExecutor(),
                new android.window.OnBackInvokedCallback() {
                    @Override
                    public void invokeOnBackInvoked() {
                        // 调用JS处理返回逻辑，不调用super（不退出APP）
                        调用JS返回处理();
                    }
                }
            );
        }
    }

    /** 调用JS返回处理函数 */
    private void 调用JS返回处理() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.post(() ->
                webView.evaluateJavascript(
                    "if(typeof 处理返回键==='function'){处理返回键()} else { history.back(); }",
                    null
                )
            );
        }
    }

    /** Android 12及以下：物理/导航键返回 */
    @Override
    public void onBackPressed() {
        // 不调用super（默认行为是退出APP）
        // 改为调用JS函数处理返回逻辑
        调用JS返回处理();
    }

    /** 拦截键盘返回键 */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            调用JS返回处理();
            return true; // 已处理，不传播
        }
        return super.onKeyDown(keyCode, event);
    }
}
