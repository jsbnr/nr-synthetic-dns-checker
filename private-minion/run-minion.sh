#!/bin/bash
if [ $# -eq 0 ]
  then
    echo "No arguments supplied, specify your minion key"
    exit 1 
fi

MODULE_PATH=`pwd`
docker run -e MINION_PRIVATE_LOCATION_KEY=$1 -v /tmp:/tmp:rw -v /var/run/docker.sock:/var/run/docker.sock:rw -v ${MODULE_PATH}/custom-node-modules:/var/lib/newrelic/synthetics/modules:rw  quay.io/newrelic/synthetics-minion:latest
