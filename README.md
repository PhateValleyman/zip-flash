# ZIP Flash (fork of Magic Flash)

Version: 1.7



Flash recovery ZIP packages without a custom recovery (TWRP/OrangeFox) using an isolated chroot environment.

## Features
- **Isolated Chroot:** Flashing happens in a controlled environment to avoid messing up the live system.
- **Web UI:** Built-in web interface for KernelSU/Magisk WebUI.
- **Logging:** Every flash is logged in `/data/adb/zip-flash/logs/`.
- **Flexible Options:**
  - `NOSYSTEM=1`: Don't mount system partitions (useful for modules that only touch /data).
  - `SYSTEM_MODE=rw`: Remount system partitions as read-write (if supported by kernel).
  - `DEBUG=1`: Verbose logging.
- **VM Shell:** Enter the chroot environment manually for debugging.

## Usage

### Web Interface
1. Open KernelSU/Magisk manager.
2. Go to Modules -> ZIP Flash.
3. Click "Select ZIP" to find files in your Download folder.
4. Click "FLASH" to start the process.

### Command Line (Root required)
```bash
# Flash a single zip
zip-flash /sdcard/Download/module.zip

# Flash multiple zips
zip-flash /sdcard/zip1.zip /sdcard/zip2.zip

# Enter chroot shell
zip-flash vmshell
```

## How it works
The script creates a `tmpfs` at `/dev/zipflash_$$`, bind-mounts necessary system directories (`/dev`, `/data`, `/sdcard`, etc.), and uses `busybox unshare -m` to create a private mount namespace. It then executes the `update-binary` found inside the ZIP file using `chroot`.

## Technical Notes
- Requires `busybox`.
- Works on both System-as-Root and legacy devices.
- Handles SELinux by mounting `selinuxfs` inside chroot.
