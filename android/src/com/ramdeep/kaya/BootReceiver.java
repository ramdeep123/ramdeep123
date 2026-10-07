// KAYA — Copyright (c) 2026 Relies Production. All rights reserved.
package com.ramdeep.kaya;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-arms the next reminder after a reboot or an app update. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || "android.intent.action.MY_PACKAGE_REPLACED".equals(a)) {
            ReminderReceiver.scheduleNext(ctx);
        }
    }
}
