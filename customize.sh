chmod 755 "$MODPATH/system/bin/zip-flash"
chmod 755 "$MODPATH/system/bin/zip"
ln -sf ./zip-flash "$MODPATH/system/bin/flash"
ln -sf ./zip-flash "$MODPATH/system/bin/vmshell"
