#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start nginx
# @raycast.mode compact

# Optional parameters:
# @raycast.argument1 { "type": "password", "placeholder": "password" }
# @raycast.icon 📡

# Documentation:
# @raycast.author David
# @raycast.authorURL https://raycast.com/David

echo -e "\n$1" | sudo -S brew services start nginx && sudo -S brew services start dnsmasq