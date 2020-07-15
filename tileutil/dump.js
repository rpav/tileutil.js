const {
  say
} = require('../util');

const sharp = require('sharp');
const hexdump = require('hexdump-nodejs');

function DumpData(info, data) {
  say(hexdump(data));
}

async function Dump(argv) {
  if (!argv.file) {
    say("No file specified.");
    return;
  }

  let img = sharp(argv.file);

  img.metadata()
    .then(md => {
      say(md);

      img.raw().toBuffer((info, data, err) => {
        DumpData(info, data);
      })
    });
}

module.exports = {
  Dump
};
