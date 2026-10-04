package com.farfish.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;
import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class UpdateChecker {
    private static final String TAG = "UpdateChecker";
    
    // GitHub repository configuration
    // TODO: Update these values with your actual GitHub repository
    private static final String GITHUB_OWNER = "youruser"; // Change to your GitHub username
    private static final String GITHUB_REPO = "farfish";   // Change to your repository name
    private static final String GITHUB_API_URL = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/releases/latest";
    
    private Activity activity;
    private long downloadId = -1;
    private BroadcastReceiver downloadReceiver;

    public UpdateChecker(Activity activity) {
        this.activity = activity;
    }

    /**
     * Check for updates from GitHub Releases API
     */
    public void checkForUpdate() {
        new Thread(() -> {
            try {
                // Get current app version
                String currentVersion = getCurrentVersion();
                Log.d(TAG, "Current version: " + currentVersion);

                // Fetch latest release from GitHub
                URL url = new URL(GITHUB_API_URL);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestProperty("Accept", "application/json");

                int responseCode = connection.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();

                    // Parse JSON response
                    JSONObject release = new JSONObject(response.toString());
                    String latestVersion = release.getString("tag_name").replace("v", "");
                    String releaseName = release.getString("name");
                    String releaseNotes = release.optString("body", "New update available");
                    
                    // Get download URL for APK
                    String downloadUrl = null;
                    if (release.has("assets")) {
                        org.json.JSONArray assets = release.getJSONArray("assets");
                        for (int i = 0; i < assets.length(); i++) {
                            JSONObject asset = assets.getJSONObject(i);
                            String assetName = asset.getString("name");
                            if (assetName.endsWith(".apk")) {
                                downloadUrl = asset.getString("browser_download_url");
                                break;
                            }
                        }
                    }

                    Log.d(TAG, "Latest version: " + latestVersion);
                    Log.d(TAG, "Download URL: " + downloadUrl);

                    // Compare versions
                    if (isNewerVersion(currentVersion, latestVersion) && downloadUrl != null) {
                        final String finalDownloadUrl = downloadUrl;
                        final String finalReleaseName = releaseName;
                        final String finalReleaseNotes = releaseNotes;
                        
                        activity.runOnUiThread(() -> showUpdateDialog(finalReleaseName, finalReleaseNotes, finalDownloadUrl));
                    } else {
                        Log.d(TAG, "App is up to date");
                    }
                } else {
                    Log.e(TAG, "GitHub API request failed: " + responseCode);
                }
                connection.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error checking for updates", e);
            }
        }).start();
    }

    /**
     * Get current app version
     */
    private String getCurrentVersion() {
        try {
            PackageInfo pInfo = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return pInfo.versionName;
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "Could not get package info", e);
            return "1.0.0";
        }
    }

    /**
     * Compare version strings (semantic versioning)
     */
    private boolean isNewerVersion(String currentVersion, String latestVersion) {
        try {
            String[] current = currentVersion.split("\\.");
            String[] latest = latestVersion.split("\\.");
            
            int length = Math.max(current.length, latest.length);
            for (int i = 0; i < length; i++) {
                int currentPart = i < current.length ? Integer.parseInt(current[i]) : 0;
                int latestPart = i < latest.length ? Integer.parseInt(latest[i]) : 0;
                
                if (latestPart > currentPart) {
                    return true;
                } else if (latestPart < currentPart) {
                    return false;
                }
            }
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Error comparing versions", e);
            return false;
        }
    }

    /**
     * Show update dialog to user
     */
    private void showUpdateDialog(String title, String releaseNotes, String downloadUrl) {
        new AlertDialog.Builder(activity)
                .setTitle("Update Available")
                .setMessage(title + "\n\n" + releaseNotes + "\n\nWould you like to download and install the update?")
                .setPositiveButton("Update", (dialog, which) -> downloadAndInstallUpdate(downloadUrl))
                .setNegativeButton("Later", null)
                .setCancelable(true)
                .show();
    }

    /**
     * Download APK using DownloadManager
     */
    private void downloadAndInstallUpdate(String downloadUrl) {
        try {
            // Create download request
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(downloadUrl));
            request.setTitle("FarFISH Update");
            request.setDescription("Downloading latest version");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "FarFISH-update.apk");

            // Start download
            DownloadManager downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            downloadId = downloadManager.enqueue(request);

            // Register receiver for download completion
            downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id == downloadId) {
                        installUpdate(downloadManager);
                    }
                }
            };
            
            activity.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
            
        } catch (Exception e) {
            Log.e(TAG, "Error downloading update", e);
            activity.runOnUiThread(() -> 
                new AlertDialog.Builder(activity)
                    .setTitle("Download Failed")
                    .setMessage("Could not download update. Please try again later.")
                    .setPositiveButton("OK", null)
                    .show()
            );
        }
    }

    /**
     * Install downloaded APK
     */
    private void installUpdate(DownloadManager downloadManager) {
        try {
            // Query download status
            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(downloadId);
            Cursor cursor = downloadManager.query(query);
            
            if (cursor.moveToFirst()) {
                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int status = cursor.getInt(statusIndex);
                
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    int uriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                    String downloadedFilePath = cursor.getString(uriIndex);
                    
                    // Install APK
                    File file = new File(Uri.parse(downloadedFilePath).getPath());
                    Uri apkUri;
                    
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        apkUri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file);
                    } else {
                        apkUri = Uri.fromFile(file);
                    }
                    
                    Intent installIntent = new Intent(Intent.ACTION_VIEW);
                    installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                    installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    activity.startActivity(installIntent);
                } else {
                    Log.e(TAG, "Download failed with status: " + status);
                }
            }
            cursor.close();
            
            // Unregister receiver
            if (downloadReceiver != null) {
                activity.unregisterReceiver(downloadReceiver);
                downloadReceiver = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error installing update", e);
        }
    }

    /**
     * Clean up resources
     */
    public void cleanup() {
        try {
            if (downloadReceiver != null) {
                activity.unregisterReceiver(downloadReceiver);
                downloadReceiver = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error during cleanup", e);
        }
    }
}
