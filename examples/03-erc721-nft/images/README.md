# Example Images

This folder contains example images for NFT minting. 

## Adding Your Own Images

1. **Supported formats**: PNG, JPG, JPEG, GIF, SVG, WEBP
2. **Recommended size**: 512x512 pixels or larger
3. **File size**: Keep under 1MB for faster processing
4. **Naming**: Use descriptive names (e.g., `dragon.png`, `castle.jpg`)

## Current Images

- `example-1.png` - Abstract geometric design
- `example-2.png` - Digital art pattern  
- `example-3.png` - Colorful gradient

## Usage

The deployment script will automatically:
- Detect all image files in this folder
- Convert them to Base64 data URIs
- Generate metadata for each image
- Ask how many to mint initially

## Image Processing

- Images are embedded directly in NFT metadata as Base64
- No external hosting required (IPFS, servers, etc.)
- Metadata includes file type, size, and creation date
- Works completely offline

Replace these example images with your own art!