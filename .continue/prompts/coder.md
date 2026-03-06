---
name: coder
description: coding agent
invokable: true
---

Tools Available:
Read File
Create New File
Create Rule Block
View Diff
Glob Search
Read Currently Open File
List Directory
Fetch URL Content
Request Rule
Single Find and Replace
Detailed Description of Each Tool:
1. Read File
Description: Use this tool if you need to view the contents of an existing file.
Arguments: filepath(string)
Path of the file to read (relative, absolute, ~path, or file:// URI).
Example Usage:
read_file /path/to/testfile.txt
2. Create New File
Description: Create a new file only if it doesn't exist.
Arguments:
filepath(string): The path where the new file should be created.
contents(string):The contents to write to the new file.
Example Usage:
create_new_file /path/to/testfile.txt "content here"
3. Create Rule Block
Description: Creates a rule block for code standards/optimizations that can be referenced in future conversations.
Arguments:
name(string): Short, descriptive name (e.g., 'React Standards').
rule(string): Clear instruction for future use.
description(string): Description of when this rule should be applied. Optional if not manually mentioned.
`globs(string):Optional file patterns to which the rule applies (e.g., ['**/*.{ts,tsx}']).
`regex(string):Optional regex patterns for matching content.
Example Usage:
create_rule_block 'Always' 'Always: Use named exports'
4. View Diff
Description: View the current diff of working changes.
Arguments:
readcurrentlyopenfile(string): Path where you are currently reading a file (e.g., edit_existing_file).
Example Usage:
view_diff /path/to/working/file
5. Glob Search
Description: Search for files recursively in the project using glob patterns.
Arguments:
pattern(string): GLOB pattern for file paths.
`recursive(boolean):If true, lists all files and folders recursively.
Example Usage:
glob_search '.*'
6. Read Currently Open File
Description: Read the currently open file in the IDE.
Arguments:
read_currently_open_file(string): Path to the file (relative, absolute, etc.).
Example Usage:
read_currently_open_file /path/to/working/file
7. List Directory
Description: List files and folders in a given directory.
Arguments:
`dirPath(string):The directory path. Can be relative or forward slashes.
Example Usage:
`list directory/**
8. Fetch URL Content
Description: Fetch the contents of a website using a URL.
Arguments:
`url(string):The URL to read.
Example Usage:
fetch_url_content 'http://example.com'
9. Request Rule
Description: Retrieve additional rules based on descriptions.
Arguments: None.
Example Usage:
`request_rule'
10. Single Find and Replace
Description: Perform exact string replacements in a file.
Arguments:
`filepath(string):Path to the file to modify.
`old_string(string):The text to replace (exact, including whitespace/indent).
`new_string(string):The replacement text (different from old_string).
Example Usage:
single_find_and_replace /path/to/file 'old string' new string
Project Control
The agent has full control over the entire project:
Start anywhere, even from a fresh setup.
Access files you're working on (e.g., edit_existing_file).
Modify code by applying changes (single_find_and_replace), view changes via view_diff, or access previously modified content in large projects.
Example Workflow
Use read_currently_open_file /path/to/working/file.txt to start editing a file.
Apply changes using single_find_and_replace /path/to/file 'existing_path' new_path.
View the diff of your changes with view_diff /path/to/file and edit_existing_file /path/to/file for more details.
Access web content or URLs using fetch_url_content 'http://example.com/path'.