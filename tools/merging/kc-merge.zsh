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
#                          in main it first moves onto main. Main's rules need CodeQL's results for the pull request,
#                          and moving its base starts no scan, so one with none it brings up to date with main (a merge
#                          commit on its branch) and waits for ci, db and CodeQL on that commit (press any key to stop
#                          waiting). For several, it starts them all at once first: each stacked one whose branch holds
#                          all of its base is moved onto main early and brought up to date, so their checks run side by
#                          side (a stack of 17: about 30 to 40 minutes, not 1.5 hours). It asks before bringing up to
#                          date one with the label `staging` (a push rebuilds staging's database). If one fails, it
#                          stops; run it again to carry on.
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

# One line on a pull request's last commit: "<sha> pending=<n> ci=<…> db=<…> CodeQL=<…>", each check the latest of
# its name (a run replaced by a newer one leaves a failed or cancelled check behind), PENDING while it runs.
_kc-checks-line() {
  gh pr view -R Nestalawe/kingdoms-call "$1" --json headRefOid,statusCheckRollup -q '
    def running: (.__typename == "CheckRun" and .status != "COMPLETED")
                 or (.__typename == "StatusContext" and (.state == "PENDING" or .state == "EXPECTED"));
    "\(.headRefOid) pending=\([.statusCheckRollup[] | select(running)] | length) "
      + ([.statusCheckRollup[] | select((.name // .context) == ("ci", "db", "CodeQL"))]
         | group_by(.name // .context)
         | map(max_by(.startedAt // "")
               | "\(.name // .context)=\(if running then "PENDING" else (.conclusion // .state) end)")
         | join(" "))'
}

# True if the pull request's last commit has a check of this name (finished or not).
_kc-has-check() {
  [[ " $(_kc-checks-line "$1") " == *" $2="* ]]
}

# Bring a pull request up to date with main (GitHub pushes a merge commit to its branch), and wait for the new commit.
# A pull request with the label `staging` is on the staging site, and a push to it rebuilds staging's database (its
# games and accounts emptied): it asks first, and takes the label off before the push.
_kc-bring-up-to-date() {
  local pr=$1 why=${2:-"it has no CodeQL results (moving its base started no scan)"} repo=Nestalawe/kingdoms-call old new tries
  old=$(gh pr view -R $repo "$pr" --json headRefOid -q .headRefOid) || return 1
  # `gh -q` prints a null as an empty line, so the test asks for true or false.
  if [[ $(gh pr view -R $repo "$pr" --json labels -q 'any(.labels[]; .name == "staging")') == true ]]; then
    echo "#$pr has the label 'staging': a push to it rebuilds staging's database (its games and accounts emptied)."
    if [[ ! -t 0 ]] || ! read -q "?Take the label off #$pr and bring it up to date with main? [y/N] "; then
      echo
      echo "Left #$pr as it is: stopping. Once staging is done with, take the label off and run kc-merge again." >&2
      return 1
    fi
    echo
    gh pr edit -R $repo "$pr" --remove-label staging >/dev/null || return 1
    echo "Took the label 'staging' off #$pr."
  fi
  echo "#$pr: $why: bringing it up to date with main."
  if ! gh pr update-branch -R $repo "$pr"; then
    echo "Couldn't bring #$pr up to date with main: stopping." >&2
    echo "Close and reopen it on GitHub to start CodeQL and CI, then run kc-merge again." >&2
    return 1
  fi
  for (( tries = 0; tries < 24; tries++ )); do
    new=$(gh pr view -R $repo "$pr" --json headRefOid -q .headRefOid) || return 1
    [[ $new != "$old" ]] && break
    sleep 5
  done
  if [[ $new == "$old" ]]; then
    echo "#$pr's branch didn't move (it may hold main already): close and reopen it on GitHub to start CodeQL" >&2
    echo "and CI, then run kc-merge again." >&2
    return 1
  fi
  echo "#$pr is now at ${new:0:7} (main merged in); CI and CodeQL start on it."
}

# Wait until every check on the pull request's last commit has finished, and ci, db and CodeQL passed. Press any key
# to stop waiting. CI takes about 4 minutes and CodeQL about 1.5, side by side.
_kc-wait-for-checks() {
  local pr=$1 line last="" sha pending rest started=$SECONDS
  echo "Waiting for ci, db and CodeQL on #$pr (about 5 minutes; press any key to stop waiting)."
  while true; do
    line=$(_kc-checks-line "$pr") || return 1
    read -r sha pending rest <<< "$line"
    if [[ $line != "$last" ]]; then
      print -r -- "$(date +%H:%M:%S)  ${sha:0:7}  ${pending#pending=} check(s) running  ${rest:-no ci, db or CodeQL yet}"
      last=$line
    fi
    if [[ $pending == pending=0 ]] && [[ " $rest " == *" ci="* && " $rest " == *" db="* && " $rest " == *" CodeQL="* ]]; then
      if [[ " $rest " == *" ci=SUCCESS "* && " $rest " == *" db=SUCCESS "* \
            && ( " $rest " == *" CodeQL=SUCCESS "* || " $rest " == *" CodeQL=NEUTRAL "* ) ]]; then
        echo "$(date +%H:%M:%S)  ci, db and CodeQL passed on ${sha:0:7}."
        return 0
      fi
      echo "A check didn't pass on #$pr (${rest})." >&2
      [[ " $rest " != *" CodeQL=SUCCESS "* ]] && echo "CodeQL's alerts are on the pull request's page (Checks, then CodeQL)." >&2
      return 2
    fi
    if (( SECONDS - started > 40 * 60 )); then
      echo "#$pr's checks haven't finished after 40 minutes: stopping. kc-merge carries on from it when run again." >&2
      return 1
    fi
    if _kc-key-pressed-within 15; then
      echo "Stopped waiting. Run the same kc-merge again to carry on." >&2
      return 1
    fi
  done
}

# Start a pull request's CI and CodeQL now, before the ones below it merge, so a stack's checks run side by side: a
# stacked one whose branch already holds all of its base is moved onto main early (until the ones below merge, GitHub
# shows their changes in its diff too), then any without CodeQL's results is brought up to date with main. Its checks
# then test what main will hold once the ones below have merged (each a merge commit adding only its own branch). One
# whose branch lacks some of its base's commits is left for kc-merge to start once its base has merged.
_kc-start-checks-early() {
  local pr=$1 base_tip=$2 repo=Nestalawe/kingdoms-call info base head behind
  info=$(gh pr view -R $repo "$pr" --json baseRefName,headRefName -q '"\(.baseRefName) \(.headRefName)"') || return 1
  read -r base head <<< "$info"
  if [[ $base != main ]]; then
    # Against the base's commit as kc-merge found it: bringing the pull request below up to date has since added a
    # merge of main to that branch, which this one needn't hold.
    behind=$(gh api "repos/$repo/compare/${base_tip:-$base}...$head" -q .behind_by) || return 1
    if [[ $behind != 0 ]]; then
      echo "#$pr: its branch lacks $behind commit(s) of '$base': its checks start once '$base' has merged."
      return 0
    fi
    gh pr edit -R $repo "$pr" --base main >/dev/null || return 1
    echo "#$pr: moved onto main early (its branch holds all of '$base')."
  fi
  if _kc-has-check "$pr" CodeQL; then
    echo "#$pr: has CodeQL's results already."
    return 0
  fi
  _kc-bring-up-to-date "$pr"
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

  # Main's rules merge nothing without CodeQL's results for the pull request's last commit. CodeQL scans a pull
  # request only when a commit is pushed to it while it merges into main, so one that was stacked has none, and moving
  # its base starts no scan (nor CI). Bringing it up to date with main pushes a merge commit: CI and CodeQL then run
  # on what main will hold.
  local updated=0 merge_state
  if ! _kc-has-check "$pr" CodeQL; then
    _kc-bring-up-to-date "$pr" || return 1
    updated=1
  fi
  while true; do
    _kc-wait-for-checks "$pr"
    case $? in
      0) ;;
      2) # Checks started early compare the pull request with main before the ones below it merged, so they also see
         # those ones' changes (a refactor-only one then "changes the baseline" a fix below it rewrote). Once only.
         if (( ! updated )); then
           _kc-bring-up-to-date "$pr" "a check failed; checking it again against main as it is now" || return 1
           updated=1
           continue
         fi
         echo "#$pr: a check failed again, against main as it is now: stopping." >&2
         return 1 ;;
      *) return 1 ;;
    esac

    # The rules' verdict follows the checks by a few seconds; BLOCKED until then.
    for (( tries = 0; tries < 24; tries++ )); do
      merge_state=$(gh pr view -R $repo "$pr" --json mergeStateStatus -q .mergeStateStatus) || return 1
      [[ $merge_state != (BLOCKED|UNKNOWN) ]] && break
      sleep 5
    done
    [[ $merge_state != (BLOCKED|UNKNOWN) ]] && break
    # Checks started early ran before main moved; if the rules want a scan against main as it is now, one more update.
    if (( ! updated )); then
      _kc-bring-up-to-date "$pr" "its checks passed, but main's rules still block it (main has moved since its scan)" \
        || return 1
      updated=1
      continue
    fi
    echo "#$pr's checks passed, but main's rules still block it (merge state: $merge_state): stopping." >&2
    echo "Its page on GitHub says which rule; run kc-merge again once it's met." >&2
    return 1
  done

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
  local -A tip_of base_of
  numbers=($(_kc-pr-numbers "$@")) || return 1

  local n info state draft base head head_sha checks title note blocked=0
  echo "== The plan"
  for n in $numbers; do
    info=$(gh pr view -R $repo "$n" --json state,isDraft,baseRefName,headRefName,headRefOid,statusCheckRollup,title -q '
      "\(.state) \(.isDraft) \(.baseRefName) \(.headRefName) \(.headRefOid) "
        + ([.statusCheckRollup[] | select((.name // .context) == ("ci", "db"))]
           | group_by(.name // .context)
           | map(max_by(.startedAt // "") | "\(.name // .context)=\(.conclusion // .state)")
           | join(" ")),
      .title' 2>/dev/null)
    if [[ -z $info ]]; then
      echo "#$n  skip: not a pull request"
      continue
    fi
    { read -r state draft base head head_sha checks; read -r title; } <<< "$info"
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
    tip_of[$head]=$head_sha
    base_of[$n]=$base
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

  # Start every pull request's CI and CodeQL now, side by side, rather than each after the one below it merges (about
  # 5 minutes each, one after another). One that can't start yet is started by the merge below.
  if (( ${#to_merge} > 1 )); then
    echo
    echo "== Starting the checks of all ${#to_merge} now"
    for n in $to_merge; do
      _kc-start-checks-early "$n" "${tip_of[${base_of[$n]}]}" || echo "#$n: its checks start when its turn to merge comes." >&2
    done
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
