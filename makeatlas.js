#!/usr/bin/env node

const {
  say,
  Timer,
} = require('./util');
const sharp = require('sharp');
const yargs = require('yargs');
const process = require('process');
const path = require('path');
const fs = require('fs');
const glob = require('glob');
const crypto = require('crypto');
const cbor = require('cbor');

const {
  TrimAlpha
} = require('./tileutil/trim');

const dbg = say;

let MaxRectsPacker = require("maxrects-packer").MaxRectsPacker;
const options = {
  smart: true,
  pot: false,
  square: false,
  allowRotation: true,
  tag: false,
  border: 0
}; // Set packing options

const template = {
  meta: {
    format: "RGBA8888",
    scale: 1,
  },
};


const args = yargs
  .strict(true)
  .usage("$0 [options] <input-file>")
  .option("help", {
    alias: 'h',
    type: 'boolean',
    describe: "Show help"
  })
  .option("verbose", {
    alias: 'v',
    type: 'boolean',
    describe: "Verbose output",
  })
  .option("debug", {
    type: 'boolean',
    describe: "Enable various things for debugging",
  })
  .showHelpOnFail(true)
  .argv //
;

function usageQuit() {
  yargs.showHelp();
  process.exit();
}

function errQuit(s) {
  say(s);
  process.exit(1);
}

let input = args._[0] || usageQuit();

function hashify(o) {
  let h = crypto.createHash('sha256');
  h.update(o);
  return h.digest('hex');
}

function buildAnchors(dir) {
  if (!dir.anchors) return {};

  let anchorMap = {};

  for (let anchor of dir.anchors) {
    let oglob = glob.sync(path.join(dir.name, anchor.glob));
    for (let file of oglob) {
      if (!anchorMap[file])
        anchorMap[file] = anchor;
    }
  }

  return anchorMap;
}

function setAnchor(imrec, anchorSpec, defaultAnchor) {
  if (anchorSpec) {
    if (anchorSpec.abs) {
      imrec.anchor = anchorSpec.anchor;
    } else {
      //imrec.anchor = [imrec.width * anchorSpec.anchor[0], imrec.height * anchorSpec.anchor[1]];
      imrec.anchor = anchorSpec.anchor || defaultAnchor;
    }
  } else {
    imrec.anchor = defaultAnchor;
  }
}

async function loadImage(file, images, trim = false) {
  let im = sharp(file);

  return im.metadata().then(md => {
    if (trim) {
      return TrimAlpha(md, im);
    } else {
      let size = {
        w: md.width,
        h: md.height
      };
      return im.ensureAlpha().raw().toBuffer().then(data => {
        return {
          info: {
            srcSize: size,
            rect: {
              x: 0,
              y: 0,
              w: size.w,
              h: size.h
            },
          },
          data: data,
        };
      });
    }
  }).then(({
    info,
    data
  }) => {
    let hash = hashify(data);
    let rec = images[hash];

    if (!rec) {
      rec = {
        file: file,
        image: im,
        data: data,
        info: info,
        srcSize: info.srcSize,
        rect: info.rect,
        width: info.rect.w,
        height: info.rect.h,
      };
    } else {
      rec = {
        ...rec
      };
      rec.file = file;
      ++images._dupes;
    }

    images.push(rec);
    images[file] = rec;
    images[hash] = rec;
    return rec;
  })
}

async function binImages(bin, images) {
  let out = [];
  let ps = [];

  for (let r of bin.rects) {
    let im = images[r.file];
    im.texPos = {
      x: r.x,
      y: r.y
    };

    let w = r.rot ? r.rect.h : r.rect.w;
    let h = r.rot ? r.rect.w : r.rect.h;

    let sub = {
      rect: { x: r.x, y: r.y, w: w, h: h },
      file: r.file,
    };

    if (r.rot) {
      ps.push(im.image.rotate(90).toBuffer().then(buf => { sub.input = buf; }));
      im.rotated = true;
    } else {
      sub.input = im.data;
    }

    if (args.verbose)
      say("Bin ", r.file, " ", r.x, ",", r.y, " rot=", r.rot);

    out.push(sub)
  }

  await Promise.all(ps);

  return out;
}

function copyImage(rect, buf, bufDims) {
  const r = { ...rect.rect };

  function pxi(a, dims) {
    const [x, y] = a;
    return y * (dims.w * 4) + (x * 4);
  }

  function copyPx(toBuffer, toP, fromBuffer, fromP) {
    let fromI = pxi(fromP, r);

    if (fromI < fromBuffer.length) {
      toBuffer.writeUInt32LE(fromBuffer.readUInt32LE(fromI), pxi(toP, bufDims));
    }
  }

  for (let x = 0; x < r.w; ++x) {
    for (let y = 0; y < r.h; ++y) {
      copyPx(buf, [r.x + x, r.y + y], rect.input, [x, y]);
    }
  }
}

function copyImages(bin, images, buf) {
  const bufDims = { w: bin.width, h: bin.height };

  for (let i = 0; i < images.length; ++i) {
    copyImage(images[i], buf, bufDims);
  }
}

function makeBleed(bin, buf) {
  const [w, h] = [bin.width, bin.height];

  function maybeFlip(r) {
    if (r.rot) {
      r = { ...r };
      [r.width, r.height] = [r.height, r.width];
    }

    return r;
  }

  function pxi(a) {
    const [x, y] = a;
    return y * (w * 4) + (x * 4);
  }

  function inBound(a) {
    const [x, y] = a;
    return (x >= 0 && x < w) && (y >= 0 && y < h);
  }

  function copyPx(to, from) {
    if (inBound(to) && inBound(from)) {
      buf.writeUInt32LE(buf.readUInt32LE(pxi(from)), pxi(to));
    }
  }

  function setPx(at, c) {
    if (inBound(at))
      buf.writeUInt32BE(c, pxi(at));
  }

  function box(r) {
    const edge = 1
    for (let x = r.x; x <= r.x + edge; ++x) {
      setPx([x, r.y], 0xFF0000FF);
      setPx([x, r.y + r.height - 1], 0xFF0000FF);
    }

    for (let x = r.x + r.width - edge - 1; x <= r.x + r.width - 1; ++x) {
      setPx([x, r.y], 0xFF0000FF);
      setPx([x, r.y + r.height - 1], 0xFF0000FF);
    }

    for (let y = r.y; y <= r.y + edge; ++y) {
      setPx([r.x, y], 0xFF0000FF);
      setPx([r.x + r.width - 1, y], 0xFF0000FF);
    }

    for (let y = r.y + r.height - edge - 1; y <= r.y + r.height - 1; ++y) {
      setPx([r.x, y], 0xFF0000FF);
      setPx([r.x + r.width - 1, y], 0xFF0000FF);
    }

  }

  for (let r of bin.rects) {
    r = maybeFlip(r);

    // Corner pixels
    copyPx([r.x - 1, r.y - 1], [r.x, r.y]);
    copyPx([r.x + r.width, r.y + r.height], [r.x + r.width - 1, r.y + r.height - 1]);
    copyPx([r.x + r.width, r.y - 1], [r.x + r.width - 1, r.y]);
    copyPx([r.x - 1, r.y + r.height], [r.x, r.y + r.height - 1]);

    // Top/Bottom
    for (let x = 0; x < r.width; ++x) {
      copyPx([r.x + x, r.y - 1], [r.x + x, r.y]); // top
      copyPx([r.x + x, r.y + r.height], [r.x + x, r.y + r.height - 1]);
    }

    // Left/Right
    for (let y = 0; y < r.height; ++y) {
      copyPx([r.x - 1, r.y + y], [r.x, r.y + y]); // left
      copyPx([r.x + r.width, r.y + y], [r.x + r.width - 1, r.y + y]);
    }
  }

  if (args.debug)
    for (let r of bin.rects) box(maybeFlip(r));
}

function writeData(path, bin, images) {
  let out = {
    tiles: {},
    metadata: {
      image: bin.file,
      size: {
        w: bin.width,
        h: bin.height
      },
    },
  }
  for (let im of images) {
    let r = {
      texPos: im.texPos,
      srcSize: im.srcSize,
      anchor: im.anchor,
      rect: im.rect
    };
    if (im.rotated) r.rotated = true;
    out.tiles[im.file] = r;
  }

  if(path.match(/\.json$/)) {
    return new Promise(() => { fs.writeFileSync(path, JSON.stringify(out, null, 0)) });
  } else if(path.match(/\.cb$/)) {
    return cbor
      .encodeAsync(out)
      .then(buf => {
        fs.writeFileSync(path, buf);
      });
  }
}

function timeReport(timer, ...s) {
  say(...s, " at ", timer.toString(), " (", timer.lastDiffString(), ")");
}

async function main() {
  let timer = new Timer();
  timer.start();

  const data = JSON.parse(fs.readFileSync(input));
  let datadir = path.resolve(path.dirname(input));
  let stagedir = path.join(datadir, data.stage);

  if (!data.dirs) errQuit("Input has no `dirs` to process");

  process.chdir(stagedir);

  say("data: ", datadir);
  say("stage: ", stagedir);

  if (!data.defaultAnchor)
    data.defaultAnchor = { x: 0, y: 0 };

  let images = [];
  let ps = [];
  let spriteCount = 0;

  images._dupes = 0;

  timeReport(timer, "Start");

  for (let dirSpec of data.dirs) {
    let dir = {};

    if (typeof dirSpec == 'object') {
      dir = dirSpec;
    } else {
      dir.name = dirSpec;
    }

    if (dir.trim == undefined) {
      dir.trim = data.trimDefault;
    }

    let g = path.join(dir.name, data.defaultGlob);
    let files = glob.sync(g);

    let anchorMap = buildAnchors(dir);

    for (let file of files) {
      ++spriteCount;

      if (args.verbose) {
        say("Load ", file);
      }

      ps.push(
        loadImage(file, images, dir.trim)
        .then(im => {
          setAnchor(im, anchorMap[file], data.defaultAnchor);
        })
        .catch(e => {
          say("Error handling ", file, ": ", e);
        })
      );
    }
  }

  await Promise.all(ps);
  timeReport(timer, "Loaded/trimmed");
  timeReport(timer, "Images: ", images.length);

  let packer = new MaxRectsPacker(2048, 2048, 2, options);
  packer.addArray(images);

  timeReport(timer, "Packing computed");

  packer.bins.map(async (bin, i) => {
    bin.index = i;
    bin.file = data.writeImage;
    let binnedImages = await binImages(bin, images);
    timeReport(timer, "Binned images");

    sharp({
        create: {
          width: bin.width,
          height: bin.height,
          channels: 4,
          background: {
            r: 0,
            b: 0,
            g: 0,
            alpha: 0.0
          }
        }
      })
      .raw().toBuffer()
      .then(buf => {
        copyImages(bin, binnedImages, buf);
        timeReport(timer, "Built altas");
        makeBleed(bin, buf);
        timeReport(timer, "Bleed");

        sharp(buf, {
            raw: {
              width: bin.width,
              height: bin.height,
              channels: 4,
            }
          })
          .toFile(path.join(datadir, data.writeImage))
          .then(async () => {
            timeReport(timer, "Process finished");
            say("Sprites processed: ", spriteCount);
            say("Duplicate frames:  ", images._dupes);

            await writeData(path.join(datadir, data.writeData), bin, images);
          });

        return buf;
      })
  });

}
main();
