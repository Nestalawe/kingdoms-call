#!/bin/bash
# Plays bot-matrix runs for the alignment kits, one seed set at a time (48 bot games and 12 scripted games a set).
# Usage, from the repo root:  OUT=/some/dir TAG=r28 tools/handplay/matrix/run-kits.sh "all-A all-B base-C Divine-A"
# A job is <what>-<set>: what = all (all seven kits on), base (today's rules: kits off), or one alignment (its kit
# alone); set = A to E. Prefix g (gall-C, gbase-C) for a world that begins with graves (KC_START_GRAVES=1).
# Writes $OUT/<job>-$TAG.json (the matrix's figures) and $OUT/<job>-$TAG.txt (its console output).
set -u
OUT=${OUT:?set OUT to a directory}; TAG=${TAG:?set TAG, e.g. r28}
mkdir -p "$OUT"
ALL=Divine,Good,Druidic,Neutral,Pagan,Evil,Undead
for job in $1; do
  kit=${job%-*}; set=${job##*-}
  G=0; case "$kit" in g*) G=1; kit=${kit#g};; esac
  echo "START $job $(date +%T)"
  if [ "$kit" = base ]; then
    KC_START_GRAVES=$G KC_BOT_LAIRS=1 npm run balance -- --set "$set" --out "$OUT/$job-$TAG.json" > "$OUT/$job-$TAG.txt" 2>&1
  else
    P=$kit; [ "$kit" = all ] && P=$ALL
    KC_START_GRAVES=$G KC_BOT_LAIRS=1 KC_ALIGN_TACTICS=1 KC_ALIGN_PROTO=$P \
      npm run balance -- --set "$set" --out "$OUT/$job-$TAG.json" > "$OUT/$job-$TAG.txt" 2>&1
  fi
  echo "DONE $job $(date +%T)"
done
