#!/usr/bin/env node

const {
  say,
} = require('./util')

const sharp = require('sharp')
const yargs = require('yargs')
const process = require('process')

yargs
  .strict(true)
  .usage("$0 [options] <file>")
  .option("help", { alias: 'h', type: 'boolean', describe: "Show help" })
  .option("H", { type: 'number', describe: 'Height of each tile', default: 16 })
  .option("W", { type: 'number', describe: 'Width of each tile', default: 16 })
  .parse()

const args = yargs.argv;
const imgName = args._[0]

function usage() {
  yargs.showHelp()
  process.exit()
}

if (!imgName) {
  say('Error: input required\n')
  usage()
}

const img = sharp(imgName, {
  failOnError: true
})

img.metadata()
  .then((md, err) => {
    say(imgName, ': ', md.format, ' ', md.width, 'x', md.height)
    let n = 0
    for (let y = 0; y < md.height; y += args.H) {
      for (let x = 0; x < md.width; x += args.W) {
        img.clone()
          .extract({
            left: x,
            top: y,
            width: args.W,
            height: args.H,
          })
          .toFile(n.toString() + '.png')
          ++n
      }
    }
  })
  .catch(e => {
    say('Error: ', e.message, '\n')
    usage()
  })
