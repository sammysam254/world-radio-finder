package com.wavebox.app;

import android.Manifest;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.BounceInterpolator;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

public class SplashActivity extends AppCompatActivity {

    private Handler handler = new Handler(Looper.getMainLooper());

    private final ActivityResultLauncher<String[]> permissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
            // Whether granted or denied, proceed to main app
            goToMain();
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        getWindow().setStatusBarColor(Color.parseColor("#0D0E17"));

        // Build splash layout
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#0D0E17"));
        root.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT));

        TextView logo = new TextView(this);
        logo.setText("📻");
        logo.setTextSize(96f);
        logo.setGravity(Gravity.CENTER);
        logo.setTranslationY(-1200f);
        logo.setAlpha(0f);

        TextView title = new TextView(this);
        title.setText("");
        title.setTextSize(38f);
        title.setTextColor(Color.parseColor("#F97316"));
        title.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        title.setGravity(Gravity.CENTER);
        title.setAlpha(0f);
        title.setLetterSpacing(0.15f);

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

        // Drop logo with bounce
        ObjectAnimator logoY = ObjectAnimator.ofFloat(logo, "translationY", -1200f, 0f);
        logoY.setDuration(900);
        logoY.setInterpolator(new BounceInterpolator());
        ObjectAnimator logoA = ObjectAnimator.ofFloat(logo, "alpha", 0f, 1f);
        logoA.setDuration(300);

        AnimatorSet drop = new AnimatorSet();
        drop.playTogether(logoY, logoA);
        drop.setStartDelay(200);
        drop.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                title.setAlpha(1f);
                revealText(title, "WAVEBOX", 0, () -> {
                    ObjectAnimator ta = ObjectAnimator.ofFloat(tagline, "alpha", 0f, 1f);
                    ObjectAnimator ty = ObjectAnimator.ofFloat(tagline, "translationY", 20f, 0f);
                    ta.setDuration(600); ty.setDuration(600);
                    AnimatorSet ts = new AnimatorSet();
                    ts.playTogether(ta, ty);
                    ts.start();
                    // After animation, request permissions then go to main
                    handler.postDelayed(() -> requestAppPermissions(), 800);
                });
            }
        });
        drop.start();
    }

    private void requestAppPermissions() {
        List<String> needed = new ArrayList<>();

        // Notification permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (needed.isEmpty()) {
            goToMain();
        } else {
            permissionLauncher.launch(needed.toArray(new String[0]));
        }
    }

    private void goToMain() {
        startActivity(new Intent(this, MainActivity.class));
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }

    private void revealText(TextView tv, String full, int index, Runnable onDone) {
        if (index > full.length()) {
            if (onDone != null) onDone.run();
            return;
        }
        tv.setText(full.substring(0, index));
        if (index > 0) {
            try {
                ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 28);
                tg.startTone(ToneGenerator.TONE_PROP_BEEP, 40);
                handler.postDelayed(tg::release, 60);
            } catch (Exception ignored) {}
        }
        handler.postDelayed(() -> revealText(tv, full, index + 1, onDone), 120);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
