"""Packs square PNG files into a single Windows .ico (PNG-compressed entries)."""
import struct
import sys


def png_size(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG file")
    return struct.unpack(">II", data[16:24])


def main(output, inputs):
    images = []
    for path in inputs:
        with open(path, "rb") as handle:
            data = handle.read()
        width, height = png_size(data)
        images.append((width, height, data))
    images.sort(key=lambda image: image[0])

    header = struct.pack("<HHH", 0, 1, len(images))
    offset = len(header) + 16 * len(images)
    entries, payload = b"", b""
    for width, height, data in images:
        # A dimension of 256 is stored as 0 in the directory entry.
        entries += struct.pack("<BBBBHHII", width % 256, height % 256, 0, 0, 1, 32, len(data), offset)
        payload += data
        offset += len(data)

    with open(output, "wb") as handle:
        handle.write(header + entries + payload)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("usage: png2ico.py OUTPUT.ico INPUT.png [INPUT.png ...]")
    main(sys.argv[1], sys.argv[2:])
