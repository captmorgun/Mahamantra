#!/usr/bin/env python3
"""
Convert potrace negative SVG (black background + transparent holes)
to positive SVG (decorative shapes on transparent background).

Usage:
    python3 convert_svg.py input.svg
    python3 convert_svg.py input.svg output.svg
    python3 convert_svg.py input.svg --color "#d94215" --opacity 0.5
"""

import re
import sys
import os
import argparse


def convert_svg(input_path, output_path=None, fill_color="#000000"):
    with open(input_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract all path d= attributes
    path_pattern = re.compile(r'<path\s[^>]*d="([^"]*)"', re.DOTALL)
    paths = path_pattern.findall(content)

    if not paths:
        print("ERROR: No paths found in SVG.")
        sys.exit(1)

    # Find the biggest path — that's the main ornament (background + holes)
    main_path = max(paths, key=len)
    main_path_index = paths.index(main_path)

    print(f"Found {len(paths)} paths. Main path: #{main_path_index} ({len(main_path)} chars)")

    # The main path starts with the outer boundary sub-path, ending at first 'z'
    first_z = main_path.find("z")
    if first_z == -1:
        print("ERROR: No 'z' found in main path — might not be a potrace negative SVG.")
        sys.exit(1)

    outer_boundary = main_path[:first_z + 1]
    decorative_part = main_path[first_z + 1:].lstrip()

    print(f"Outer boundary length: {len(outer_boundary)} chars")
    print(f"Decorative part length: {len(decorative_part)} chars")

    # The first sub-path after the outer boundary uses relative 'm x y'
    # coordinates relative to the last absolute M in the outer boundary.
    # We need to find that M and convert the first 'm' to absolute 'M'.
    last_abs_M = re.findall(r"M(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)", outer_boundary)
    if last_abs_M:
        ox, oy = float(last_abs_M[-1][0]), float(last_abs_M[-1][1])
        print(f"Outer boundary last M: ({ox}, {oy})")
    else:
        ox, oy = 0.0, 0.0
        print(f"No M found in outer boundary, assuming origin (0, 0)")

    # Convert the first relative 'm dx dy' to absolute 'M x y'
    first_rel_m = re.match(r"m(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)", decorative_part)
    if first_rel_m:
        dx, dy = float(first_rel_m.group(1)), float(first_rel_m.group(2))
        abs_x = ox + dx
        abs_y = oy + dy
        decorative_part = (
            f"M{abs_x:g} {abs_y:g}" + decorative_part[first_rel_m.end():]
        )
        print(f"Converted m{dx:g} {dy:g} → M{abs_x:g} {abs_y:g}")
    else:
        print("WARNING: First sub-path doesn't start with relative 'm' — keeping as-is")

    # Extract transform from the original <g> tag
    g_match = re.search(r'<g\s([^>]*transform="[^"]*"[^>]*)>', content, re.DOTALL)
    transform_attr = ""
    if g_match:
        # Extract just the transform value
        t = re.search(r'transform="([^"]*)"', g_match.group(1))
        if t:
            transform_attr = f' transform="{t.group(1)}"'

    # Extract viewBox from SVG header
    vb_match = re.search(r'viewBox="([^"]*)"', content)
    viewBox = vb_match.group(1) if vb_match else "0 0 1252 146"

    # Extract width/height
    w_match = re.search(r'<svg[^>]*width="([^"]*)"', content)
    h_match = re.search(r'<svg[^>]*height="([^"]*)"', content)
    width  = w_match.group(1)  if w_match  else "1252pt"
    height = h_match.group(1)  if h_match  else "146pt"

    # Build the other (small accent) paths, excluding the main path
    other_paths = [p for i, p in enumerate(paths) if i != main_path_index]
    other_paths_xml = "\n".join(f'<path d="{p}"/>' for p in other_paths)

    new_svg = f'''<?xml version="1.0" standalone="no"?>
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="{width}" height="{height}" viewBox="{viewBox}"
 preserveAspectRatio="xMidYMid meet">
<g{transform_attr}
fill="{fill_color}" stroke="none">
<path d="{decorative_part}"/>
{other_paths_xml}
</g>
</svg>
'''

    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = base + "_positive" + ext

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(new_svg)

    print(f"\n✓ Saved: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="Convert potrace negative SVG to positive (ornament on transparent background)"
    )
    parser.add_argument("input", help="Input SVG file")
    parser.add_argument("output", nargs="?", help="Output SVG file (default: input_positive.svg)")
    parser.add_argument(
        "--color", default="#000000",
        help="Fill color for ornament, e.g. #d94215 (default: #000000)"
    )
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"ERROR: File not found: {args.input}")
        sys.exit(1)

    convert_svg(args.input, args.output, fill_color=args.color)


if __name__ == "__main__":
    main()
