#!/bin/bash

build() {
    echo 'building...'
    bun build src/index.ts --sourcemap --outdir public/
}

build

inotifywait -m -e modify,move,create,delete "./src" | while read path action file; do build; done
