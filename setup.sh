#!/bin/bash

npm i


systemctl restart backend

journalctl -u backend -f