import sys
import os
import subprocess

if len(sys.argv) < 3:
    print("usage: python review-package.py BASE HEAD [OUTFILE]")
    sys.exit(2)

base = sys.argv[1]
head = sys.argv[2]

def run_git_cmd(args):
    try:
        res = subprocess.run(["git"] + args, capture_output=True, text=True, check=True)
        return res.stdout
    except subprocess.CalledProcessError as e:
        print(f"Git command failed: {' '.join(e.cmd)}")
        print(e.stderr)
        sys.exit(2)

# Verify commits exist
run_git_cmd(["rev-parse", "--verify", "--quiet", base])
run_git_cmd(["rev-parse", "--verify", "--quiet", head])

# Resolve output file
if len(sys.argv) == 4:
    out_file = sys.argv[3]
else:
    repo_root = os.getcwd()
    sdd_dir = os.path.join(repo_root, ".superpowers", "sdd")
    os.makedirs(sdd_dir, exist_ok=True)
    
    # Get short hashes
    base_short = run_git_cmd(["rev-parse", "--short", base]).strip()
    head_short = run_git_cmd(["rev-parse", "--short", head]).strip()
    out_file = os.path.join(sdd_dir, f"review-{base_short}..{head_short}.diff")

# Generate review package
commits_log = run_git_cmd(["log", "--oneline", f"{base}..{head}"])
stat_diff = run_git_cmd(["diff", "--stat", f"{base}..{head}"])
context_diff = run_git_cmd(["diff", "-U10", f"{base}..{head}"])

with open(out_file, "w", encoding="utf-8") as out:
    out.write(f"# Review package: {base}..{head}\n\n")
    out.write("## Commits\n")
    out.write(commits_log + "\n")
    out.write("## Files changed\n")
    out.write(stat_diff + "\n")
    out.write("## Diff\n")
    out.write(context_diff + "\n")

commit_count = run_git_cmd(["rev-list", "--count", f"{base}..{head}"]).strip()
file_size = os.path.getsize(out_file)

print(f"wrote {out_file}: {commit_count} commit(s), {file_size} bytes")
