#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Move Desk
# @raycast.mode compact

# Optional parameters:
# @raycast.argument1 { "type": "text", "placeholder": "height" }
# @raycast.icon ↕️

# Documentation:
# @raycast.author David
# @raycast.authorURL https://raycast.com/David

linak-controller --move-to $(($1 * 10))

