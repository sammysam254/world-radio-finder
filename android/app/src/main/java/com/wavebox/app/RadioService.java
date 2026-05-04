package com.wavebox.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
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
    public static final String CHANNEL_ID = "wavebox_radio";
    public static final String ACTION_PREV = "com.wavebox.app.PREV";
    public static final String ACTION_NEXT = "com.wavebox.app.NEXT";
    public static final String ACTION_STOP = "com.wavebox.app.STOP";
    public static final int NOTIF_ID = 1;
    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Wavebox::WakeLock");
        wakeLock.acquire(12 * 60 * 60 * 1000L);
        mediaSession = new MediaSessionCompat(this, "WaveboxRadio");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onSkipToNext() { sendControl("next"); }
            @Override public void onSkipToPrevious() { sendControl("prev"); }
            @Override public void onStop() { stopSelf(); }
            @Override public void onPlay() { sendControl("play"); }
            @Override public void onPause() { sendControl("pause"); }
        });
        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_STOP)
            .setState(PlaybackStateCompat.STATE_PLAYING, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
            .build();
        mediaSession.setPlaybackState(state);
        MediaMetadataCompat meta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, "Wavebox Radio")
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Live Stream")
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, makeIcon())
            .build();
        mediaSession.setMetadata(meta);
        mediaSession.setActive(true);
        startForeground(NOTIF_ID, buildNotif());
    }

    private void sendControl(String action) {
        Intent i = new Intent("com.wavebox.app.WEBVIEW_CONTROL");
        i.putExtra("action", action);
        sendBroadcast(i);
    }

    private Bitmap makeIcon() {
        Bitmap b = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        c.drawColor(Color.parseColor("#0D0E17"));
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.parseColor("#F97316"));
        p.setTextSize(80f);
        p.setTextAlign(Paint.Align.CENTER);
        c.drawText("📻", 64f, 100f, p);
        return b;
    }

    private Notification buildNotif() {
        PendingIntent open = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent prev = PendingIntent.getBroadcast(this, 1,
            new Intent(ACTION_PREV).setPackage(getPackageName()),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getBroadcast(this, 2,
            new Intent(ACTION_STOP).setPackage(getPackageName()),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent next = PendingIntent.getBroadcast(this, 3,
            new Intent(ACTION_NEXT).setPackage(getPackageName()),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Wavebox Radio")
            .setContentText("Playing in background")
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(makeIcon())
            .setContentIntent(open)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_media_previous, "Prev", prev)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stop)
            .addAction(android.R.drawable.ic_media_next, "Next", next)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_PREV.equals(action)) { sendControl("prev"); }
            else if (ACTION_NEXT.equals(action)) { sendControl("next"); }
            else if (ACTION_STOP.equals(action)) { stopSelf(); return START_NOT_STICKY; }
        }
        return START_STICKY;
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onDestroy() {
        stopForeground(true);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (mediaSession != null) { mediaSession.setActive(false); mediaSession.release(); }
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Do NOT restart — notification disappears when app is closed
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Wavebox Radio", NotificationManager.IMPORTANCE_LOW);
            ch.setSound(null, null);
            ch.setShowBadge(false);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }
}
