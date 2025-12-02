# usage: python deploy_latest_version.py
# effect: downloads the installers for android, intel mac, apple silicon, windows, and linux from github actions
# note that installers take up to 5 mins to build following each push to github, so make sure the builds are ready before you run this
# 
# this version of the script assumes that the production website is hosted on netlify. if we change hosting companies (and we will), please update push_to_production() below as needed




import os
import json
import subprocess
import shutil
import zipfile
import sys

# Configuration
REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEBSITE_DIR = os.path.join(REPO_DIR, "vlix_website")
INSTALLERS_DIR = os.path.join(WEBSITE_DIR, "installers")
WORKFLOW_NAME = "Build Electron App"

def push_to_production():
    """Deploys the website to production server (public URL: vlix.ai)."""
    print("Deploying to production website on vlix.ai...")
    result = subprocess.run(
        ["netlify", "deploy", "--prod", "."],
        capture_output=True,
        text=True,
        check=True,
        cwd=WEBSITE_DIR
    )
    print(result.stdout)
def run_gh_command(args):
    """Runs a gh CLI command and returns the output."""
    try:
        result = subprocess.run(
            ["gh"] + args,
            capture_output=True,
            text=True,
            check=True,
            cwd=REPO_DIR
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running gh command: {e}")
        print(f"Stderr: {e.stderr}")
        sys.exit(1)

def get_latest_run_info():
    """Gets the ID and run number of the latest successful run for the workflow."""
    print(f"Finding latest successful run for '{WORKFLOW_NAME}'...")
    output = run_gh_command([
        "run", "list",
        "--workflow", "build.yml",
        "--status", "success",
        "--limit", "1",
        "--json", "databaseId,number"
    ])
    data = json.loads(output)
    if not data:
        print("No successful runs found.")
        sys.exit(1)
    return data[0]["databaseId"], data[0]["number"]

import tempfile

def download_artifacts(run_id, temp_dir):
    """Downloads all artifacts for the given run ID to a temp dir."""
    print(f"Downloading artifacts for run ID {run_id}...")
    run_gh_command([
        "run", "download", str(run_id),
        "--dir", temp_dir
    ])

def process_artifacts(run_number, source_dir):
    """Processes the downloaded artifacts from source_dir."""
    print(f"Processing artifacts for Build #{run_number}...")
    
    # Ensure installers dir exists
    if os.path.exists(INSTALLERS_DIR):
        shutil.rmtree(INSTALLERS_DIR)
    os.makedirs(INSTALLERS_DIR)

    version_data = {
        "build": run_number,
        "files": {}
    }

    # Helper to move and rename
    def move_and_track(src, dest_name, key):
        dest_path = os.path.join(INSTALLERS_DIR, dest_name)
        shutil.move(src, dest_path)
        # Store relative path for version.json
        version_data["files"][key] = f"installers/{dest_name}"
        print(f"Saved {dest_name}")

    for item in os.listdir(source_dir):
        item_path = os.path.join(source_dir, item)
        
        if not os.path.isdir(item_path):
            continue

        # 1. Windows: windows-latest-installer
        if item == "windows-latest-installer":
            print(f"Processing Windows artifact in {item}...")
            zip_name = f"Vlix-Build-{run_number}-Windows.zip"
            zip_path = os.path.join(INSTALLERS_DIR, zip_name)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(item_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, item_path)
                        zipf.write(file_path, arcname)
            
            version_data["files"]["windows"] = f"installers/{zip_name}"
            print(f"Created {zip_name}")

        # 2. Android: android-debug-apk
        elif item == "android-debug-apk":
            print(f"Processing Android artifact in {item}...")
            for root, dirs, files in os.walk(item_path):
                for file in files:
                    if file.endswith(".apk"):
                        src = os.path.join(root, file)
                        dest_name = f"Vlix-Build-{run_number}-Android.apk"
                        move_and_track(src, dest_name, "android")

        # 3. macOS: macos-latest-installer (Apple Silicon)
        elif item == "macos-latest-installer":
            print(f"Processing macOS (Apple Silicon) artifact in {item}...")
            for root, dirs, files in os.walk(item_path):
                for file in files:
                    if file.endswith(".dmg"):
                        src = os.path.join(root, file)
                        dest_name = f"Vlix-Build-{run_number}-macOS-AppleSilicon.dmg"
                        move_and_track(src, dest_name, "macos_arm64")

        # 4. macOS: macos-13-installer (Intel)
        elif item == "macos-13-installer":
            print(f"Processing macOS (Intel) artifact in {item}...")
            for root, dirs, files in os.walk(item_path):
                for file in files:
                    if file.endswith(".dmg"):
                        src = os.path.join(root, file)
                        dest_name = f"Vlix-Build-{run_number}-macOS-Intel.dmg"
                        move_and_track(src, dest_name, "macos_intel")

        # 5. Ubuntu: ubuntu-latest-installer
        elif item == "ubuntu-latest-installer":
            print(f"Processing Ubuntu artifact in {item}...")
            for root, dirs, files in os.walk(item_path):
                for file in files:
                    if file.endswith(".AppImage"):
                        src = os.path.join(root, file)
                        dest_name = f"Vlix-Build-{run_number}-Linux.AppImage"
                        move_and_track(src, dest_name, "linux")

    # Write version.json
    with open(os.path.join(WEBSITE_DIR, "version.json"), "w") as f:
        json.dump(version_data, f, indent=2)
    print("Generated version.json")

def main():
    if not shutil.which("gh"):
        print("Error: GitHub CLI (gh) is not installed or not in PATH.")
        sys.exit(1)

    # Ensure website dir exists
    os.makedirs(WEBSITE_DIR, exist_ok=True)

    run_id, run_number = get_latest_run_info()
    
    # Use a temporary directory for downloading artifacts
    with tempfile.TemporaryDirectory() as temp_dir:
        download_artifacts(run_id, temp_dir)
        process_artifacts(run_number, temp_dir)
    
    print("Site updated successfully. Ready to deploy.")
    if not shutil.which("netlify"):
        print("Netlify CLI is not installed, website has been updated locally.")
    else:
        push_to_production()


    print("Done! Latest builds are now available on https://vlix.ai")
if __name__ == "__main__":
    main()
