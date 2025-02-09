#!/bin/bash

npm i

pm2 stop scale-antitamper-api

pm2 delete scale-antitamper-api

pm2 start  npm --name "scale-antitamper-api" -- run "production" 