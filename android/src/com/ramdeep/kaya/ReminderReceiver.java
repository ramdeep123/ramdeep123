// KAYA — Copyright (c) 2026 Relies Production. All rights reserved.
package com.ramdeep.kaya;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Daily reminders. The web app hands over the next 7 days of reminders as JSON
 * (KayaNative.setReminders); this receiver shows each one at its time and arms
 * the next alarm. It also re-arms after the phone restarts.
 */
public class ReminderReceiver extends BroadcastReceiver {

    static final String PREFS = "kaya_reminders";
    static final String KEY = "plan";
    static final String CHANNEL = "kaya_daily";
    static final String ACTION_FIRE = "com.ramdeep.kaya.REMINDER";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (ACTION_FIRE.equals(action)) fireDue(ctx);
        scheduleNext(ctx);
    }

    /** Save a new plan (JSON array of {at, title, body}) and arm the first alarm. */
    static void save(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
        scheduleNext(ctx);
    }

    static JSONArray load(Context ctx) {
        try {
            return new JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** Show the most recent reminder that is due now, and drop everything already past. */
    static void fireDue(Context ctx) {
        long now = System.currentTimeMillis();
        JSONArray plan = load(ctx);
        JSONArray keep = new JSONArray();
        JSONObject due = null;
        for (int i = 0; i < plan.length(); i++) {
            JSONObject r = plan.optJSONObject(i);
            if (r == null) continue;
            long at = r.optLong("at");
            if (at <= now + 30000) {
                if (now - at < 3 * 3600 * 1000L) due = r; // skip anything more than 3 h stale
            } else {
                keep.put(r);
            }
        }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, keep.toString()).apply();
        if (due != null) notify(ctx, due.optString("title", "KAYA"), due.optString("body", ""), (int) (due.optLong("at") / 60000));
    }

    static void scheduleNext(Context ctx) {
        JSONArray plan = load(ctx);
        long now = System.currentTimeMillis();
        long next = Long.MAX_VALUE;
        for (int i = 0; i < plan.length(); i++) {
            JSONObject r = plan.optJSONObject(i);
            if (r != null && r.optLong("at") > now && r.optLong("at") < next) next = r.optLong("at");
        }
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = alarmIntent(ctx);
        am.cancel(pi);
        if (next != Long.MAX_VALUE) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
    }

    static PendingIntent alarmIntent(Context ctx) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_FIRE);
        return PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Creates the notification channel on Android 8+ (via reflection: built against API 23). */
    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            Class<?> chCls = Class.forName("android.app.NotificationChannel");
            Object ch = chCls.getConstructor(String.class, CharSequence.class, int.class)
                .newInstance(CHANNEL, "Daily coaching", 3 /* IMPORTANCE_DEFAULT */);
            chCls.getMethod("setDescription", String.class).invoke(ch, "Check-in, training and close-your-day reminders");
            NotificationManager.class.getMethod("createNotificationChannel", chCls).invoke(nm, ch);
        } catch (Exception ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    static void notify(Context ctx, String title, String body, int id) {
        ensureChannel(ctx);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                b = (Notification.Builder) Notification.Builder.class.getConstructor(Context.class, String.class).newInstance(ctx, CHANNEL);
            } catch (Exception e) {
                b = new Notification.Builder(ctx);
            }
        } else {
            b = new Notification.Builder(ctx).setPriority(Notification.PRIORITY_DEFAULT);
        }
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        b.setSmallIcon(R.drawable.ic_stat_kaya)
            .setColor(Color.parseColor("#FF6A2B"))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(content)
            .setAutoCancel(true);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            nm.notify(id, b.build());
        } catch (SecurityException ignored) {
            // notifications not permitted (Android 13+ permission denied)
        }
    }
}
