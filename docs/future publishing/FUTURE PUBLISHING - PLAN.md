# Cloudflare CMS to Shared Hosting: Atomic Deployment Architecture

**Objective:** Enable a Payload CMS (running on Cloudflare Workers) to build a static Eleventy site and deploy it securely to standard Shared Hosting (PHP/Apache) using an "Atomic" strategy to prevent downtime.

---

## 1. High-Level Architecture

The system decouples the **CMS** (Data), the **Builder** (Compute), and the **Host** (Storage).

1.  **The Brain (Payload CMS / Cloudflare):** Manages content and scheduling. Triggers builds via Webhooks.
2.  **The Muscle (GitHub Actions):** Receives the trigger, runs `11ty build`, compresses the site into a ZIP, and pushes it to the host.
3.  **The Destination (Shared Host):** A PHP script receives the ZIP, unpacks it into a new folder, and atomically swaps the live site symlink.

---

## 2. Component 1: The Receiver (Shared Host)

**Goal:** Create a secure endpoint on the user's server to accept deployments.

### File: `deployer.php`
*Instructions:* Upload this file to the root of the hosting account (e.g., one level above `public_html` or inside the root folder if protected).

```php
<?php
// deployer.php
// SECURITY: Replace this with a long, random string
$SECRET_KEY = 'CHANGE_THIS_TO_A_SECURE_PASSWORD';

// 1. Security Check
if (!isset($_POST['secret']) || $_POST['secret'] !== $SECRET_KEY) {
    http_response_code(403);
    die('Forbidden: Invalid Key');
}

// 2. Configuration
$baseDir = __DIR__; 
$releasesDir = $baseDir . '/releases';
// The folder the web server actually serves (e.g., public_html or a subdomain folder)
$liveLink = $baseDir . '/public_html'; 

// 3. Create Releases Directory
if (!is_dir($releasesDir)) { mkdir($releasesDir, 0755, true); }

// 4. Handle File Upload
if (!isset($_FILES['bundle'])) { die('No file uploaded'); }

$releaseName = date('Ymd-His');
$targetDir = $releasesDir . '/' . $releaseName;
$zipPath = $releasesDir . '/' . $releaseName . '.zip';

if (!move_uploaded_file($_FILES['bundle']['tmp_name'], $zipPath)) {
    http_response_code(500);
    die('Failed to move uploaded file');
}

// 5. Unzip
$zip = new ZipArchive;
if ($zip->open($zipPath) === TRUE) {
    mkdir($targetDir);
    $zip->extractTo($targetDir);
    $zip->close();
    unlink($zipPath); // Cleanup zip
} else {
    http_response_code(500);
    die('Failed to unzip');
}

// 6. Atomic Symlink Swap
// If $liveLink is a real folder, back it up. If it's a symlink, remove it.
if (is_link($liveLink)) {
    unlink($liveLink);
} elseif (is_dir($liveLink)) {
    rename($liveLink, $liveLink . '_backup_' . time());
}
```
