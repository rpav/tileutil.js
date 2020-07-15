#!/usr/bin/env node

const {
  say
} = require('./util');
const sharp = require('sharp');
const yargs = require('yargs');
const process = require('process');
const path = require('path');
const fs = require('fs');

const template = {
  columns: 0,
  grid: {
    height: 1,
    orientation: "orthogonal",
    width: 1,
  },

  margin: 0,
  spacing: 0,
  tiledversion: "1.2.4",
  type: "tileset",
  version: 1.2,
};

const args = yargs
  .strict(true)
  .usage("$0 [options] <png-files>...")
  .option("help", { alias: 'h', type: 'boolean', describe: "Show help" })
  .option("name", { alias: 'n', type: 'string', describe: 'Name field' })
  .option("output", { alias: 'o', type: 'string', describe: "Output JSON file" })
  .option("single", { alias: 's', type: 'boolean', describe: "Tileset is from a single image" })
  .option("H", { type: 'number', describe: "Tile height single-image sets", default: 16 })
  .option("W", { type: 'number', describe: "Tile width for single-image sets", default: 16 })
  .showHelpOnFail(true)
  .argv //
;

if (args.help || args._.length == 0) {
  yargs.showHelp();
  process.exit()
}

function makeName() {
  if (args.name) return args.name
  if (args.output) {
    let name = path.basename(args.output, ".json");
    say("Using default name: '", name, "'");
    return name
  }

  say("Warning: no output file or name specified");
  return "";
}

async function buildSingle(args) {
  let cwd = process.cwd();


  if (args._.length > 1) {
    say("Error: multiple images specified for single-image tileset");
    process.exit(1)
  }

  let filename = args._[0];
  let md = await sharp(filename, { failOnError: true }).metadata();
  let tilesW = md.width / args.W;
  let tilesH = md.height / args.H;

  let out = {
    image: path.relative(cwd, filename),
    imageheight: md.height,
    imagewidth: md.width,
    margin: 0,
    name: makeName(),
    spacing: 0,
    tilecount: tilesW * tilesH,
    tiledversion: "1.2.4",
    tileheight: args.H,
    tilewidth: args.W,
    type: "tileset",
    version: 1.2,
  };

  return JSON.stringify(out);
}

async function buildMulti(args) {
  let cwd = process.cwd();
  let out = {
    name: makeName(),
    ...template
  };
  out.tiles = []

  let id = 0;
  let maxX = 0;
  let maxY = 0;

  let tiles = args._.map(file => {
    return {
      id: id++,
      image: path.relative(cwd, file),
    };
  });

  let ps = tiles.map(rec => {
    let img = sharp(rec.image, {
      failOnError: true
    });

    return img.metadata()
      .catch(e => {
        say("Error: ", e.message, "\n");
      })
      .then((md, err) => {
        rec.imageheight = md.height;
        rec.imagewidth = md.width;
        maxX = Math.max(maxX, md.width);
        maxY = Math.max(maxY, md.height);
      });
  });

  await Promise.all(ps);

  out.tilecount = id;
  out.tilewidth = maxX;
  out.tileheight = maxY;
  out.tiles = tiles;

  return JSON.stringify(out);
}

async function main() {
  let outJson;

  if (args.single) {
    outJson = await buildSingle(args);
  } else {
    outJson = await buildMulti(args);
  }

  if (args.output) {
    fs.writeFileSync(args.output, outJson);
    say("Written to ", args.output);
  } else {
    say(outJson);
  }
}

main();
