# Tile Utilities

These are somewhat rough at the moment, but what I'm using for my game.  Posting because they may be useful.

  * makeatlas - build a texture atlas from a bunch of sprites, trimming and packing with maxrects, and output .json vaguely similar (but not identical) to TexturePacker
  * maketileset - create a tileset .json file that Tiled can understand, from a series of images, or single image
  * tilesplit - split a uniform sheet into separate files
  * tileutil - a few simple metadata subutilities

These all make heavy utilization of the following:

  * [sharp](https://github.com/lovell/sharp/), a fast image processing library
  * [maxrects-packer](https://github.com/soimy/maxrects-packer), a fast MaxRects packing library

## makeatlas

This is the most complicated (and probably most useful) of the utilities.  You can specify an input `.json` file, and process a series of staged sprites into a texture atlas.

The input file should look like the following:

``` json
{
    "stage": "path/to/staging",
    "writeData": "atlas.json",
    "writeImage": "altas.png",
    "defaultGlob": "*.png",
    "defaultAnchor": {
        "x": 0,
        "y": 1
    },
    "dirs": [
        "subdirname",
        "anothersubdir",
        {
            "name": "more_specific_entry",
            "trim": true,
            "anchors": [
                { "glob": "foo_*.png", "anchor": { "x": 0.5, "y": 1.0 } },
                { "glob": "*", "anchor": { "x": 0.5, "y": 0.5 } }
            ]
        }
    ]
}
```

This will:

  * Look for everything in the root specified by `stage`
  * Write atlas *data* (texture coordinates etc) to `atlas.json`
  * Write the atlas to `atlas.png`
  * Anchor by default at the lower-left corner (Y is down)
  * For each of the entries in `"dirs"`, it will either:
    * Process "*.png" if it's a string
    * Process more specific options if it's an object. Globs are evaluated in order, so earlier-more-specific ones override later ones.

I *highly* recommend actually writing a `.js` file that looks like this:

``` js
console.log(JSON.stringify({
  stage: "../_STAGE",
  writeData: "atlas.cb",
  writeImage: "altas.png",

  defaultGlob: "*.png",
  defaultAnchor: { x: 0, y: 1.0 },

  dirs: [
     "subdir",

     // A more specific entry
     { ... },
  ],
});
```

This will just spit out JSON if run with node.

## maketileset

This is fairly straightforward:

```
maketileset [options] <png-files>...

Options:
  --help, -h    Show help                                              [boolean]
  --version     Show version number                                    [boolean]
  --name, -n    Name field                                              [string]
  --output, -o  Output JSON file                                        [string]
  --single, -s  Tileset is from a single image                         [boolean]
  -H            Tile height single-image sets             [number] [default: 16]
  -W            Tile width for single-image sets          [number] [default: 16]
```

This will spit out json that can be loaded by Tiled.  This may be useful for a number of reasons; avoiding Tiled crashes, making sure you have packed indices, or just automating the process, etc.

## tilesplit

Split an image into individual tiles:

```
tilesplit [options] <file>

Options:
  --help, -h  Show help                                                [boolean]
  --version   Show version number                                      [boolean]
  -H          Height of each tile                         [number] [default: 16]
  -W          Width of each tile                          [number] [default: 16]
```

This outputs numbered tiles.

## tileutil

This has a couple minor sub utilities:

```
tileutil <command> [args]

Commands:
  tileutil isblank [files...]  Output names of specified files which are blank
                               (100% alpha)
  tileutil dump [file]         Dump data about file

Options:
  --help, -h  Show help                                                [boolean]
  --version   Show version number                                      [boolean]
```

These can be useful:

  * `isblank`: Once you've cut a sheet, you can use this in a script or similar to figure out all the "blank" tiles and eliminate them as desired
  * `dump`: If you want to know some basic things about a sprite and/or see its data

## Note

This code is probably terrible, and/or could use a lot of optimization/cleanup/etc, but it was written for internal use and gets the job done.  PRs welcome! ... just don't break how things work.
