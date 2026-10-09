package com.farfish.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.os.Handler;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Splash screen activity shown on app launch
 */
public class SplashActivity extends AppCompatActivity {

    private static final int SPLASH_DURATION = 1500; // 1.5 seconds

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        // Transition to MainActivity after delay with network check
        new Handler().postDelayed(() -> {
            if (isNetworkAvailable()) {
                startMainActivity();
            } else {
                showNoNetworkDialog();
            }
        }, SPLASH_DURATION);
    }

    private void startMainActivity() {
        Intent intent = new Intent(SplashActivity.this, MainActivity.class);
        startActivity(intent);
        finish();
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo networkInfo = cm.getActiveNetworkInfo();
        return networkInfo != null && networkInfo.isConnected();
    }

    private void showNoNetworkDialog() {
        new AlertDialog.Builder(this)
            .setTitle("No Internet Connection")
            .setMessage("FarFISH requires an internet connection. Please enable WiFi or mobile data.")
            .setPositiveButton("Retry", (dialog, which) -> {
                if (isNetworkAvailable()) {
                    startMainActivity();
                } else {
                    showNoNetworkDialog(); // Show again if still offline
                }
            })
            .setNegativeButton("Exit", (dialog, which) -> finish())
            .setCancelable(false)
            .show();
    }
}
