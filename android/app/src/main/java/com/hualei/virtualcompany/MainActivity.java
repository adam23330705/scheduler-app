package com.hualei.virtualcompany;

import android.os.Bundle;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // @capacitor/app 插件自动处理返回键（backButton事件）
        // 无需手动重写 onBackPressed 或 onKeyDown
        // 插件会在JS层触发 'backButton' 事件，由app.js统一处理
    }
}
