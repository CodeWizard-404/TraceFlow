import os
import sys

# Define included and excluded folders
INCLUDED_FOLDERS = ["Front-End", "Back-End"]
EXCLUDED_FOLDERS = ["node_modules"]
OUTPUT_FILE = "merged_code.txt"

def count_files_and_folders(base_path):
    """Counts total files and folders before processing."""
    total_files = 0
    total_folders = 0
    for folder in INCLUDED_FOLDERS:
        folder_path = os.path.join(base_path, folder)
        if os.path.exists(folder_path):
            for root, dirs, files in os.walk(folder_path):
                if any(excluded in root for excluded in EXCLUDED_FOLDERS):
                    continue
                total_folders += 1
                total_files += len(files)
    return total_files, total_folders

def list_directory_structure(base_path):
    """Generates a textual representation of the directory structure."""
    structure = []
    for root, dirs, files in os.walk(base_path):
        if any(excluded in root for excluded in EXCLUDED_FOLDERS):
            continue
        indent_level = root.replace(base_path, "").count(os.sep)
        indent = "    " * indent_level
        structure.append(f"{indent}[{os.path.basename(root)}/]")
        for file in files:
            structure.append(f"{indent}    {file}")
    return "\n".join(structure)

def print_progress(current, total, file_path):
    """Displays progress percentage in the console."""
    percent = (current / total) * 100
    sys.stdout.write(f"\r🔄 Processing {current}/{total} files ({percent:.2f}%) → {file_path}...")
    sys.stdout.flush()

def merge_code_files(base_path):
    """Merges all code files into a single text file with real-time progress updates."""
    total_files, total_folders = count_files_and_folders(base_path)
    processed_files = 0

    print(f"\n📂 Scanning Repository: {base_path}")
    print(f"📊 Total Folders: {total_folders}, Total Files: {total_files}")
    print("🚀 Starting Merge Process...\n")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as output_file:
        # Write directory structure
        output_file.write("### DIRECTORY STRUCTURE ###\n")
        output_file.write(list_directory_structure(base_path) + "\n\n")

        # Process each included folder
        for folder in INCLUDED_FOLDERS:
            folder_path = os.path.join(base_path, folder)
            if not os.path.exists(folder_path):
                continue
            for root, dirs, files in os.walk(folder_path):
                dirs[:] = [d for d in dirs if d not in EXCLUDED_FOLDERS]  # Exclude node_modules
                for file in files:
                    file_path = os.path.join(root, file)
                    processed_files += 1
                    print_progress(processed_files, total_files, file)

                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            file_content = f.read()
                        relative_path = os.path.relpath(file_path, base_path)
                        output_file.write(f"\n\n### FILE: {relative_path} ###\n")
                        output_file.write(file_content)
                        output_file.write("\n" + ("-" * 80) + "\n")
                    except Exception as e:
                        output_file.write(f"\n\n### FILE: {relative_path} (Could not read: {e}) ###\n")

    print(f"\n✅ Merging completed! {processed_files}/{total_files} files merged.")
    print(f"📄 Output saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    project_root = os.getcwd()  # Get the current working directory
    merge_code_files(project_root)
