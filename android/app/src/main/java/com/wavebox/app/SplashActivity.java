package com.wavebox.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.BounceInterpolator;
import android.view.animation.DecelerateInterpolator;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {

    private Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Full screen immersive
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
        getWindow().setStatusBarColor(Color.parseColor("#0D0E17"));

        // Build layout programmatically
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#0D0E17"));
        root.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT));

        // Radio icon emoji as logo
        TextView logo = new TextView(this);
        logo.setText("📻");
        logo.setTextSize(96f);
        logo.setGravity(Gravity.CENTER);
        logo.setTranslationY(-1200f);
        logo.setAlpha(0f);

        // Wavebox text — will be revealed letter by letter
        TextView title = new TextView(this);
        title.setText("");
        title.setTextSize(38f);
        title.setTextColor(Color.parseColor("#F97316"));
        title.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        title.setGravity(Gravity.CENTER);
        title.setAlpha(0f);
        title.setLetterSpacing(0.15f);

        // Tagline
        TextView tagline = new TextView(this);
        tagline.setText("World Radio & TV");
        tagline.setTextSize(14f);
        tagline.setTextColor(Color.parseColor("#C084FC"));
        tagline.setGravity(Gravity.CENTER);
        tagline.setAlpha(0f);
        tagline.setTranslationY(20f);

        root.addView(logo);
        root.addView(title);
        root.addView(tagline);
        setContentView(root);

        // Step 1: logo falls from top with bounce
        ObjectAnimator logoY = ObjectAnimator.ofFloat(logo, "translationY", -1200f, 0f);
        logoY.setDuration(900);
        logoY.setInterpolator(new BounceInterpolator());

        ObjectAnimator logoAlpha = ObjectAnimator.ofFloat(logo, "alpha", 0f, 1f);
        logoAlpha.setDuration(300);

        AnimatorSet dropSet = new AnimatorSet();
        dropSet.playTogether(logoY, logoAlpha);
        dropSet.setStartDelay(200);

        dropSet.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                // Step 2: reveal title letter by letter with tick sound
                title.setAlpha(1f);
                revealText(title, "WAVEBOX", 0, () -> {
                    // Step 3: fade in tagline
                    ObjectAnimator tagAlpha = ObjectAnimator.ofFloat(tagline, "alpha", 0f, 1f);
                    ObjectAnimator tagY = ObjectAnimator.ofFloat(tagline, "translationY", 20f, 0f);
                    tagAlpha.setDuration(600);
                    tagY.setDuration(600);
                    AnimatorSet tagSet = new AnimatorSet();
                    tagSet.playTogether(tagAlpha, tagY);
                    tagSet.start();

                    // Step 4: launch main after delay
                    handler.postDelayed(() -> {
                        startActivity(new Intent(SplashActivity.this, MainActivity.class));
                        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
                        finish();
                    }, 900);
                });
            }
        });

        dropSet.start();
    }

    private void revealText(TextView tv, String fullText, int index, Runnable onDone) {
        if (index > fullText.length()) {
            if (onDone != null) onDone.run();
            return;
        }
        tv.setText(fullText.substring(0, index));
        // Tick sound
        if (index > 0) {
            try {
                ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 30);
                tg.startTone(ToneGenerator.TONE_PROP_BEEP, 40);
                handler.postDelayed(tg::release, 60);
            } catch (Exception ignored) {}
        }
        handler.postDelayed(() -> revealText(tv, fullText, index + 1, onDone), 120);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
