package com.wavebox.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

public class RadioService extends Service {

    public static final String CHANNEL_ID = "wavebox_radio";
    public static final String ACTION_STOP = "com.wavebox.app.STOP";
    public static final int NOTIF_ID = 1;

    private MediaSessionCompat mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(this, "WaveboxRadio");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY |
                        PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_STOP |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
            .setState(PlaybackStateCompat.STATE_PLAYING, 0, 1f)
            .build();
        mediaSession.setPlaybackState(state);
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIF_ID, buildNotification());
        return START_STICKY;
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stopIntent = new Intent(this, RadioService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Wavebox")
            .setContentText("Radio playing in background")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openPending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_media_previous, "Prev",
                getPrevPending())
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopPending)
            .addAction(android.R.drawable.ic_media_next, "Next",
                getNextPending())
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private PendingIntent getPrevPending() {
        Intent i = new Intent(this, MainActivity.class);
        i.setAction("com.wavebox.app.PREV");
        return PendingIntent.getActivity(this, 1, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent getNextPending() {
        Intent i = new Intent(this, MainActivity.class);
        i.setAction("com.wavebox.app.NEXT");
        return PendingIntent.getActivity(this, 2, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Wavebox Radio", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Radio playing in background");
            channel.setSound(null, null);
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        if (mediaSession != null) mediaSession.release();
        super.onDestroy();
    }
}
