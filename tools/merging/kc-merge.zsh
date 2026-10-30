# Shell helpers for merging Kingdoms Call pull requests and watching their deploy (zsh).
#
# To use them, load this file into your shell from the repository's folder:
#
#   source tools/merging/kc-merge.zsh
#
# To have them in every new shell, add that line, with the file's full path, to ~/.zshrc:
#
#   source ~/working/kingdoms-call/tools/merging/kc-merge.zsh
#
# They need the GitHub CLI (`gh`), signed in with the right to merge, and `curl`.
#
#   kc-status              the pull requests left to merge, the latest deploy on main, and the live site's commit
#   kc-merge <prs>         merges pull requests into main one after the other, then waits until the last one is
#                          deployed (press any key to stop waiting). <prs> is numbers or ranges: kc-merge 294,
#                          kc-merge 294-310, kc-merge 294-299 301. It skips the merged and closed ones, and shows the
#                          plan first: it merges nothing unless every one is ready (its ci and db checks passed, and
#                          it merges into main or a branch before it in the list), and asks before merging more than
#                          one. Each it marks ready and merges with a merge commit; one stacked on a branch already
#                          in main it first moves onto main. If one fails, it stops; run it again to carry on.
#   kc-wait-deploy <pr>    waits until a merged pull request is deployed and live (press any key to stop waiting)

# Wait <seconds>; true if a key was pressed meanwhile. Without a terminal to read keys from, it only sleeps.
_kc-key-pressed-within() {
  local key
  if [[ -t 0 ]]; then
    read -s -k 1 -t "$1" key
  else
    sleep "$1"
    return 1
  fi
}

# The pull requests left to merge, the latest deploy on main, and the live site's commit.
kc-status() {
  local repo=Nestalawe/kingdoms-call
  echo "== PRs left to merge (oldest first)"
  gh pr list -R $repo --limit 50 --json number,title,baseRefName,isDraft \
    -q 'sort_by(.number)[] | "#\(.number)  into \(.baseRefName)\(if .isDraft then "  (draft)" else "" end)  \(.title[0:70])"'

  echo
  echo "== Latest deploy on main"
  local id
  id=$(gh run list -R $repo --workflow deploy.yml --branch main --limit 1 --json databaseId -q '.[0].databaseId')
  if [[ -z $id ]]; then
    echo "No deploy run found."
    return 1
  fi
  gh run view -R $repo "$id" --json headSha,status,conclusion,createdAt,jobs \
    -q '"run \(.status) \(.conclusion // "")  commit \(.headSha[0:7])  started \(.createdAt)",
        (.jobs[] | select(.name == "deploy") | "deploy job: \(.status) \(.conclusion // "")")'

  echo
  echo "== Live site"
  curl -s "https://nestalawe.github.io/kingdoms-call/version.json?t=$(date +%s)" \
    | sed -n 's/.*"commit": *"\([0-9a-f]\{7\}\).*/live commit \1/p'
  echo "main is at $(gh api repos/$repo/commits/main -q '.sha[0:7]')"
}

# The pull request numbers named by arguments like 294 or 294-299, in the order given, each once.
_kc-pr-numbers() {
  local arg n
  local -a out
  for arg in "$@"; do
    if [[ $arg == <->-<-> ]]; then
      if (( ${arg%-*} > ${arg#*-} )); then
        echo "kc-merge: the range '$arg' runs backwards: write it ${arg#*-}-${arg%-*}." >&2
        return 1
      fi
      for (( n = ${arg%-*}; n <= ${arg#*-}; n++ )); do out+=($n); done
    elif [[ $arg == <-> ]]; then
      out+=($arg)
    else
      echo "kc-merge: '$arg' isn't a pull request number or a range like 294-299." >&2
      return 1
    fi
  done
  print -r -- ${(u)out}
}

# Merge one open pull request into main with a merge commit. A stacked one whose base branch is already all in main is
# moved onto main first, so a stack merges one by one. The branch is kept: the next pull request of a stack is based on it.
_kc-merge-one() {
  local pr=$1 repo=Nestalawe/kingdoms-call base ahead mergeable tries
  base=$(gh pr view -R $repo "$pr" --json baseRefName -q .baseRefName) || return 1
  if [[ $base != main ]]; then
    ahead=$(gh api "repos/$repo/compare/main...$base" -q .ahead_by) || return 1
    if [[ $ahead != 0 ]]; then
      echo "#$pr merges into '$base', which has $ahead commit(s) not in main: stopping." >&2
      echo "Merge the pull request for '$base' first." >&2
      return 1
    fi
    gh pr edit -R $repo "$pr" --base main >/dev/null || return 1
    echo "Moved #$pr onto main: all of '$base' is in main already."
  fi

  gh pr ready -R $repo "$pr" || return 1

  # GitHub works out whether it can merge a little after main or the base changes; until then it says UNKNOWN.
  for (( tries = 0; tries < 24; tries++ )); do
    mergeable=$(gh pr view -R $repo "$pr" --json mergeable -q .mergeable) || return 1
    [[ $mergeable != UNKNOWN ]] && break
    sleep 5
  done
  if [[ $mergeable != MERGEABLE ]]; then
    echo "GitHub says #$pr can't merge into main (mergeable: $mergeable): stopping." >&2
    [[ $mergeable == CONFLICTING ]] && echo "It conflicts with main: update its branch, let CI pass, then run kc-merge again." >&2
    return 1
  fi

  gh pr merge -R $repo "$pr" --merge || return 1
  echo "Merged #$pr."
}

# Merge pull requests into main one after the other, then wait until the last one is deployed. Shows the plan first,
# and stops before merging anything if one in it isn't ready; asks before merging more than one.
kc-merge() {
  local repo=Nestalawe/kingdoms-call
  if (( $# == 0 )); then
    echo "usage: kc-merge <pr-number or range>...   (e.g. kc-merge 294, kc-merge 294-310, kc-merge 294-299 301)" >&2
    return 1
  fi
  local -a numbers to_merge heads merged
  numbers=($(_kc-pr-numbers "$@")) || return 1

  local n info state draft base head checks title note blocked=0
  echo "== The plan"
  for n in $numbers; do
    info=$(gh pr view -R $repo "$n" --json state,isDraft,baseRefName,headRefName,statusCheckRollup,title -q '
      "\(.state) \(.isDraft) \(.baseRefName) \(.headRefName) "
        + ([.statusCheckRollup[] | select((.name // .context) == ("ci", "db"))]
           | group_by(.name // .context)
           | map(max_by(.startedAt // "") | "\(.name // .context)=\(.conclusion // .state)")
           | join(" ")),
      .title' 2>/dev/null)
    if [[ -z $info ]]; then
      echo "#$n  skip: not a pull request"
      continue
    fi
    { read -r state draft base head checks; read -r title; } <<< "$info"
    case $state in
      MERGED) echo "#$n  skip: already merged"; continue ;;
      CLOSED) echo "#$n  skip: closed without merging"; continue ;;
    esac

    note=""
    if [[ $checks != "ci=SUCCESS db=SUCCESS" ]]; then
      note="not ready: the required checks are ${checks:-missing}"
    elif [[ $base != main ]] && (( ! ${heads[(Ie)$base]} )) \
         && [[ $(gh api "repos/$repo/compare/main...$base" -q .ahead_by 2>/dev/null) != 0 ]]; then
      note="not ready: it merges into '$base', which isn't in main and no pull request before it here brings it"
    fi
    if [[ -n $note ]]; then
      echo "#$n  $note  ${title[1,60]}"
      blocked=1
      continue
    fi
    echo "#$n  merge$([[ $base != main ]] && echo " (stacked on $base)")  ${title[1,60]}"
    to_merge+=($n)
    heads+=($head)
  done

  if (( blocked )); then
    echo "Nothing merged. Fix the pull requests marked 'not ready', or leave them out, and run kc-merge again." >&2
    return 1
  fi
  if (( ${#to_merge} == 0 )); then
    echo "Nothing to merge."
    return 0
  fi
  if (( ${#to_merge} > 1 )) && [[ -t 0 ]]; then
    echo
    if ! read -q "?Merge these ${#to_merge} pull requests into main, in this order? [y/N] "; then
      echo
      echo "Nothing merged."
      return 1
    fi
    echo
  fi

  for n in $to_merge; do
    echo
    echo "== #$n"
    if ! _kc-merge-one "$n"; then
      echo >&2
      (( ${#merged} )) && echo "Merged: #${(j:, #:)merged}." >&2
      echo "Not merged: #${(j:, #:)to_merge[${#merged}+1,-1]}. Once it's fixed, run the same kc-merge again: it skips the merged ones." >&2
      (( ${#merged} )) && echo "To watch the deploy of what merged: kc-wait-deploy ${merged[-1]}" >&2
      return 1
    fi
    merged+=($n)
  done

  echo
  (( ${#merged} > 1 )) && echo "Merged ${#merged} pull requests. The deploy of the last one carries them all."
  kc-wait-deploy "${merged[-1]}"
}

# Wait until merged pull request <pr-number> is deployed and live. Press any key to stop waiting.
kc-wait-deploy() {
  local pr=$1 sha id="" out st concl dj line last="" live
  local repo=Nestalawe/kingdoms-call
  local site=https://nestalawe.github.io/kingdoms-call/version.json
  if [[ -z $pr ]]; then
    echo "usage: kc-wait-deploy <pr-number>" >&2
    return 1
  fi

  local state
  state=$(gh pr view -R $repo "$pr" --json state -q .state) || return 1
  if [[ $state != MERGED ]]; then
    echo "#$pr isn't merged (it is $state)." >&2
    return 1
  fi
  sha=$(gh pr view -R $repo "$pr" --json mergeCommit -q .mergeCommit.oid)
  if [[ -z $sha ]]; then
    echo "#$pr is merged, but GitHub gives no merge commit for it." >&2
    return 1
  fi
  echo "Waiting for #$pr (${sha:0:7}) to deploy (press any key to stop waiting)."

  # 1. The Deploy run for this commit.
  while true; do
    if [[ -z $id ]]; then
      id=$(gh run list -R $repo --workflow deploy.yml --branch main --commit "$sha" \
             --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null)
      line="waiting for the Deploy run to start"
    fi
    if [[ -n $id ]]; then
      out=$(gh run view -R $repo "$id" --json status,conclusion,jobs -q '
        def c(x): if x == "" or x == null then "-" else x end;
        "\(.status) \(c(.conclusion)) \(c([.jobs[] | select(.name == "deploy") | .conclusion][0]))",
        "deploy run: \(.status)\(if .conclusion != "" then " (" + .conclusion + ")" else "" end), "
          + "\([.jobs[] | select(.status == "completed")] | length) of \(.jobs | length) jobs done"
          + ([.jobs[] | select(.status == "in_progress") | .name]
             | if length > 0 then "; running: " + join(", ") else "" end)')
      { read -r st concl dj; read -r line; } <<< "$out"

      if [[ $st == completed ]]; then
        [[ $line != "$last" ]] && print -r -- "$(date +%H:%M:%S)  $line"
        if [[ $dj == success ]]; then
          break
        fi
        echo "The deploy job didn't succeed (run: $concl, deploy job: $dj)." >&2
        [[ $concl == cancelled ]] && echo "A newer merge probably replaced this run: wait on that PR instead (kc-wait-deploy <its number>)." >&2
        echo "Run: https://github.com/$repo/actions/runs/$id" >&2
        return 1
      fi
    fi
    if [[ $line != "$last" ]]; then
      print -r -- "$(date +%H:%M:%S)  $line"
      last=$line
    fi
    if _kc-key-pressed-within 10; then
      echo "Stopped waiting. kc-status shows where it is."
      return 0
    fi
  done

  # 2. GitHub Pages serving it, or a later commit that contains it.
  echo "$(date +%H:%M:%S)  deploy job succeeded; waiting for the live site to serve ${sha:0:7}"
  while true; do
    live=$(curl -s "$site?t=$(date +%s)" | sed -n 's/.*"commit": *"\([0-9a-f]*\)".*/\1/p')
    if [[ $live == "$sha" ]]; then
      echo "$(date +%H:%M:%S)  live: version.json names ${sha:0:7}. Deployed."
      return 0
    fi
    if [[ -n $live ]] && [[ $(gh api "repos/$repo/compare/$sha...$live" -q .status 2>/dev/null) == ahead ]]; then
      echo "$(date +%H:%M:%S)  live: version.json names ${live:0:7}, a later commit that contains ${sha:0:7}. Deployed."
      return 0
    fi
    if _kc-key-pressed-within 15; then
      echo "Stopped waiting (the live site still names ${live:0:7})."
      return 0
    fi
  done
}
