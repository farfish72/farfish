#!/usr/bin/env python3
"""
Generate Android launcher icons from the existing app_icon.png
Creates all density-specific icons for proper display across Android 9 to Android 16+
"""

from PIL import Image
import os

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_ICON = os.path.join(BASE_DIR, "app/src/main/res/drawable/app_icon.png")
RES_DIR = os.path.join(BASE_DIR, "app/src/main/res")

# Icon sizes for different densities
# Standard launcher icons
LAUNCHER_SIZES = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
}

# Adaptive icon foreground layer sizes (108dp with content centered)
ADAPTIVE_FOREGROUND_SIZES = {
    'mdpi': 108,
    'hdpi': 162,
    'xhdpi': 216,
    'xxhdpi': 324,
    'xxxhdpi': 432
}

def ensure_dir(path):
    """Create directory if it doesn't exist"""
    os.makedirs(path, exist_ok=True)

def create_launcher_icons():
    """Create legacy launcher icons for all densities"""
    print("Loading source icon...")
    source_img = Image.open(SOURCE_ICON)
    
    # Ensure RGBA mode
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')
    
    for density, size in LAUNCHER_SIZES.items():
        print(f"Creating ic_launcher.png for {density} ({size}x{size})...")
        
        # Create mipmap directory
        mipmap_dir = os.path.join(RES_DIR, f"mipmap-{density}")
        ensure_dir(mipmap_dir)
        
        # Resize and save ic_launcher.png
        resized = source_img.resize((size, size), Image.LANCZOS)
        output_path = os.path.join(mipmap_dir, "ic_launcher.png")
        resized.save(output_path, "PNG")
        
        # Also create ic_launcher_round.png (same for now)
        round_output = os.path.join(mipmap_dir, "ic_launcher_round.png")
        resized.save(round_output, "PNG")
        
        print(f"  ✓ Saved {output_path}")
        print(f"  ✓ Saved {round_output}")

def create_adaptive_foreground_icons():
    """Create adaptive icon foreground layer with proper padding"""
    print("\nCreating adaptive icon foreground layers...")
    source_img = Image.open(SOURCE_ICON)
    
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')
    
    for density, canvas_size in ADAPTIVE_FOREGROUND_SIZES.items():
        print(f"Creating ic_launcher_foreground.png for {density} ({canvas_size}x{canvas_size})...")
        
        mipmap_dir = os.path.join(RES_DIR, f"mipmap-{density}")
        ensure_dir(mipmap_dir)
        
        # Create transparent canvas (108dp total, 66dp safe content area)
        # 18dp padding = 16.67% padding on each side
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        
        # Calculate content size (66dp out of 108dp)
        content_size = int(canvas_size * 0.611)  # 66/108 = 0.611
        padding = (canvas_size - content_size) // 2
        
        # Resize source to content area
        resized_content = source_img.resize((content_size, content_size), Image.LANCZOS)
        
        # Paste centered with padding
        canvas.paste(resized_content, (padding, padding), resized_content)
        
        output_path = os.path.join(mipmap_dir, "ic_launcher_foreground.png")
        canvas.save(output_path, "PNG")
        print(f"  ✓ Saved {output_path}")

def create_monochrome_icons():
    """Create monochrome icons for Android 13+ themed icons"""
    print("\nCreating monochrome icons for Android 13+ themed icons...")
    source_img = Image.open(SOURCE_ICON)
    
    # Convert to grayscale then to white silhouette on transparent background
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')
    
    for density, canvas_size in ADAPTIVE_FOREGROUND_SIZES.items():
        print(f"Creating ic_launcher_monochrome.png for {density} ({canvas_size}x{canvas_size})...")
        
        mipmap_dir = os.path.join(RES_DIR, f"mipmap-{density}")
        ensure_dir(mipmap_dir)
        
        # Create transparent canvas
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        
        # Calculate content size
        content_size = int(canvas_size * 0.611)
        padding = (canvas_size - content_size) // 2
        
        # Resize and convert to monochrome
        resized = source_img.resize((content_size, content_size), Image.LANCZOS)
        
        # Create white silhouette using alpha channel
        mono = Image.new('RGBA', (content_size, content_size), (0, 0, 0, 0))
        pixels = mono.load()
        source_pixels = resized.load()
        
        for y in range(content_size):
            for x in range(content_size):
                # Use alpha channel to create white silhouette
                alpha = source_pixels[x, y][3]
                if alpha > 0:
                    pixels[x, y] = (255, 255, 255, alpha)
        
        canvas.paste(mono, (padding, padding), mono)
        
        output_path = os.path.join(mipmap_dir, "ic_launcher_monochrome.png")
        canvas.save(output_path, "PNG")
        print(f"  ✓ Saved {output_path}")

def main():
    print("=" * 60)
    print("FarFISH Android Launcher Icon Generator")
    print("=" * 60)
    
    if not os.path.exists(SOURCE_ICON):
        print(f"ERROR: Source icon not found at {SOURCE_ICON}")
        return 1
    
    try:
        # Generate all icon assets
        create_launcher_icons()
        create_adaptive_foreground_icons()
        create_monochrome_icons()
        
        print("\n" + "=" * 60)
        print("✓ All icon assets generated successfully!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Review the generated icons in mipmap-* folders")
        print("2. Update XML configuration files (see instructions)")
        print("3. Build and test on different Android versions")
        
        return 0
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
