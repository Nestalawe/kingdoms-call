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
#   kc-merge <pr>          checks the pull request merges into main, marks it ready, merges it with a merge
#                          commit, then waits until it is deployed (press any key to stop waiting)
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

# Check the pull request merges into main, mark it ready, merge it with a merge commit, then wait for its deploy.
# The branch is kept: the next pull request of a stack is based on it.
kc-merge() {
  local pr=$1 repo=Nestalawe/kingdoms-call
  if [[ -z $pr ]]; then
    echo "usage: kc-merge <pr-number>" >&2
    return 1
  fi

  local base
  base=$(gh pr view -R $repo "$pr" --json baseRefName -q .baseRefName) || return 1
  if [[ $base != main ]]; then
    echo "#$pr merges into '$base', not main: stopping." >&2
    echo "If its base PR is already merged: gh pr edit $pr --base main" >&2
    return 1
  fi

  gh pr ready -R $repo "$pr" || return 1
  gh pr merge -R $repo "$pr" --merge || return 1

  echo "Merged #$pr."
  kc-wait-deploy "$pr"
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
