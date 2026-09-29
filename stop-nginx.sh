#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Stop nginx
# @raycast.mode compact

# Optional parameters:
# @raycast.argument1 { "type": "password", "placeholder": "password" }
# @raycast.icon 📡

# Documentation:
# @raycast.author David
# @raycast.authorURL https://raycast.com/David

echo -e "\n$1" | sudo -S brew services stop nginx && sudo -S brew services stop dnsmasq

