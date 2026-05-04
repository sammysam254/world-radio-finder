package com.wavebox.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

public class RadioService extends Service {

    public static final String CHANNEL_ID    = "wavebox_radio";
    public static final String ACTION_PREV   = "com.wavebox.app.PREV";
    public static final String ACTION_NEXT   = "com.wavebox.app.NEXT";
    public static final String ACTION_STOP   = "com.wavebox.app.STOP";
    public static final int    NOTIF_ID      = 1;

    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;
    private BroadcastReceiver controlReceiver;
    private String currentStation = "Radio";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
        setupMediaSession();
        registerControlReceiver();
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "Wavebox::RadioWakeLock");
        wakeLock.acquire(10 * 60 * 60 * 1000L); // 10 hours max
    }

    private void setupMediaSession() {
        mediaSession = new MediaSessionCompat(this, "WaveboxRadio");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { broadcastToWebView("play"); }
            @Override public void onPause() { broadcastToWebView("pause"); }
            @Override public void onStop() { stopSelf(); }
            @Override public void onSkipToNext() { broadcastToWebView("next"); }
            @Override public void onSkipToPrevious() { broadcastToWebView("prev"); }
        });

        updatePlaybackState(PlaybackStateCompat.STATE_PLAYING);
        updateMetadata(currentStation);
        mediaSession.setActive(true);
    }

    private void registerControlReceiver() {
        controlReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                String action = intent.getAction();
                if (action == null) return;
                switch (action) {
                    case ACTION_PREV: broadcastToWebView("prev"); break;
                    case ACTION_NEXT: broadcastToWebView("next"); break;
                    case ACTION_STOP:
                        stopForeground(true);
                        stopSelf();
                        break;
                    case "com.wavebox.app.UPDATE_STATION":
                        currentStation = intent.getStringExtra("station");
                        if (currentStation == null) currentStation = "Radio";
                        updateMetadata(currentStation);
                        updateNotification();
                        break;
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PREV);
        filter.addAction(ACTION_NEXT);
        filter.addAction(ACTION_STOP);
        filter.addAction("com.wavebox.app.UPDATE_STATION");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(controlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(controlReceiver, filter);
        }
    }

    private void broadcastToWebView(String action) {
        Intent i = new Intent("com.wavebox.app.WEBVIEW_CONTROL");
        i.putExtra("action", action);
        sendBroadcast(i);
    }

    private void updatePlaybackState(int state) {
        PlaybackStateCompat ps = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_STOP |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
            .build();
        mediaSession.setPlaybackState(ps);
    }

    private void updateMetadata(String station) {
        MediaMetadataCompat meta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, station)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Wavebox Radio & TV")
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Live Stream")
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, makeArtwork())
            .build();
        mediaSession.setMetadata(meta);
    }

    private Bitmap makeArtwork() {
        Bitmap bmp = Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        c.drawColor(Color.parseColor("#0D0E17"));
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.parseColor("#F97316"));
        p.setTextSize(120f);
        p.setTextAlign(Paint.Align.CENTER);
        c.drawText("📻", 128f, 168f, p);
        return bmp;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification());
        return START_STICKY; // restarts automatically if killed
    }

    private void updateNotification() {
        NotificationManager nm =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, buildNotification());
    }

    private Notification buildNotification() {
        // Open app on tap
        Intent openI = new Intent(this, MainActivity.class);
        openI.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, openI,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Prev
        PendingIntent prevPi = PendingIntent.getBroadcast(this, 1,
            new Intent(ACTION_PREV),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Stop
        PendingIntent stopPi = PendingIntent.getBroadcast(this, 2,
            new Intent(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Next
        PendingIntent nextPi = PendingIntent.getBroadcast(this, 3,
            new Intent(ACTION_NEXT),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentStation)
            .setContentText("Wavebox Radio & TV — Playing")
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(makeArtwork())
            .setContentIntent(openPi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPi)
            .addAction(android.R.drawable.ic_media_pause,    "Stop",     stopPi)
            .addAction(android.R.drawable.ic_media_next,     "Next",     nextPi)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (mediaSession != null) { mediaSession.setActive(false); mediaSession.release(); }
        try { unregisterReceiver(controlReceiver); } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Restart service if app is swiped away
        Intent restart = new Intent(getApplicationContext(), RadioService.class);
        restart.setPackage(getPackageName());
        startService(restart);
        super.onTaskRemoved(rootIntent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Wavebox Radio", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Radio playing in background");
            ch.setSound(null, null);
            ch.setShowBadge(false);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE))
                .createNotificationChannel(ch);
        }
    }
}
