const { say } = require('../util');

const sharp = require('sharp');

class NoAlpha {};

function isBufferBlank(data) {
  let nonzero = false;

  for (let i = 3; i < data.length; i += 4) {
    let v = data[i];
    if (v) {
      nonzero = true;
      break;
    }
  }

  return !nonzero;
}

async function isImgBlank(img) {
  let md = await img.metadata();
  let data = await img.raw().toBuffer();

  if (md.hasAlpha) {
    let isBlank = isBufferBlank(data);
    return { isBlank, data };
  }

  return {isBlank: false, data: data};
}

function IsBlank(argv) {
  if (!argv.files.length) return;

  for (let file of argv.files) {
    if (argv.verbose) {
      say("IsBlank ", file);
    }

    try {
      let img = sharp(file);

      isImgBlank(img).then(({ isBlank, data }) => {
        if (isBlank) {
          say(file);
        } else {
          if (argv.verbose) {
            say("Non-blank: ", data);
          }
        }
      }).catch(e => {
        say("Error: ", e);
      });

    } catch (e) {
      say("Error: ", e);
    }
  }
}

module.exports = {
  IsBlank
};
