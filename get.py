import os
from pathlib import Path
import sys

def count_total_files(base_path, target_folders):
    """Count total files to process for progress tracking"""
    total_files = 0
    for folder, targets in target_folders.items():
        folder_path = os.path.join(base_path, folder)
        if not os.path.exists(folder_path):
            continue
        
        if isinstance(targets, str):
            target_path = os.path.join(folder_path, targets)
            if os.path.exists(target_path):
                for root, _, files in os.walk(target_path):
                    total_files += len(files)
        else:
            for target in targets:
                target_path = os.path.join(folder_path, target)
                if os.path.exists(target_path):
                    if os.path.isdir(target_path):
                        for root, _, files in os.walk(target_path):
                            total_files += len(files)
                    else:
                        total_files += 1
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

def process_folder(base_path, folder, targets, output_file, processed_files, total_files):
    """Process a single folder and its contents with progress"""
    folder_path = os.path.join(base_path, folder)
    if not os.path.exists(folder_path):
        print(f"\nWarning: Skipping {folder} - not found")
        output_file.write(f"\nWarning: {folder} not found\n")
        return processed_files

    print(f"\nProcessing contents of {folder}")
    if isinstance(targets, str):
        target_path = os.path.join(folder_path, targets)
        if os.path.exists(target_path):
            for root, _, files in os.walk(target_path):
                for file in files:
                    processed_files += 1
                    file_path = os.path.join(root, file)
                    copy_file_contents(file_path, output_file, processed_files, total_files)
    else:
        for target in targets:
            target_path = os.path.join(folder_path, target)
            if os.path.exists(target_path):
                if os.path.isdir(target_path):
                    for root, _, files in os.walk(target_path):
                        for file in files:
                            processed_files += 1
                            file_path = os.path.join(root, file)
                            copy_file_contents(file_path, output_file, processed_files, total_files)
                else:
                    processed_files += 1
                    copy_file_contents(target_path, output_file, processed_files, total_files)
    print(f"\nFinished processing {folder}")
    return processed_files

def main():
    # Define the folder structure and targets
    target_folders = {
        "Front-End": "src",
        "Back-End": ["config", "controllers", "middleware", "models", 
                    "routes", "services", "utils", ".env", "app.js"],
        "Mobile": "lib"
    }

    # Get current directory
    base_path = os.getcwd()
    
    # Count total files for progress tracking
    print("Calculating total files to process...")
    total_files = count_total_files(base_path, target_folders)
    print(f"Found {total_files} files to process")

    # Process each folder into its own file
    processed_files = 0
    output_files = {}

    for folder in target_folders:
        output_path = os.path.join(base_path, f"{folder.lower()}_output.txt")
        output_files[folder] = output_path
        with open(output_path, 'w', encoding='utf-8') as output_file:
            output_file.write(f"{folder.upper()} PROJECT FILES\n")
            output_file.write(f"Generated on: {Path(__file__).stat().st_mtime}\n")
            output_file.write("="*50 + "\n")
            processed_files = process_folder(base_path, folder, target_folders[folder], 
                                          output_file, processed_files, total_files)

    print("\n\nProcess completed! Output files created:")
    for folder, path in output_files.items():
        print(f"- {folder}: {path}")

if __name__ == "__main__":
    main()