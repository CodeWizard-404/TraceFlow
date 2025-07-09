import os
from pathlib import Path
import sys

def count_total_files(base_path, target_folders, selected_targets):
    """Count total files to process for progress tracking"""
    total_files = 0
    for folder, targets in selected_targets.items():
        folder_path = os.path.join(base_path, folder)
        if not os.path.exists(folder_path):
            print(f"Debug: Folder not found: {folder_path}")
            continue
        
        # Get the main target (e.g., 'src' for Front-End)
        main_target = target_folders[folder]
        if isinstance(main_target, str):  # Nested case (Front-End/src, Mobile/lib)
            target_base = os.path.join(folder_path, main_target)
            if not os.path.exists(target_base):
                print(f"Debug: Main target not found: {target_base}")
                continue
            for target in targets:
                target_path = os.path.join(target_base, target)
                if os.path.exists(target_path):
                    if os.path.isdir(target_path):
                        for root, _, files in os.walk(target_path):
                            total_files += len(files)
                            print(f"Debug: Found {len(files)} files in {root}")
                    else:
                        total_files += 1
                        print(f"Debug: Found file: {target_path}")
                else:
                    print(f"Debug: Target not found: {target_path}")
        else:  # Non-nested case (Back-End)
            for target in targets:
                target_path = os.path.join(folder_path, target)
                if os.path.exists(target_path):
                    if os.path.isdir(target_path):
                        for root, _, files in os.walk(target_path):
                            total_files += len(files)
                            print(f"Debug: Found {len(files)} files in {root}")
                    else:
                        total_files += 1
                        print(f"Debug: Found file: {target_path}")
                else:
                    print(f"Debug: Target not found: {target_path}")
    return total_files

def copy_file_contents(file_path, output_file, processed_files, total_files):
    """Copy contents of a file to output file with formatting"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            output_file.write(f"\n{'='*50}\n")
            output_file.write(f"File contents: {file_path}\n")
            output_file.write(f"{'='*50}\n")
            output_file.write(content)
            output_file.write("\n")
        print(f"\rProcessing: {file_path} ({processed_files}/{total_files} - {processed_files/total_files*100:.1f}%)", end="")
    except Exception as e:
        output_file.write(f"\n{'='*50}\n")
        output_file.write(f"Error reading {file_path}: {str(e)}\n")
        output_file.write(f"{'='*50}\n")
        print(f"\rError processing: {file_path} ({processed_files}/{total_files} - {processed_files/total_files*100:.1f}%)", end="")

def process_folder(base_path, folder, main_target, targets, output_file, processed_files, total_files):
    """Process a single folder and its selected contents with progress"""
    folder_path = os.path.join(base_path, folder)
    if not os.path.exists(folder_path):
        print(f"\nWarning: Skipping {folder} - not found at {folder_path}")
        output_file.write(f"\nWarning: {folder} not found at {folder_path}\n")
        return processed_files

    print(f"\nProcessing contents of {folder}")
    if isinstance(main_target, str):  # Nested case
        target_base = os.path.join(folder_path, main_target)
        if not os.path.exists(target_base):
            print(f"Debug: Skipping {target_base} - does not exist")
            output_file.write(f"\nWarning: {target_base} does not exist\n")
            return processed_files
        for target in targets:
            target_path = os.path.join(target_base, target)
            if os.path.exists(target_path):
                if os.path.isdir(target_path):
                    for root, _, files in os.walk(target_path):
                        if not files:
                            print(f"Debug: No files found in {root}")
                        for file in files:
                            processed_files += 1
                            file_path = os.path.join(root, file)
                            copy_file_contents(file_path, output_file, processed_files, total_files)
                else:
                    processed_files += 1
                    copy_file_contents(target_path, output_file, processed_files, total_files)
            else:
                print(f"Debug: Skipping {target_path} - does not exist")
                output_file.write(f"\nWarning: {target_path} does not exist\n")
    else:  # Non-nested case
        for target in targets:
            target_path = os.path.join(folder_path, target)
            if os.path.exists(target_path):
                if os.path.isdir(target_path):
                    for root, _, files in os.walk(target_path):
                        if not files:
                            print(f"Debug: No files found in {root}")
                        for file in files:
                            processed_files += 1
                            file_path = os.path.join(root, file)
                            copy_file_contents(file_path, output_file, processed_files, total_files)
                else:
                    processed_files += 1
                    copy_file_contents(target_path, output_file, processed_files, total_files)
            else:
                print(f"Debug: Skipping {target_path} - does not exist")
                output_file.write(f"\nWarning: {target_path} does not exist\n")
    print(f"\nFinished processing {folder}")
    return processed_files

def get_nested_selection(folder, targets, sub_targets):
    """Handle nested target selection for folders with subdirectories"""
    print(f"\n{folder}/{targets}:")
    for i, sub_target in enumerate(sub_targets, 1):
        print(f"  {i}. {sub_target}")
    print(f"  {len(sub_targets) + 1}. All targets in {folder}/{targets}")

    while True:
        try:
            choice = input(f"\nSelect targets for {folder}/{targets} (comma-separated numbers) or 'q' to quit: ")
            if choice.lower() == 'q':
                sys.exit("Process terminated by user")
            
            selections = [int(x.strip()) for x in choice.split(',')]
            if not all(1 <= x <= len(sub_targets) + 1 for x in selections):
                raise ValueError
            
            if len(sub_targets) + 1 in selections:
                return sub_targets
            return [sub_targets[x-1] for x in selections]
        except ValueError:
            print("Invalid input. Please enter valid numbers separated by commas.")

def get_user_selection(target_folders, sub_targets):
    """Display folders and their targets, get user selection including nested targets"""
    selected_targets = {}
    
    print("\nAvailable folders and targets to process:")
    for folder, targets in target_folders.items():
        print(f"\n{folder}:")
        target_list = [targets] if isinstance(targets, str) else targets
        
        if folder in sub_targets and isinstance(targets, str):
            selected_targets[folder] = get_nested_selection(folder, targets, sub_targets[folder])
        else:
            for i, target in enumerate(target_list, 1):
                print(f"  {i}. {target}")
            print(f"  {len(target_list) + 1}. All targets in {folder}")

            while True:
                try:
                    choice = input(f"\nSelect targets for {folder} (comma-separated numbers) or 'q' to quit: ")
                    if choice.lower() == 'q':
                        sys.exit("Process terminated by user")
                    
                    selections = [int(x.strip()) for x in choice.split(',')]
                    if not all(1 <= x <= len(target_list) + 1 for x in selections):
                        raise ValueError
                    
                    if len(target_list) + 1 in selections:
                        selected_targets[folder] = target_list
                    else:
                        selected_targets[folder] = [target_list[x-1] for x in selections]
                    break
                except ValueError:
                    print("Invalid input. Please enter valid numbers separated by commas.")
    
    return selected_targets

def main():
    # Define the folder structure and targets
    target_folders = {
        "Front-End": "src",
        "Back-End": ["config", "controllers", "middleware", "models", 
                    "routes", "services", "utils", ".env", "app.js"],
        "Mobile": "lib"
    }

    # Define sub-targets for nested folders
    sub_targets = {
        "Front-End": ["apis", "components", "context", "models", "pages"],
        "Mobile": ["models", "providers", "screens", "services", "themes", "utils", "widgets"]
    }

    # Get user selection
    selected_targets = get_user_selection(target_folders, sub_targets)
    
    # Get current directory
    base_path = os.getcwd()
    print(f"Debug: Working directory: {base_path}")
    
    # Count total files for progress tracking
    print("\nCalculating total files to process...")
    total_files = count_total_files(base_path, target_folders, selected_targets)
    print(f"Found {total_files} files to process")
    
    if total_files == 0:
        print("Warning: No files found to process. Check if directories exist and contain files.")

    # Process each selected folder into its own file
    processed_files = 0
    output_files = {}

    for folder, targets in selected_targets.items():
        output_path = os.path.join(base_path, f"{folder.lower()}_output.txt")
        output_files[folder] = output_path
        with open(output_path, 'w', encoding='utf-8') as output_file:
            output_file.write(f"{folder.upper()} PROJECT FILES\n")
            output_file.write(f"Generated on: {Path(__file__).stat().st_mtime}\n")
            output_file.write("="*50 + "\n")
            processed_files = process_folder(base_path, folder, target_folders[folder], targets, 
                                          output_file, processed_files, total_files)

    print("\n\nProcess completed! Output files created:")
    for folder, path in output_files.items():
        print(f"- {folder}: {path}")

if __name__ == "__main__":
    main()