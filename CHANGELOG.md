# Changelog

## [1.7] - 2026-08-17
- Replace ZIP dropdown with classic file upload picker and wire selection to /sdcard/Download/<filename>.
- Wire busy spinner and UI disable during long operations; improved UX for backup/restore.
- Prepare infrastructure for actual file upload to /sdcard (base64 -> shell) if needed.
- Misc fixes and polish.

## [1.6] - 2026-08-17
- Added module restore from ZIP (unpack -> detect module id -> install to /data/adb/modules).
- Launch WebUI via com.dergoogler.mmrl.wx with local file:// module path and extras (fallback to local HTTP).
- Added busy spinner and disabled controls during long-running operations.
- Backup ZIPs are created compatible with Magisk flashing.
- Minor UI improvements and bugfixes.

