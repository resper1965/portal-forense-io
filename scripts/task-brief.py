import sys
import os
import re

if len(sys.argv) < 3:
    print("usage: python task-brief.py PLAN_FILE TASK_NUMBER [OUTFILE]")
    sys.exit(2)

plan_file = sys.argv[1]
task_num = sys.argv[2]

if not os.path.exists(plan_file):
    print(f"no such plan file: {plan_file}")
    sys.exit(2)

# Default OUTFILE: <repo-root>/.superpowers/sdd/task-<N>-brief.md
if len(sys.argv) == 4:
    out_file = sys.argv[3]
else:
    # Resolve repo root
    # assuming we are in portal-forense-io directory
    repo_root = os.getcwd()
    sdd_dir = os.path.join(repo_root, ".superpowers", "sdd")
    os.makedirs(sdd_dir, exist_ok=True)
    # Write .gitignore if not present
    gitignore = os.path.join(sdd_dir, ".gitignore")
    if not os.path.exists(gitignore):
        with open(gitignore, "w", encoding="utf-8") as g:
            g.write("*\n")
    out_file = os.path.join(sdd_dir, f"task-{task_num}-brief.md")

with open(plan_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

in_fence = False
in_task = False
task_content = []

# Target heading pattern: e.g., "### Task 1:"
task_pattern = re.compile(rf"^#+[ \t]+Task[ \t]+{task_num}([^0-9]|$)", re.IGNORECASE)
next_task_pattern = re.compile(r"^#+[ \t]+Task[ \t]+[0-9]+", re.IGNORECASE)

for line in lines:
    if line.startswith("```"):
        in_fence = not in_fence
    
    if not in_fence:
        if task_pattern.match(line):
            in_task = True
            task_content.append(line)
            continue
        elif in_task and next_task_pattern.match(line):
            in_task = False
            break
            
    if in_task:
        task_content.append(line)

if not task_content:
    print(f"task {task_num} not found in {plan_file}")
    sys.exit(3)

with open(out_file, "w", encoding="utf-8") as out:
    out.writelines(task_content)

print(f"wrote {out_file}: {len(task_content)} lines")
